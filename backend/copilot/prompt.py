from __future__ import annotations

from pathlib import Path
from typing import Annotated, Sequence, TypedDict

from dotenv import load_dotenv
from langchain_core.messages import AIMessage, BaseMessage, HumanMessage, SystemMessage
from langchain_core.tools import tool
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.memory import MemorySaver
from langgraph.graph import END, StateGraph
from langgraph.prebuilt import ToolNode

import operator
import os
import traceback
import warnings

from tools import search_vectors

import mcp_server

warnings.filterwarnings("ignore", category=DeprecationWarning, module="langgraph")

load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env", override=True)

OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
MODEL = "openai/gpt-oss-120b"


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

Never use LaTeX — no \\[ \\], no $ $, no \\frac. The renderer shows it as raw text. Write
formulas on one plain line, e.g. `DTI (%) = monthly debt payments / gross monthly income x 100`.

You have access to browser tools through Playwright. If the user asks you to browse,
open a URL, search the web, scrape a page, click something, take a screenshot, check
the current time/date, current events, or anything that might have changed since your
training cutoff, use the browser tools before answering. Do not claim browser tools are
unavailable unless a browser tool call has actually failed. Otherwise answer from your
training data.

The underwriter's own lending policy lives in `retrieve_policy_context`. Call it whenever
the answer could depend on internal limits, thresholds or procedures — your training data
does not contain them. Skip it for small talk or questions about the case data alone.

IMPORTANT: When you use information from the "Internal policy context", you MUST cite the source by 
using inline brackets (e.g., [1], [2]) at the end of the relevant sentence. Do NOT cite policy codes 
or titles, only use the number corresponding to the source."""


def risk_band(probability: float) -> str:
    for ceiling, label in BANDS:
        if probability < ceiling:
            return label
    return "VERY HIGH"


def case_context(case_id, probability: float, top_features: list[dict]) -> str:
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
    return case_context(case_id, probability, top_features) + """

        Write an underwriting report with:
        1. Summary — the risk level and the main reason, 2-3 sentences.
        2. Risk-increasing factors — interpret each positive-SHAP feature.
        3. Risk-reducing factors — interpret each negative-SHAP feature.
        4. Caveats — contradictions or missing data, if any."""


def build_recommend_prompt(case_id, probability: float, top_features: list[dict]) -> str:
    return case_context(case_id, probability, top_features) + """

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
    clerk_user_id: str,
    history: list[dict] | None = None,
    ai_config: dict | None = None,
    max_tokens: int = 4000,
    search_query: str = "",
    app_context: str | None = None,
):
    """Stream tokens from a LangGraph agent with optional MCP tools.

    `search_query` is what gets embedded and searched in the policy vector
    store. Callers must pass it explicitly (user message for chat, case data
    for report/recommend). Falls back to the full prompt if left empty.
    """
    ai_config = ai_config or {}
    temperature = ai_config.get("temperature", 1.0)
    max_tokens = ai_config.get("maxTokens", max_tokens)
    preferred_model = ai_config.get("preferredModel") or MODEL
    api_key = os.getenv("OPENROUTER_API_KEY")

    if not api_key:
        yield {"type": "content", "content": "OpenRouter API key is not configured."}
        return

    # Sources cited so far, numbered across every retrieval in this stream.
    cited: list[str] = []

    def retrieve_policy_context(query: str) -> str:
        """Search the underwriter's internal lending policy documents."""
        try:
            found = [s.strip() for s in search_vectors(query, clerk_user_id, k=5) if s.strip()]
        except Exception:
            traceback.print_exc()
            return "(none)"
        blocks = [f"[Source {i}]\n{s}" for i, s in enumerate(found, len(cited) + 1)]
        cited.extend(found)
        return "\n\n".join(blocks) or "(none)"

    # Report/recommend pass a search_query and always need policy, so retrieve up front.
    # Chat leaves it empty and gets the same search as a tool the model decides to call.
    if search_query:
        yield {"type": "tool_call", "name": "retrieve_policy_context"}
        context = retrieve_policy_context(search_query)
        if cited:
            yield {"type": "sources", "sources": list(cited)}
        yield {"type": "tool_result", "name": "retrieve_policy_context"}
    else:
        context = "(none)"

    def to_lc(msg: dict):
        role = msg.get("role", "")
        content = msg.get("content", "")
        if role == "assistant":
            return AIMessage(content=content)
        if role == "system":
            return SystemMessage(content=content)
        return HumanMessage(content=content)

    sys_content = f"{SYSTEM}\n\nInternal policy context:\n{context}"
    if app_context:
        sys_content += f"\n\nCurrent application context:\n{app_context}"
    
    messages = [
        SystemMessage(content=sys_content),
        *(to_lc(m) for m in (history or [])),
        HumanMessage(content=prompt),
    ]

    model = ChatOpenAI(
        model=preferred_model,
        api_key=api_key,
        base_url=os.getenv("OPENROUTER_BASE_URL", OPENROUTER_BASE_URL),
        temperature=temperature,
        max_completion_tokens=max_tokens,
    )

    tools = list(mcp_server.mcp_tools or [])
    if not search_query:
        tools.append(tool(retrieve_policy_context))
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
            if metadata.get("langgraph_node", "") == "agent":
                if getattr(chunk, "content", None):
                    yield {"type": "content", "content": chunk.content}
                if getattr(chunk, "tool_call_chunks", None):
                    for tcc in chunk.tool_call_chunks:
                        if tcc.get("name"):
                            yield {"type": "tool_call", "name": tcc["name"]}
                elif getattr(chunk, "tool_calls", None):
                    for tc in chunk.tool_calls:
                        if tc.get("name"):
                            yield {"type": "tool_call", "name": tc["name"]}
            elif metadata.get("langgraph_node", "") == "tools":
                if chunk.name == "retrieve_policy_context" and cited:
                    yield {"type": "sources", "sources": list(cited)}
                yield {"type": "tool_result", "name": chunk.name}
    except Exception as e:
        yield {"type": "content", "content": f"⚠️ API error ({type(e).__name__}): {e}"}
