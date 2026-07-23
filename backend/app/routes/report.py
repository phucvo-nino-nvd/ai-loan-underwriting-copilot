import json
import uuid

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from fastapi_clerk_auth import HTTPAuthorizationCredentials
from pydantic import BaseModel

from ..deps import clerk_guard, get_case, get_explainer, get_models, load_conversation, save_conversation
from ..llm import prompt as P

router = APIRouter()

BUILDERS = {"report": P.build_report_prompt, "recommend": P.build_recommend_prompt}


class ReportRequest(BaseModel):
    case_id: int
    kind: str = "report"  # "report" | "recommend"
    session_id: str | None = None
    ai_config: dict | None = None

@router.post("/report")
def report(request: ReportRequest, creds: HTTPAuthorizationCredentials = Depends(clerk_guard)):
    """SSE stream of the report; probability + risk band come back in headers."""
    build = BUILDERS.get(request.kind)
    if build is None:
        raise HTTPException(status_code=400, detail=f"kind must be one of {list(BUILDERS)}")
    try:
        X = get_case(request.case_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown case_id {request.case_id}")

    probability = float(get_models().predict(X)[0])
    user_prompt = build(request.case_id, probability, get_explainer().top_features(X))

    user_id = creds.decoded["sub"]
    session_id = request.session_id or str(uuid.uuid4())
    conversation = load_conversation(user_id, session_id)

    def event_stream():
        parts = []
        for chunk in P.stream(user_prompt, history=conversation, ai_config=request.ai_config):
            parts.append(chunk)
            yield f"data: {json.dumps(chunk)}\n\n"
        save_conversation(user_id, session_id, conversation + [
            {"role": "user", "content": user_prompt},
            {"role": "assistant", "content": "".join(parts)},
        ])

    return StreamingResponse(event_stream(), media_type="text/event-stream", headers={
        "X-Session-Id": session_id,
        "X-Probability": f"{probability:.6f}",
        "X-Risk-Band": P.risk_band(probability),
    })
