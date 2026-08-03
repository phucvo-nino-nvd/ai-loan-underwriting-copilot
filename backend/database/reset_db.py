import run_migrations
import seed_data
import verify_database

from src.client import DataAPIClient

TABLES = [
    "chat_messages",
    "chat_sessions",
    "decisions",
    "assessments",
    "applications",
    "applicants",
    "policy_documents",
    "users",
]


def main() -> int:
    db = DataAPIClient()
    for table in TABLES:
        db.execute(f"DROP TABLE IF EXISTS {table} CASCADE")
        print(f"Dropped {table}")
    db.execute("DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE")

    if code := run_migrations.main():
        return code
    seed_data.seed()
    return verify_database.main()


if __name__ == "__main__":
    raise SystemExit(main())
