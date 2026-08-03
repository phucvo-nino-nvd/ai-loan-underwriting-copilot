from src.client import DataAPIClient

TABLES = [
    "users",
    "applicants",
    "applications",
    "assessments",
    "decisions",
    "chat_sessions",
    "chat_messages",
    "policy_documents",
]


def main() -> int:
    db = DataAPIClient()
    print("Aluci database verification")
    print("=" * 40)

    for table in TABLES:
        rows = db.query(f"SELECT COUNT(*) AS count FROM {table}")
        print(f"{table}: {rows[0]['count'] if rows else 0} records")

    indexes = db.query("SELECT indexname FROM pg_indexes WHERE schemaname = 'public' AND indexname LIKE 'idx_%'")
    triggers = db.query("SELECT trigger_name FROM information_schema.triggers WHERE trigger_schema = 'public'")

    print(f"indexes: {len(indexes)}")
    print(f"triggers: {len(triggers)}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
