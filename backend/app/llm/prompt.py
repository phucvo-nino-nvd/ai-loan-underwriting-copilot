from __future__ import annotations
from pathlib import Path
from functools import lru_cache
from dotenv import load_dotenv
import os
import warnings

warnings.filterwarnings("ignore", category=DeprecationWarning, module="langgraph")

from langchain_nvidia_ai_endpoints import ChatNVIDIA, NVIDIAEmbeddings
from langchain_core.messages import SystemMessage, HumanMessage, AIMessage, BaseMessage
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import StateGraph, END
from langgraph.prebuilt import ToolNode
from langchain_chroma import Chroma
from typing import TypedDict, Annotated, Sequence
import operator

from . import mcp_server

load_dotenv(".env.local", override=True)
MODEL = "openai/gpt-oss-120b"
DB_NAME = str(Path(__file__).parent / "vector_db")

# ---------------------------------------------------------------------------
# RAG retriever
# ---------------------------------------------------------------------------
@lru_cache(maxsize=1)
def get_retriever():
    return Chroma(
        persist_directory=DB_NAME,
        embedding_function=NVIDIAEmbeddings(
            model="nvidia/nv-embedqa-e5-v5",
            api_key=os.getenv("NVIDIA_API_KEY"),
        ),
    ).as_retriever(search_kwargs={"k": 10})


# ---------------------------------------------------------------------------
# Prompts
# ---------------------------------------------------------------------------
BANDS = ((0.10, "LOW"), (0.30, "MEDIUM"), (0.60, "HIGH"), (1.01, "VERY HIGH"))

SYSTEM = """You are a credit risk analyst. You receive a default probability predicted by
an ensemble model (LightGBM/XGBoost/CatBoost) along with the features that contributed
most according to SHAP.

SHAP convention: a positive value pushes the default probability UP (worse), a negative
value pulls it DOWN (better). Feature names follow the Home Credit convention: suffix
A=amount, P=days past due, L=count/flag, T=category, D=date; prefixes such as
applprev_/person1_ identify the source table.

Ground every conclusion in the data provided — never invent figures. Translate technical
feature names into business language.

You have access to a browser tool (playwright). If the user asks about current events,
specific dates, or anything that might have changed since your training cutoff, navigate
to a search engine (e.g. bing.com) to find up-to-date information. Otherwise answer from
your training data."""


def risk_band(probability: float) -> str:
    for ceiling, label in BANDS:
        if probability < ceiling:
            return label
    return "VERY HIGH"


def _context(case_id, probability: float, top_features: list[dict]) -> str:
    features = "\n".join(
        f"- {f['feature']} = {f['value']} | SHAP {f['shap_value']:+.4f} "
        f"({'raises risk' if f['shap_value'] > 0 else 'lowers risk'})"
        for f in top_features
    )
    return (
        f"Application: {case_id}\n"
        f"Default probability: {probability:.2%} (risk band: {risk_band(probability)})\n\n"
        f"Strongest contributing factors:\n{features}"
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


# ---------------------------------------------------------------------------
# LangGraph agent
# ---------------------------------------------------------------------------
class AgentState(TypedDict):
    messages: Annotated[Sequence[BaseMessage], operator.add]


def stream(
    prompt: str,
    history: list[dict] | None = None,
    ai_config: dict | None = None,
    max_tokens: int = 4000,
):
    """Stream tokens from a LangGraph agent with optional MCP tools."""
    ai_config = ai_config or {}
    temperature = ai_config.get("temperature", 1.0)
    max_tokens = ai_config.get("maxTokens", max_tokens)
    preferred_model = ai_config.get("preferredModel") or MODEL
    api_key = ai_config.get("nvidiaKey") or os.getenv("NVIDIA_API_KEY")

    if not api_key:
        yield "NVIDIA API key is not configured."
        return

    # RAG context (best-effort)
    try:
        context = "\n\n".join(d.page_content for d in get_retriever().invoke(prompt))
    except Exception:
        context = "(none)"

    def to_lc(msg: dict):
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "assistant":
            return AIMessage(content=content)
        if role == "system":
            return SystemMessage(content=content)
        return HumanMessage(content=content)

    messages = [
        SystemMessage(content=f"{SYSTEM}\n\nInternal policy context:\n{context}"),
        *(to_lc(m) for m in (history or [])),
        HumanMessage(content=prompt),
    ]

    model = ChatNVIDIA(
        model=preferred_model,
        api_key=api_key,
        temperature=temperature,
        top_p=1,
        max_tokens=max_tokens,
    )

    tools = mcp_server.mcp_tools or []
    agent = model.bind_tools(tools) if tools else model

    def call_agent(state: AgentState) -> dict:
        response = agent.invoke(state["messages"])
        return {"messages": [response]}

    def route(state: AgentState) -> str:
        last = state["messages"][-1]
        if getattr(last, "tool_calls", None):
            return "tools"
        return END

    graph = StateGraph(AgentState)
    graph.add_node("agent", call_agent)
    if tools:
        graph.add_node("tools", ToolNode(tools))
        graph.add_edge("tools", "agent")
        graph.add_conditional_edges("agent", route, {"tools": "tools", END: END})
    else:
        graph.add_edge("agent", END)
    graph.set_entry_point("agent")
    compiled = graph.compile(checkpointer=MemorySaver())

    config = {"configurable": {"thread_id": "stream"}, "recursion_limit": 20}

    try:
        for event in compiled.stream(
            {"messages": messages}, config, stream_mode="messages"
        ):
            if not isinstance(event, tuple):
                continue
            chunk, metadata = event
            if metadata.get("langgraph_node", "") == "agent" and getattr(chunk, "content", None):
                yield chunk.content
    except Exception as e:
        yield f"⚠️ API error ({type(e).__name__}): {e}"


def ask(prompt: str, history: list[dict] | None = None, max_tokens: int = 4000) -> str:
    return "".join(stream(prompt, history, max_tokens=max_tokens))
