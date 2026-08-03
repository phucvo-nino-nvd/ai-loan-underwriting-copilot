from __future__ import annotations

from collections.abc import AsyncIterator, Iterator
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.responses import StreamingResponse
from langchain_core.tracers.langchain import wait_for_all_tracers
from pydantic import BaseModel, Field

import json
import os

from prompt import stream, build_report_prompt, build_recommend_prompt, case_context

import mcp_server


class ChatRequest(BaseModel):
    prompt: str
    clerk_user_id: str = Field(min_length=1)
    context: str | None = None
    history: list[dict[str, str]] | None = None
    ai_config: dict[str, str | int | float | bool] | None = None


class ReportRequest(BaseModel):
    case_id: int
    clerk_user_id: str = Field(min_length=1)
    probability: float
    risk_band: str
    top_features: list[dict]
    history: list[dict[str, str]] | None = None
    ai_config: dict[str, str | int | float | bool] | None = None


def _sse_stream(
    prompt: str, request: ChatRequest | ReportRequest, search_query: str = "", app_context: str | None = None
) -> Iterator[str]:
    try:
        for chunk in stream(
            prompt,
            history=request.history,
            ai_config=request.ai_config,
            search_query=search_query,
            clerk_user_id=request.clerk_user_id,
            app_context=app_context,
        ):
            yield f"data: {json.dumps(chunk)}\n\n"
    finally:
        # Lambda freezes the sandbox once the response ends, which drops whatever
        # the LangSmith background uploader has not flushed yet. No-op when tracing
        # is off.
        wait_for_all_tracers()


@asynccontextmanager
async def lifespan(app: FastAPI) -> AsyncIterator[None]:
    sessions = mcp_server.McpSessions(mcp_server.mcp_connections())
    tools = await sessions.start()
    mcp_server.set_mcp_tools(tools)
    try:
        yield
    finally:
        sessions.stop()


app = FastAPI(title="Aluci Copilot Service", lifespan=lifespan)


@app.get("/health")
def health() -> dict[str, str | bool | int]:
    return {
        "service": "Aluci Copilot",
        "status": "healthy",
        "openrouter_configured": bool(os.getenv("OPENROUTER_API_KEY")),
        "vector_bucket_configured": bool(os.getenv("VECTOR_BUCKET")),
        "mcp_tool_count": len(mcp_server.mcp_tools or []),
    }


@app.post("/chat")
def chat(request: ChatRequest) -> StreamingResponse:
    return StreamingResponse(
        _sse_stream(request.prompt, request, app_context=request.context), media_type="text/event-stream"
    )


@app.post("/report")
def report(request: ReportRequest) -> StreamingResponse:
    prompt = build_report_prompt(request.case_id, request.probability, request.top_features)
    search_query = case_context(request.case_id, request.probability, request.top_features)
    return StreamingResponse(_sse_stream(prompt, request, search_query), media_type="text/event-stream")


@app.post("/recommend")
def recommend(request: ReportRequest) -> StreamingResponse:
    prompt = build_recommend_prompt(request.case_id, request.probability, request.top_features)
    search_query = case_context(request.case_id, request.probability, request.top_features)
    return StreamingResponse(_sse_stream(prompt, request, search_query), media_type="text/event-stream")
