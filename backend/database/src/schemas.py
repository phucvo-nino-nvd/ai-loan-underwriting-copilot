from decimal import Decimal
from typing import ClassVar, Literal

from pydantic import BaseModel, ConfigDict, Field

EmploymentType = Literal["Full-time", "Part-time", "Self-employed", "Contract", "Retired", "Unemployed"]
ApplicationStatus = Literal["not_assessed", "running", "completed"]
RiskBand = Literal["LOW", "MEDIUM", "HIGH", "VERY_HIGH"]
DecisionType = Literal["approved", "declined", "referred"]
ChatRole = Literal["user", "assistant", "system"]
UserRole = Literal["underwriter", "senior_underwriter", "admin"]

type JsonValue = str | int | float | bool | None | list[JsonValue] | dict[str, JsonValue]


class FrozenModel(BaseModel):
    model_config: ClassVar[ConfigDict] = ConfigDict(frozen=True)


class UserCreate(FrozenModel):
    clerk_user_id: str = Field(min_length=1, max_length=255)
    display_name: str | None = Field(default=None, max_length=255)
    role: UserRole = "underwriter"


class ApplicantCreate(FrozenModel):
    name: str = Field(min_length=1, max_length=255)
    income: Decimal = Field(gt=0, decimal_places=2)
    employment: EmploymentType
    metadata: dict[str, JsonValue] | None = None


class ApplicationCreate(FrozenModel):
    applicant_id: str = Field(min_length=1)
    requested_amount: Decimal = Field(gt=0, decimal_places=2)
    case_id: int | None = None
    status: ApplicationStatus = "not_assessed"
    metadata: dict[str, JsonValue] | None = None


class AssessmentCreate(FrozenModel):
    application_id: str = Field(min_length=1)
    probability: Decimal = Field(ge=0, le=1, decimal_places=4)
    risk_band: RiskBand
    top_features: list[dict[str, JsonValue]] = Field(default_factory=list)


class DecisionCreate(FrozenModel):
    assessment_id: str = Field(min_length=1)
    decision: DecisionType
    rationale: str | None = None


class ChatSessionCreate(FrozenModel):
    title: str | None = Field(default=None, max_length=255)
    applicant_id: str | None = None
    application_id: str | None = None
    assessment_id: str | None = None


class ChatMessageCreate(FrozenModel):
    session_id: str = Field(min_length=1)
    role: ChatRole
    content: str = Field(min_length=1)
    metadata: dict[str, JsonValue] | None = None


class PolicyDocumentCreate(FrozenModel):
    clerk_user_id: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=255)
    body: str = Field(min_length=1)
    category: str | None = Field(default=None, max_length=50)
    active: bool = True
