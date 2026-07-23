from fastapi import APIRouter, Depends, HTTPException
from fastapi_clerk_auth import HTTPAuthorizationCredentials
from pydantic import BaseModel

from ..deps import clerk_guard, get_case, get_explainer, get_features, get_models
from ..llm.prompt import risk_band

router = APIRouter()


class PredictRequest(BaseModel):
    case_id: int
    top_k: int = 10


class PredictResponse(BaseModel):
    case_id: int
    probability: float
    risk_band: str
    top_features: list[dict]


@router.get("/cases")
def list_cases(creds: HTTPAuthorizationCredentials = Depends(clerk_guard)):
    return {"case_ids": get_features().index.tolist()}


@router.post("/predict", response_model=PredictResponse)
def predict(
    request: PredictRequest,
    creds: HTTPAuthorizationCredentials = Depends(clerk_guard),
) -> PredictResponse:
    try:
        X = get_case(request.case_id)
    except KeyError:
        raise HTTPException(status_code=404, detail=f"Unknown case_id {request.case_id}")

    probability = float(get_models().predict(X)[0])
    return PredictResponse(
        case_id=request.case_id,
        probability=probability,
        risk_band=risk_band(probability),
        top_features=get_explainer().top_features(X, top_k=request.top_k),
    )
