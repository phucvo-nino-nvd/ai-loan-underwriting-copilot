"""Free-form Q&A over the internal policy knowledge base (RAG), with session memory."""
import json
import uuid

from fastapi import APIRouter, Depends
from fastapi.responses import StreamingResponse
from fastapi_clerk_auth import HTTPAuthorizationCredentials
from pydantic import BaseModel

from ..deps import MEMORY_DIR, clerk_guard, load_conversation, save_conversation
from ..llm.prompt import stream

router = APIRouter()


class ChatRequest(BaseModel):
    message: str
    session_id: str | None = None
    ai_config: dict | None = None

@router.post("/policy")
def policy(request: ChatRequest, creds: HTTPAuthorizationCredentials = Depends(clerk_guard)):
    """SSE stream of the answer; session id comes back in the X-Session-Id header."""
    user_id = creds.decoded["sub"]
    session_id = request.session_id or str(uuid.uuid4())
    conversation = load_conversation(user_id, session_id)

    def event_stream():
        parts = []
        for chunk in stream(request.message, history=conversation, ai_config=request.ai_config):
            parts.append(chunk)
            yield f"data: {json.dumps(chunk)}\n\n"
        save_conversation(user_id, session_id, conversation + [
            {"role": "user", "content": request.message},
            {"role": "assistant", "content": "".join(parts)},
        ])

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={"X-Session-Id": session_id},
    )


@router.get("/sessions")
def list_sessions(creds: HTTPAuthorizationCredentials = Depends(clerk_guard)):
    user_id = creds.decoded["sub"]
    return {"sessions": [
        {
            "session_id": p.stem.split("__", 1)[1],
            "message_count": len(c := json.loads(p.read_text(encoding="utf-8"))),
            "last_message": c[-1]["content"] if c else None,
        }
        for p in MEMORY_DIR.glob(f"{user_id}__*.json")
    ]}
