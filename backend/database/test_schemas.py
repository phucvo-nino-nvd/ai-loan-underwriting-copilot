from decimal import Decimal
from pydantic import ValidationError

import pytest

from src import ApplicantCreate, ApplicationCreate, AssessmentCreate, ChatMessageCreate, DecisionCreate, PolicyDocumentCreate


def test_applicant_create_accepts_valid_input() -> None:
    applicant = ApplicantCreate(
        name="Priya Raman",
        income=Decimal("148000"),
        employment="Full-time",
    )

    assert applicant.name == "Priya Raman"


def test_applicant_create_rejects_negative_income() -> None:
    with pytest.raises(ValidationError):
        _ = ApplicantCreate(name="Bad", income=Decimal("-1"), employment="Full-time")


def test_application_create_accepts_valid_input() -> None:
    application = ApplicationCreate(
        applicant_id="00000000-0000-0000-0000-000000000001",
        requested_amount=Decimal("420000"),
        case_id=123,
    )

    assert application.requested_amount == Decimal("420000")


def test_application_create_rejects_negative_requested_amount() -> None:
    with pytest.raises(ValidationError):
        _ = ApplicationCreate(applicant_id="abc", requested_amount=Decimal("-1"))


def test_assessment_create_rejects_probability_above_one() -> None:
    with pytest.raises(ValidationError):
        _ = AssessmentCreate(application_id="abc", probability=Decimal("1.5"), risk_band="HIGH")


def test_decision_create_rejects_unknown_decision() -> None:
    with pytest.raises(ValidationError):
        _ = DecisionCreate.model_validate({"assessment_id": "abc", "decision": "maybe"})


def test_chat_message_create_rejects_empty_content() -> None:
    with pytest.raises(ValidationError):
        _ = ChatMessageCreate(session_id="abc", role="user", content="")


def test_policy_document_create_accepts_policy_body() -> None:
    policy = PolicyDocumentCreate(clerk_user_id="user_123", title="DTI", body="Policy body")

    assert policy.active is True
