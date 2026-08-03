from __future__ import annotations

from decimal import Decimal
from functools import lru_cache
from pathlib import Path
from typing import Annotated, Any, Literal, TypedDict

from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest
from botocore.exceptions import ClientError
from dotenv import load_dotenv
from fastapi import Depends, FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, StreamingResponse
from fastapi_clerk_auth import (
    ClerkConfig,
    ClerkHTTPBearer,
    HTTPAuthorizationCredentials,
)
from pydantic import BaseModel

import boto3
import httpx
import json
import logging
import os
import uuid

from src import (
    ApplicantCreate,
    ApplicationCreate,
    AssessmentCreate,
    ChatMessageCreate,
    ChatSessionCreate,
    Database,
    DecisionCreate,
    PolicyDocumentCreate,
)

load_dotenv(override=True)

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# ---------------------------------------------------------------------------
# Configuration (from Lambda environment variables)
# ---------------------------------------------------------------------------
REGION = os.getenv("DEFAULT_AWS_REGION", os.getenv("AWS_REGION", "us-east-1"))
CLASSIFIER_ENDPOINT = os.getenv("CLASSIFIER_ENDPOINT_NAME")
COPILOT_URL = os.getenv("COPILOT_URL", "").rstrip("/")
INGEST_LAMBDA_NAME = os.getenv("INGEST_LAMBDA_NAME", "")

# Risk band thresholds, matching copilot/prompt.py.
BANDS = ((0.10, "LOW"), (0.30, "MEDIUM"), (0.60, "HIGH"), (1.01, "VERY HIGH"))

ALLOWED_EXTENSIONS = {".md"}

# Anything the underwriter has not run yet reads as "Not Assessed".
STATUS_LABELS = {"completed": "Completed", "running": "Running"}

# ---------------------------------------------------------------------------
# App + auth + database
# ---------------------------------------------------------------------------
app = FastAPI(title="Aluci Copilot API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=os.getenv("CORS_ORIGINS", "http://localhost:3000").split(","),
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
    expose_headers=["X-Session-Id"],
)

@app.middleware("http")
async def clerk_token_header(request: Request, call_next):
    """CloudFront's OAC signature owns Authorization, so the Clerk token rides X-Clerk-Token."""
    token = request.headers.get("x-clerk-token")
    if token:
        request.scope["headers"] = [
            (name, value) for name, value in request.scope["headers"] if name != b"authorization"
        ] + [(b"authorization", token.encode())]
    return await call_next(request)


clerk_bearer = ClerkHTTPBearer(ClerkConfig(jwks_url=os.getenv("CLERK_JWKS_URL")))

db = Database()


@lru_cache(maxsize=1024)
def _ensure_user(user_id: str) -> None:
    db.users.ensure(user_id)


def clerk_guard(creds: HTTPAuthorizationCredentials = Depends(clerk_bearer)) -> HTTPAuthorizationCredentials:
    """Clerk owns the accounts, so first sight of a token is what creates the users row."""
    _ensure_user(creds.decoded["sub"])
    return creds

sagemaker_runtime = boto3.client("sagemaker-runtime", region_name=REGION)
lambda_client = boto3.client("lambda", region_name=REGION)


def risk_band(probability: float) -> str:
    return next((label for ceiling, label in BANDS if probability < ceiling), "VERY HIGH")


# ---------------------------------------------------------------------------
# Classifier (SageMaker)
# ---------------------------------------------------------------------------
def classify(features: dict, top_k: int = 10) -> tuple[float, list[dict]]:
    """Call the SageMaker classifier; returns (probability, top_features)."""
    if not CLASSIFIER_ENDPOINT:
        raise HTTPException(status_code=503, detail="CLASSIFIER_ENDPOINT_NAME not configured")
    payload = {"instances": [features], "top_k": top_k}
    try:
        response = sagemaker_runtime.invoke_endpoint(
            EndpointName=CLASSIFIER_ENDPOINT,
            ContentType="application/json",
            Body=json.dumps(payload),
        )
    except ClientError as exc:
        logger.error("Classifier endpoint error: %s", exc)
        raise HTTPException(status_code=502, detail="Classifier endpoint error")
    data = json.loads(response["Body"].read())
    return float(data["probabilities"][0]), list(data.get("top_features", []))


# ---------------------------------------------------------------------------
# Copilot relay (SSE over POST to the agent Lambda Function URL)
# ---------------------------------------------------------------------------
class PolicyPayload(TypedDict):
    """One document as the ingest Lambda expects it."""

    id: str
    clerk_user_id: str
    title: str
    body: str
    category: str


def policy_payload(row: dict, user_id: str) -> PolicyPayload:
    return {
        "id": str(row["id"]),
        "clerk_user_id": user_id,
        "title": str(row["title"]),
        "body": str(row["body"]),
        "category": str(row.get("category") or ""),
    }


async def stream_copilot(path: str, payload: dict):
    """POST a payload to a Copilot Lambda endpoint and relay its SSE stream.

    The Copilot Function URL is AWS_IAM-authenticated, so the request carries a
    SigV4 signature over these exact body bytes. Send them with `content=`;
    re-serialising with `json=` would break the signature.
    """
    url = f"{COPILOT_URL}{path}"
    body = json.dumps(payload).encode()
    signed = AWSRequest(method="POST", url=url, data=body, headers={"Content-Type": "application/json"})
    SigV4Auth(boto3.Session().get_credentials(), "lambda", REGION).add_auth(signed)

    async with httpx.AsyncClient(timeout=None) as client:
        async with client.stream("POST", url, content=body, headers=dict(signed.headers)) as response:
            response.raise_for_status()
            async for line in response.aiter_lines():
                if line:  # reconstruct SSE events: "data: {json}\n\n"
                    yield line + "\n\n"


def _reindex_policies(user_id: str, deleted: list[PolicyPayload] | None = None) -> None:
    if not INGEST_LAMBDA_NAME:
        logger.warning("INGEST_LAMBDA_NAME not configured; skipping policy re-ingestion")
        return

    # ponytail: active policy docs are small; move bodies to S3 if Lambda event size becomes a ceiling.
    lambda_client.invoke(
        FunctionName=INGEST_LAMBDA_NAME,
        InvocationType="Event",
        Payload=json.dumps({
            "clerk_user_id": user_id,
            "documents": [policy_payload(row, user_id) for row in db.policy_documents.find_active(user_id)],
            "deleted_documents": deleted or [],
        }).encode("utf-8"),
    )


# ---------------------------------------------------------------------------
# Chat sessions/messages (Aurora)
# ---------------------------------------------------------------------------
def _valid_assessment(assessment_id: str | None) -> str | None:
    """404 unless the assessment exists — the session row points at it. Guards the UUID cast too.

    No ownership check: assessments are shared (`/api/assessments` returns the whole book), while
    conversations stay private through `clerk_user_id` on chat_sessions."""
    if assessment_id is None:
        return None
    try:
        uuid.UUID(assessment_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Assessment not found")
    if not db.assessments.find_by_id(assessment_id):
        raise HTTPException(status_code=404, detail="Assessment not found")
    return assessment_id


def _resolve_session(user_id: str, session_id: str | None, title: str, assessment_id: str | None = None) -> str:
    if session_id:
        try:
            uuid.UUID(session_id)
        except (ValueError, AttributeError, TypeError):
            session_id = None
        else:
            existing = db.chat_sessions.find_by_id(session_id)
            if existing and existing.get("clerk_user_id") == user_id:
                return session_id
    return db.chat_sessions.create(
        ChatSessionCreate(title=title, assessment_id=_valid_assessment(assessment_id)),
        clerk_user_id=user_id,
    )


def _owned_session(user_id: str, session_id: str) -> dict:
    """404 unless the session exists and belongs to the caller. Guards the UUID cast too."""
    try:
        uuid.UUID(session_id)
    except ValueError:
        raise HTTPException(status_code=404, detail="Session not found")
    session = db.chat_sessions.find_by_id(session_id)
    if not session:
        raise HTTPException(status_code=404, detail="Session not found")
    if session.get("clerk_user_id") != user_id:
        raise HTTPException(status_code=403, detail="Not authorized")
    return session


def _history(session_id: str) -> list[dict]:
    """The turns the copilot replays. Citations live in `metadata` and only the UI reads them."""
    rows = db.chat_messages.find_by_session(session_id)
    return [{"role": row["role"], "content": row["content"]} for row in rows]


def _save_message(session_id: str, role: str, content: str, sources: list[str] | None = None) -> None:
    metadata = {"sources": sources} if sources else None
    db.chat_messages.create(ChatMessageCreate(session_id=session_id, role=role, content=content, metadata=metadata))


async def _saved_copilot_stream(
    path: str,
    payload: dict,
    session_id: str,
):
    """Relay Copilot SSE and persist the accumulated assistant reply in Aurora."""
    parts = []
    # Each sources event carries every citation so far, so the last one wins — assign, not extend.
    sources: list[str] = []
    try:
        async for line in stream_copilot(path, payload):
            if line.startswith("data: "):
                try:
                    chunk = json.loads(line[6:])
                except json.JSONDecodeError:
                    chunk = None
                if isinstance(chunk, dict):
                    if chunk.get("type") == "content":
                        parts.append(chunk["content"])
                    elif chunk.get("type") == "sources":
                        sources = chunk["sources"]
            yield line
    finally:
        if parts:
            _save_message(session_id, "assistant", "".join(parts), sources)

# ---------------------------------------------------------------------------
# Routes
# ---------------------------------------------------------------------------
@app.get("/health")
def health() -> dict:
    return {
        "service": "Aluci Copilot API",
        "status": "healthy",
        "classifier_configured": bool(CLASSIFIER_ENDPOINT),
        "copilot_configured": bool(COPILOT_URL),
        "ingest_configured": bool(INGEST_LAMBDA_NAME),
        "aurora_configured": bool(os.getenv("AURORA_CLUSTER_ARN") and os.getenv("AURORA_SECRET_ARN")),
    }


class HistoryAssessmentCreate(BaseModel):
    applicant: ApplicantCreate
    case_id: int
    requested_amount: Decimal
    probability: float
    risk_band: str
    top_features: list[dict[str, Any]]

@app.get("/api/assessments")
def get_assessments(creds: HTTPAuthorizationCredentials = Depends(clerk_guard)):
    sql = """
        SELECT
            a.id,
            loan.id as application_id,
            loan.requested_amount,
            a.created_at,
            a.probability,
            a.risk_band,
            a.top_features,
            app.id as applicant_id,
            app.name as applicant_name,
            loan.case_id,
            d.decision
        FROM assessments a
        JOIN applications loan ON a.application_id = loan.id
        JOIN applicants app ON loan.applicant_id = app.id
        LEFT JOIN decisions d
            ON d.assessment_id = a.id
            AND d.id = (SELECT id FROM decisions WHERE assessment_id = a.id ORDER BY created_at DESC LIMIT 1)
        ORDER BY a.created_at DESC
    """
    return {"assessments": [
        {
            "id": str(row["id"]),
            "applicationId": str(row["application_id"]),
            "caseId": int(row["case_id"]) if row.get("case_id") else 0,
            "applicantId": str(row["applicant_id"]),
            "applicantName": str(row["applicant_name"]),
            "requestedAmount": float(row["requested_amount"]),
            "createdAt": str(row["created_at"]),
            "probability": float(row["probability"]),
            "risk_band": str(row["risk_band"]).replace("_", " "),
            "top_features": row.get("top_features", []),
            "decision": str(row["decision"]).capitalize() if row.get("decision") else None,
        }
        for row in db.client.query(sql)
    ]}

@app.get("/api/applications")
def get_applications(creds: HTTPAuthorizationCredentials = Depends(clerk_guard)):
    sql = """
        SELECT 
            loan.id as application_id,
            loan.case_id,
            loan.requested_amount,
            loan.status,
            app.id as applicant_id,
            app.name as applicant_name,
            app.income,
            app.employment
        FROM applications loan
        JOIN applicants app ON loan.applicant_id = app.id
        ORDER BY loan.created_at DESC
    """
    return {"applications": [
        {
            "id": str(row["applicant_id"]),
            "applicationId": str(row["application_id"]),
            "caseId": int(row["case_id"]) if row.get("case_id") else 0,
            "name": str(row["applicant_name"]),
            "income": float(row["income"]),
            "loan_amount": float(row["requested_amount"]),
            "employment": str(row["employment"]),
            "status": STATUS_LABELS.get(str(row.get("status")), "Not Assessed"),
        }
        for row in db.client.query(sql)
    ]}

@app.post("/api/assessments")
def create_assessment(request: HistoryAssessmentCreate, creds: HTTPAuthorizationCredentials = Depends(clerk_guard)):
    user_id = creds.decoded["sub"]

    application = db.applications.find_by_case_id(request.case_id)
    if application:
        applicant_id = str(application["applicant_id"])
        application_id = str(application["id"])
    else:
        applicant_id = db.applicants.create(request.applicant)
        application_id = db.applications.create(
            ApplicationCreate(
                applicant_id=applicant_id,
                requested_amount=request.requested_amount,
                case_id=request.case_id,
                status="completed",
            ),
        )

    new_ass = AssessmentCreate(
        application_id=application_id,
        probability=Decimal(str(request.probability)).quantize(Decimal("0.0001")),
        risk_band=request.risk_band.replace(" ", "_"),
        top_features=request.top_features,
    )
    ass_id = db.assessments.create(new_ass, clerk_user_id=user_id)

    _ = db.applications.update_status(applicant_id, application_id, "completed")
    return {"id": ass_id, "applicationId": application_id, "applicantId": applicant_id}

@app.post("/api/decisions")
def create_decision(request: DecisionCreate, creds: HTTPAuthorizationCredentials = Depends(clerk_guard)):
    user_id = creds.decoded["sub"]
    exists = db.client.query_one(
        "SELECT id FROM assessments WHERE id = :assessment_id::uuid",
        [{"name": "assessment_id", "value": {"stringValue": request.assessment_id}}],
    )
    if not exists:
        raise HTTPException(status_code=404, detail="Assessment not found")
    db.decisions.create(request, clerk_user_id=user_id)
    return {"ok": True}

class PredictRequest(BaseModel):
    case_id: int
    top_k: int = 10


class PredictResponse(BaseModel):
    case_id: int
    probability: float
    risk_band: str
    top_features: list[dict]


@app.post("/api/predict", response_model=PredictResponse)
def predict(
    request: PredictRequest,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
) -> PredictResponse:
    application = db.applications.find_by_case_id(request.case_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")

    features = application.get("metadata", {})
    if not features:
        raise HTTPException(status_code=400, detail="No ML features found in application metadata")

    probability, top_features = classify(features, top_k=request.top_k)
    return PredictResponse(
        case_id=request.case_id,
        probability=probability,
        risk_band=risk_band(probability),
        top_features=top_features,
    )


class ReportRequest(BaseModel):
    case_id: int
    kind: Literal["report", "recommend"] = "report"
    session_id: str | None = None
    assessment_id: str | None = None
    ai_config: dict | None = None


@app.post("/api/report")
def report(request: ReportRequest, creds: HTTPAuthorizationCredentials = Depends(clerk_guard)):
    """SSE stream of the report; the session id comes back in the X-Session-Id header."""
    if not COPILOT_URL:
        raise HTTPException(status_code=503, detail="COPILOT_URL not configured")

    application = db.applications.find_by_case_id(request.case_id)
    if not application:
        raise HTTPException(status_code=404, detail="Application not found")
    features = application.get("metadata", {})
    if not features:
        raise HTTPException(status_code=400, detail="No ML features found in application metadata")
    probability, top_features = classify(features)

    user_id = creds.decoded["sub"]
    session_id = _resolve_session(
        user_id, request.session_id, f"Report case {request.case_id}", request.assessment_id
    )

    # Save a small user-facing message (report case N) instead of building the whole prompt
    _save_message(session_id, "user", f"{request.kind.capitalize()} case {request.case_id}")
    history = _history(session_id)

    return StreamingResponse(
        _saved_copilot_stream(
            f"/{request.kind}",
            {
                "case_id": request.case_id,
                "clerk_user_id": user_id,
                "probability": probability,
                "risk_band": risk_band(probability),
                "top_features": top_features,
                "history": history,
                "ai_config": request.ai_config,
            },
            session_id,
        ),
        media_type="text/event-stream",
        headers={"X-Session-Id": session_id},
    )


class ChatRequest(BaseModel):
    message: str
    context: str | None = None
    session_id: str | None = None
    assessment_id: str | None = None
    ai_config: dict | None = None


@app.post("/api/policy")
def policy(request: ChatRequest, creds: HTTPAuthorizationCredentials = Depends(clerk_guard)):
    """SSE stream of the answer; session id comes back in the X-Session-Id header."""
    if not COPILOT_URL:
        raise HTTPException(status_code=503, detail="COPILOT_URL not configured")

    user_id = creds.decoded["sub"]
    session_id = _resolve_session(user_id, request.session_id, request.message[:80], request.assessment_id)
    _save_message(session_id, "user", request.message)
    history = _history(session_id)

    return StreamingResponse(
        _saved_copilot_stream(
            "/chat",
            {
                "prompt": request.message,
                "clerk_user_id": user_id,
                "context": request.context,
                "history": history,
                "ai_config": request.ai_config,
            },
            session_id,
        ),
        media_type="text/event-stream",
        headers={"X-Session-Id": session_id},
    )


@app.get("/api/sessions")
def list_sessions(
    assessment_id: str | None = None,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
) -> dict:
    """Conversations for one assessment, or the portfolio ones when no assessment is named."""
    user_id = creds.decoded["sub"]
    _valid_assessment(assessment_id)
    return {"sessions": [
        {
            "session_id": row["id"],
            "title": row.get("title"),
            "message_count": row["message_count"],
            "last_message": row.get("last_message"),
            "last_at": row["last_at"],
        }
        for row in db.chat_sessions.find_by_user(user_id, assessment_id)
    ]}


@app.get("/api/sessions/{session_id}")
def get_session(session_id: str, creds: HTTPAuthorizationCredentials = Depends(clerk_guard)) -> dict:
    _owned_session(creds.decoded["sub"], session_id)
    return {"messages": [
        {"role": row["role"], "content": row["content"], "sources": (row.get("metadata") or {}).get("sources")}
        for row in db.chat_messages.find_by_session(session_id)
    ]}


@app.delete("/api/sessions/{session_id}")
def delete_session(session_id: str, creds: HTTPAuthorizationCredentials = Depends(clerk_guard)):
    _owned_session(creds.decoded["sub"], session_id)
    db.chat_sessions.delete(session_id)
    return {"message": "Session deleted"}


@app.get("/api/rag/documents")
def list_documents(creds: HTTPAuthorizationCredentials = Depends(clerk_guard)) -> dict:
    user_id = creds.decoded["sub"]
    docs = db.policy_documents.find_active(user_id)
    return {"documents": [
        {"id": doc["id"], "title": doc["title"], "category": doc.get("category")}
        for doc in docs
    ]}


@app.post("/api/rag/upload")
async def upload_document(
    file: Annotated[UploadFile, File()],
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
):
    """Accept a policy document, persist metadata in Aurora, then trigger re-indexing."""
    filename = file.filename
    if not filename:
        raise HTTPException(status_code=400, detail="Missing filename.")

    ext = Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(sorted(ALLOWED_EXTENSIONS))}",
        )

    content = (await file.read()).decode("utf-8")
    user_id = creds.decoded["sub"]
    db.policy_documents.create(
        PolicyDocumentCreate(clerk_user_id=user_id, title=filename, body=content, category="policy")
    )
    _reindex_policies(user_id)
    return JSONResponse(
        content={"message": f"'{filename}' uploaded; re-indexing started.", "file": filename},
        status_code=201,
    )


@app.delete("/api/rag/documents/{document_id}")
def delete_document(
    document_id: str,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
) -> dict:
    user_id = creds.decoded["sub"]
    doc = db.policy_documents.find_owned(user_id, document_id)
    if not doc:
        raise HTTPException(status_code=404, detail=f"Document '{document_id}' not found.")
    db.policy_documents.delete_owned(user_id, document_id)
    _reindex_policies(user_id, deleted=[policy_payload(doc, user_id)])
    return {"message": f"'{doc.get('title')}' deleted and vector store updated."}


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("api.main:app", host="0.0.0.0", port=8000)
