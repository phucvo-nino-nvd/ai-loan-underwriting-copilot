from typing import Final

from botocore.exceptions import ClientError

from src.client import DataAPIClient

STATEMENTS: Final[list[str]] = [
    'CREATE EXTENSION IF NOT EXISTS "uuid-ossp"',
    """CREATE TABLE IF NOT EXISTS users (
        clerk_user_id VARCHAR(255) PRIMARY KEY,
        display_name VARCHAR(255),
        role VARCHAR(50) DEFAULT 'underwriter',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS applicants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name VARCHAR(255) NOT NULL,
        income DECIMAL(12,2) NOT NULL,
        employment VARCHAR(50) NOT NULL CHECK (employment IN ('Full-time', 'Part-time', 'Self-employed', 'Contract', 'Retired', 'Unemployed')),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS applications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        applicant_id UUID NOT NULL REFERENCES applicants(id) ON DELETE CASCADE,
        case_id INTEGER,
        requested_amount DECIMAL(12,2) NOT NULL,
        status VARCHAR(50) DEFAULT 'not_assessed' CHECK (status IN ('not_assessed', 'running', 'completed')),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS assessments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        application_id UUID NOT NULL REFERENCES applications(id) ON DELETE CASCADE,
        clerk_user_id VARCHAR(255) REFERENCES users(clerk_user_id) ON DELETE SET NULL,
        probability DECIMAL(6,4) NOT NULL,
        risk_band VARCHAR(20) NOT NULL CHECK (risk_band IN ('LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH')),
        top_features JSONB NOT NULL DEFAULT '[]',
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS decisions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        assessment_id UUID NOT NULL REFERENCES assessments(id) ON DELETE CASCADE,
        clerk_user_id VARCHAR(255) NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
        decision VARCHAR(20) NOT NULL CHECK (decision IN ('approved', 'declined', 'referred')),
        rationale TEXT,
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS chat_sessions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        clerk_user_id VARCHAR(255) NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
        title VARCHAR(255),
        applicant_id UUID REFERENCES applicants(id) ON DELETE SET NULL,
        application_id UUID REFERENCES applications(id) ON DELETE SET NULL,
        assessment_id UUID REFERENCES assessments(id) ON DELETE SET NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS chat_messages (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
        role VARCHAR(20) NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
        content TEXT NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMP DEFAULT NOW()
    )""",
    """CREATE TABLE IF NOT EXISTS policy_documents (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        clerk_user_id VARCHAR(255) NOT NULL REFERENCES users(clerk_user_id) ON DELETE CASCADE,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        category VARCHAR(50),
        active BOOLEAN DEFAULT TRUE,
        created_at TIMESTAMP DEFAULT NOW(),
        updated_at TIMESTAMP DEFAULT NOW()
    )""",
    "CREATE INDEX IF NOT EXISTS idx_applications_applicant ON applications(applicant_id)",
    "CREATE INDEX IF NOT EXISTS idx_applications_status ON applications(status)",
    "CREATE UNIQUE INDEX IF NOT EXISTS idx_applications_case ON applications(case_id) WHERE case_id IS NOT NULL",
    "CREATE INDEX IF NOT EXISTS idx_assessments_application ON assessments(application_id)",
    "CREATE INDEX IF NOT EXISTS idx_assessments_user ON assessments(clerk_user_id)",
    "CREATE INDEX IF NOT EXISTS idx_decisions_assessment ON decisions(assessment_id)",
    "CREATE INDEX IF NOT EXISTS idx_chat_sessions_user ON chat_sessions(clerk_user_id)",
    "CREATE INDEX IF NOT EXISTS idx_chat_messages_session ON chat_messages(session_id)",
    "CREATE INDEX IF NOT EXISTS idx_policy_documents_user_active ON policy_documents(clerk_user_id, active)",
    """CREATE OR REPLACE FUNCTION update_updated_at_column()
    RETURNS TRIGGER AS $$
    BEGIN
        NEW.updated_at = NOW();
        RETURN NEW;
    END;
    $$ LANGUAGE plpgsql""",
    """CREATE TRIGGER update_users_updated_at BEFORE UPDATE ON users
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()""",
    """CREATE TRIGGER update_applicants_updated_at BEFORE UPDATE ON applicants
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()""",
    """CREATE TRIGGER update_applications_updated_at BEFORE UPDATE ON applications
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()""",
    """CREATE TRIGGER update_chat_sessions_updated_at BEFORE UPDATE ON chat_sessions
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()""",
    """CREATE TRIGGER update_policy_documents_updated_at BEFORE UPDATE ON policy_documents
        FOR EACH ROW EXECUTE FUNCTION update_updated_at_column()""",
]


def main() -> int:
    db = DataAPIClient()
    print("Running database migrations...")
    errors = 0

    for index, statement in enumerate(STATEMENTS, 1):
        first_line = next(line for line in statement.split("\n") if line.strip())[:70]
        print(f"[{index}/{len(STATEMENTS)}] {first_line}...")
        try:
            db.execute(statement)
        except ClientError as error:
            message = error.response["Error"]["Message"]
            if "already exists" in message.lower():
                print("  already exists, skipping")
            else:
                errors += 1
                print(f"  error: {message[:120]}")

    if errors:
        print(f"Migration completed with {errors} error(s).")
        return 1

    print("Migration completed successfully.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
