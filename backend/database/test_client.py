from src.client import placeholder_for

def test_insert_casts_uuid_foreign_keys_without_casting_clerk_ids() -> None:
    assert placeholder_for("applicant_id", "00000000-0000-0000-0000-000000000001") == ":applicant_id::uuid"
    assert placeholder_for("application_id", "00000000-0000-0000-0000-000000000002") == ":application_id::uuid"
    assert placeholder_for("clerk_user_id", "user_001") == ":clerk_user_id"
