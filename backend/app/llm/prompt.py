"""Prompt building + Claude call for the credit-risk LLM layer.

Input comes from the ml layer: `EnsembleModels.predict` (probability) and
`Explainer.top_features` (list of {feature, value, shap_value, importance}).
"""
from __future__ import annotations
from pathlib import Path
from openai import OpenAI
from langchain_chroma import Chroma
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings
from dotenv import load_dotenv
from functools import lru_cache

import os

load_dotenv(override=True)
MODEL = "google/diffusiongemma-26b-a4b-it"

# Same store + embedding model as rag/ingest.py.
DB_NAME = str(Path(__file__).parent / "vector_db")


@lru_cache(maxsize=1)
def get_retriever():
    """Built on first use so the API still boots without a vector store / API key."""
    return Chroma(
        persist_directory=DB_NAME,
        embedding_function=NVIDIAEmbeddings(
            model="nvidia/nv-embedqa-e5-v5",
            api_key=os.getenv("NVDIA_API_KEY"),
        ),
    ).as_retriever(search_kwargs={"k": 10})

BANDS = ((0.10, "LOW"), (0.30, "MEDIUM"), (0.60, "HIGH"), (1.01, "VERY HIGH"))

SYSTEM = """You are a credit risk analyst. You receive a default probability predicted by
an ensemble model (LightGBM/XGBoost/CatBoost) along with the features that contributed
most according to SHAP.

SHAP convention: a positive value pushes the default probability UP (worse), a negative
value pulls it DOWN (better). Feature names follow the Home Credit convention: suffix
A=amount, P=days past due, L=count/flag, T=category, D=date; prefixes such as
applprev_/person1_ identify the source table.

Ground every conclusion in the data provided — never invent figures. Translate technical
feature names into business language."""



def risk_band(probability: float) -> str:
    for ceiling, label in BANDS:
        if probability < ceiling:
            return label
    return "VERY HIGH"


def format_features(top_features: list[dict]) -> str:
    lines = []
    for f in top_features:
        direction = "raises risk" if f["shap_value"] > 0 else "lowers risk"
        lines.append(
            f"- {f['feature']} = {f['value']} | SHAP {f['shap_value']:+.4f} ({direction})"
        )
    return "\n".join(lines)


def _context(case_id, probability: float, top_features: list[dict]) -> str:
    return (
        f"Application: {case_id}\n"
        f"Default probability: {probability:.2%} (risk band: {risk_band(probability)})\n\n"
        f"Strongest contributing factors:\n{format_features(top_features)}"
    )


def build_report_prompt(case_id, probability: float, top_features: list[dict]) -> str:
    return _context(case_id, probability, top_features) + """

        Write an underwriting report with:
        1. Summary — the risk level and the main reason, 2-3 sentences.
        2. Risk-increasing factors — interpret each positive-SHAP feature.
        3. Risk-reducing factors — interpret each negative-SHAP feature.
        4. Caveats — contradictions or missing data, if any."""


def build_recommend_prompt(case_id, probability: float, top_features: list[dict]) -> str:
    return _context(case_id, probability, top_features) + """

        Give an action recommendation with:
        1. Decision — APPROVE / APPROVE WITH CONDITIONS / DECLINE, plus a short reason.
        2. Conditions — credit limit, collateral, term... if approving with conditions.
        3. Follow-ups — documents or information that still need verification.
        Keep it tight: at most 3 bullets per section."""


def stream(prompt: str, history: list[dict] | None = None, ai_config: dict | None = None, max_tokens: int = 4000):
    import concurrent.futures

    ai_config = ai_config or {}
    temperature = ai_config.get("temperature", 1.0)
    max_tokens = ai_config.get("maxTokens", max_tokens)
    preferred_model = ai_config.get("preferredModel")

    try:
        context = "\n\n".join(d.page_content for d in get_retriever().invoke(prompt))
    except Exception:
        context = "(none)"

    messages = [
        {"role": "system", "content": f"{SYSTEM}\n\nInternal policy context:\n{context}"},
        *(history or []),
        {"role": "user", "content": prompt},
    ]

    def _stream(base_url, api_key, model, extra=None):
        client = OpenAI(base_url=base_url, api_key=api_key)
        kwargs = dict(model=model, messages=messages, temperature=temperature, top_p=0.95, max_tokens=max_tokens, stream=True)
        if extra:
            kwargs["extra_body"] = extra
        return client.chat.completions.create(**kwargs)

    def _yield(completion):
        for chunk in completion:
            if chunk.choices and chunk.choices[0].delta.content:
                yield chunk.choices[0].delta.content

    gemini_key = ai_config.get("geminiKey") or os.getenv("GEMINI_API_KEY")
    nvidia_key = ai_config.get("nvidiaKey") or os.getenv("NVDIA_API_KEY")
    
    models_to_try = []
    
    if preferred_model == "google/diffusiongemma-26b-a4b-it":
        models_to_try.append(("nvidia", "google/diffusiongemma-26b-a4b-it"))
        models_to_try.append(("gemini", "gemini-2.5-flash-lite"))
        models_to_try.append(("gemini", "gemini-2.5-flash"))
    elif preferred_model == "gemini-2.5-flash":
        models_to_try.append(("gemini", "gemini-2.5-flash"))
        models_to_try.append(("gemini", "gemini-2.5-flash-lite"))
        models_to_try.append(("nvidia", "google/diffusiongemma-26b-a4b-it"))
    else:
        models_to_try.append(("gemini", "gemini-2.5-flash-lite"))
        models_to_try.append(("gemini", "gemini-2.5-flash"))
        models_to_try.append(("nvidia", "google/diffusiongemma-26b-a4b-it"))

    for provider, model in models_to_try:
        try:
            if provider == "gemini" and gemini_key:
                gemini_base = "https://generativelanguage.googleapis.com/v1beta/openai/"
                pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
                future = pool.submit(_stream, gemini_base, gemini_key, model)
                yield from _yield(future.result(timeout=4))
                pool.shutdown(wait=False)
                return
            elif provider == "nvidia" and nvidia_key:
                pool = concurrent.futures.ThreadPoolExecutor(max_workers=1)
                future = pool.submit(_stream, "https://integrate.api.nvidia.com/v1", nvidia_key, model, {"chat_template_kwargs":{"enable_thinking":True},"reasoning_budget":max_tokens})
                yield from _yield(future.result(timeout=4))
                pool.shutdown(wait=False)
                return
        except (concurrent.futures.TimeoutError, Exception) as e:
            pass

    yield "All configured AI models timed out or failed. Please check your API keys."


def ask(prompt: str, history: list[dict] | None = None, max_tokens: int = 4000) -> str:
    return "".join(stream(prompt, history, max_tokens))

