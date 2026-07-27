import os
from pathlib import Path
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

load_dotenv(Path(__file__).resolve().parents[1] / ".env.local", override=True)

from .routes import policy, predict, report, rag
from .llm.mcp_server import McpSessions, mcp_connections, set_mcp_tools


@asynccontextmanager
async def lifespan(app: FastAPI):
    connections = mcp_connections()
    sessions = McpSessions(connections)
    tools = await sessions.start()
    set_mcp_tools(tools)
    app.state.mcp_sessions = sessions
    yield
    sessions.stop()


app = FastAPI(title="Credit Risk API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-Id", "X-Probability", "X-Risk-Band"],
)

app.include_router(predict.router)
app.include_router(report.router)
app.include_router(policy.router)
app.include_router(rag.router)


@app.get("/")
async def root():
    return {"message": "Credit Risk API — ensemble scoring + SHAP + RAG explanations"}


@app.get("/health")
async def health_check():
    return {"status": "healthy"}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=8000)
