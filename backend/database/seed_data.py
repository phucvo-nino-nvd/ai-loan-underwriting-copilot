from datetime import UTC, datetime, timedelta
from decimal import Decimal
from pathlib import Path

import math
import pandas as pd

from src import (
    ApplicantCreate,
    ApplicationCreate,
    ApplicationStatus,
    AssessmentCreate,
    Database,
    EmploymentType,
    JsonValue,
    PolicyDocumentCreate,
    RiskBand,
    UserCreate,
)

TEST_USER_ID = "test_user_001"

APPLICANTS: list[tuple[str, str, str, EmploymentType, ApplicationStatus]] = [
    ("Amara Okafor", "92000", "240000", "Full-time", "not_assessed"),
    ("Daniel Whitfield", "61000", "310000", "Self-employed", "not_assessed"),
    ("Priya Raman", "148000", "420000", "Full-time", "completed"),
    ("Tomás Herrera", "47000", "195000", "Contract", "not_assessed"),
    ("Grace Lindqvist", "205000", "380000", "Full-time", "completed"),
    ("Jamal Rickards", "38000", "210000", "Part-time", "not_assessed"),
    ("Wei Zhang", "118000", "265000", "Full-time", "not_assessed"),
    ("Rebecca Nolan", "54000", "330000", "Unemployed", "completed"),
    ("Hassan Baig", "87000", "175000", "Self-employed", "not_assessed"),
    ("Elise Moreau", "132000", "290000", "Full-time", "not_assessed"),
]

POLICIES = [
    (
        "Debt-to-Income Threshold",
        "Unsecured exposure above 4.0x gross annual income requires senior credit sign-off regardless of model output.",
        "affordability",
    ),
    (
        "Employment Verification",
        "Self-employed and contract applicants must evidence 24 months of trading history before approval.",
        "employment",
    ),
    (
        "High Risk Band Referral",
        "Applications scored HIGH or VERY_HIGH must be referred to manual underwriting; auto-decline is not permitted.",
        "risk",
    ),
    (
        "Model Advisory Status",
        "The PD model is decision-support only. The underwriter of record owns the final credit decision.",
        "governance",
    ),
]


ASSESSMENTS: list[tuple[str, Decimal, int]] = [
    ("Priya Raman", Decimal("0.1050"), 3),
    ("Grace Lindqvist", Decimal("0.0720"), 50),
    ("Rebecca Nolan", Decimal("0.4010"), 121),
]

# Same four keys /api/predict returns, so the workspace can render seeded rows like scored ones.
SEED_TOP_FEATURES = [
    {"feature": "credamount_770A", "value": 32000.0, "shap_value": 0.0412, "importance": 0.1200},
    {"feature": "maxdpdlast12m_727P", "value": 21.0, "shap_value": 0.0287, "importance": 0.0910},
    {"feature": "eir_270L", "value": 0.184, "shap_value": 0.0163, "importance": 0.0740},
    {"feature": "numactivecreds_622L", "value": 3.0, "shap_value": -0.0098, "importance": 0.0520},
]


def risk_band(probability: Decimal) -> RiskBand:
    if probability < Decimal("0.05"):
        return "LOW"
    if probability < Decimal("0.15"):
        return "MEDIUM"
    if probability < Decimal("0.35"):
        return "HIGH"
    return "VERY_HIGH"


def _clean_value(value: object) -> JsonValue:
    item_fn = getattr(value, "item", None)
    if item_fn is not None:
        value = item_fn()
    if isinstance(value, float) and not math.isfinite(value):
        return None
    if isinstance(value, (str, int, float, bool)) or value is None:
        return value
    return None


def seed() -> None:
    db = Database()

    parquet_path = Path(__file__).resolve().parents[2] / "output/curated/test_data.parquet"
    df = pd.read_parquet(parquet_path).set_index("case_id")

    sample_user = [{"name": "clerk_user_id", "value": {"stringValue": TEST_USER_ID}}]
    for sql in [
        """DELETE FROM chat_messages
        WHERE session_id IN (SELECT id FROM chat_sessions WHERE clerk_user_id = :clerk_user_id)""",
        "DELETE FROM chat_sessions WHERE clerk_user_id = :clerk_user_id",
        """DELETE FROM decisions
        WHERE assessment_id IN (SELECT id FROM assessments WHERE clerk_user_id = :clerk_user_id)""",
        "DELETE FROM assessments WHERE clerk_user_id = :clerk_user_id",
        "DELETE FROM policy_documents WHERE clerk_user_id = :clerk_user_id",
        "DELETE FROM users WHERE clerk_user_id = :clerk_user_id",
        "DELETE FROM applications",
        "DELETE FROM applicants",
    ]:
        db.client.execute(sql, sample_user)
    db.client.execute("DELETE FROM policy_documents")

    db.users.create(UserCreate(clerk_user_id=TEST_USER_ID, display_name="Test Underwriter"), returning="clerk_user_id")

    application_ids: dict[str, str] = {}
    parquet_case_ids: list[int] = [int(cid) for cid in df.index]
    # One applicant per parquet row: strict pairing, so adding a name without a row to back it
    # fails here instead of silently handing that applicant someone else's features.
    for case_id, (name, income, loan_amount, employment, status) in zip(parquet_case_ids, APPLICANTS, strict=True):
        applicant = ApplicantCreate(
            name=name,
            income=Decimal(income),
            employment=employment,
        )
        applicant_id = db.applicants.create(applicant)

        row_s = df.loc[case_id].astype(object)
        row_dict: dict[str, JsonValue] = {str(k): _clean_value(v) for k, v in row_s.items()}
        application_ids[name] = db.applications.create(
            ApplicationCreate(
                applicant_id=applicant_id,
                requested_amount=Decimal(loan_amount),
                case_id=case_id,
                status=status,
                metadata=row_dict,
            ),
        )

    for title, body, category in POLICIES:
        db.policy_documents.create(
            PolicyDocumentCreate(clerk_user_id=TEST_USER_ID, title=title, body=body, category=category)
        )

    # created_at defaults to NOW(), which would stack all three on the same second and leave
    # Assessment History nothing to sort by. Backdate them instead. NOW() is UTC, so this is too.
    now = datetime.now(UTC)
    for name, probability, hours_ago in ASSESSMENTS:
        db.assessments.create(
            AssessmentCreate(
                application_id=application_ids[name],
                probability=probability,
                risk_band=risk_band(probability),
                top_features=SEED_TOP_FEATURES,
            ),
            clerk_user_id=TEST_USER_ID,
            created_at=now - timedelta(hours=hours_ago),
        )

    print(
        f"Seeded 1 user, {len(APPLICANTS)} applicants, {len(APPLICANTS)} applications, "
        f"{len(ASSESSMENTS)} assessments, and {len(POLICIES)} policy documents."
    )


if __name__ == "__main__":
    seed()
