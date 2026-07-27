"""MCP server session management — started by main.py lifespan, accessed via global."""
from __future__ import annotations

import asyncio
from contextlib import AsyncExitStack
from pathlib import Path

from langchain_mcp_adapters.client import MultiServerMCPClient
from langchain_mcp_adapters.tools import load_mcp_tools


mcp_tools: list | None = None


def set_mcp_tools(tools: list) -> None:
    """Called once from main.py lifespan after MCP sessions start."""
    global mcp_tools
    loop = asyncio.get_running_loop()
    mcp_tools = tools
    for t in tools:
        if t.func is not None or t.coroutine is None:
            continue
        coroutine = t.coroutine

        def sync_run(*args, _coroutine=coroutine, **kwargs):
            future = asyncio.run_coroutine_threadsafe(
                _coroutine(*args, **kwargs), loop
            )
            return future.result()

        t.func = sync_run


def mcp_connections() -> dict:
    """MCP servers the agent can use."""
    args = ["-y", "@playwright/mcp@latest", "--isolated", "--headless"]
    cache = Path.home() / ".cache" / "ms-playwright"
    for path in sorted(cache.glob("chromium-*/chrome-linux64/chrome"), reverse=True):
        if path.is_file():
            args.extend(["--executable-path", str(path)])
            break

    return {
        "playwright": {
            "transport": "stdio",
            "command": "npx",
            "args": args,
        },
    }


class McpSessions:
    """Holds persistent MCP sessions open so the browser keeps its state
    between tool calls.

    The stdio transport must be opened and closed from the same asyncio task,
    so one background task owns the sessions.
    """

    def __init__(self, connections: dict):
        self.connections = connections
        self.tools: list = []
        self._ready = asyncio.Event()
        self._stop = asyncio.Event()
        self._task: asyncio.Task | None = None

    async def _run(self):
        client = MultiServerMCPClient(self.connections)
        async with AsyncExitStack() as stack:
            for name in self.connections:
                session = await stack.enter_async_context(client.session(name))
                self.tools += await load_mcp_tools(session, server_name=name)
            self._ready.set()
            await self._stop.wait()

    async def start(self) -> list:
        """Start all MCP sessions in a background task, return the tool list."""
        self._task = asyncio.create_task(self._run())
        ready = asyncio.create_task(self._ready.wait())
        await asyncio.wait([ready, self._task], return_when=asyncio.FIRST_COMPLETED)
        ready.cancel()
        if self._task.done():
            self._task.result()  # raise if startup failed
        return self.tools

    def stop(self):
        """Signal the background task to shut down sessions."""
        self._stop.set()
