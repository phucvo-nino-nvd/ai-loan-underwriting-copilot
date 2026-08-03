from src.client import DataAPIClient

def main() -> int:
    db = DataAPIClient()
    rows = db.query("SELECT 1 AS test_connection, current_database() AS database_name")
    if not rows:
        print("Data API query returned no rows.")
        return 1

    print(f"Data API connected to database: {rows[0]['database_name']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
