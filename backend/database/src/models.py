from .client import DataAPIClient, DbRow
from .schemas import ApplicationStatus, FrozenModel


class Table:
    def __init__(self, db: DataAPIClient, table: str):
        self.db: DataAPIClient = db
        self.table: str = table

    def create(self, payload: FrozenModel, returning: str = "id", **extra: object) -> str:
        return self.db.insert(self.table, payload.model_dump(exclude_none=True) | extra, returning)

    def find_by_id(self, row_id: str) -> DbRow | None:
        sql = f"SELECT * FROM {self.table} WHERE id = :id::uuid"
        return self.db.query_one(sql, [{"name": "id", "value": {"stringValue": row_id}}])

    def delete(self, row_id: str) -> int:
        return self.db.delete(self.table, "id = :id::uuid", {"id": row_id})


class Users(Table):
    def ensure(self, clerk_user_id: str) -> None:
        """Guarantee the row every other table's clerk_user_id foreign key points at."""
        sql = "INSERT INTO users (clerk_user_id) VALUES (:clerk_user_id) ON CONFLICT DO NOTHING"
        self.db.execute(sql, [{"name": "clerk_user_id", "value": {"stringValue": clerk_user_id}}])


class Applications(Table):
    def find_by_case_id(self, case_id: int) -> DbRow | None:
        sql = "SELECT * FROM applications WHERE case_id = :case_id LIMIT 1"
        return self.db.query_one(sql, [{"name": "case_id", "value": {"longValue": case_id}}])

    def update_status(self, applicant_id: str, application_id: str, status: ApplicationStatus) -> int:
        return self.db.update(
            self.table,
            {"status": status},
            "applicant_id = :applicant_id::uuid AND id = :application_id::uuid",
            {"applicant_id": applicant_id, "application_id": application_id},
        )


class ChatSessions(Table):
    def find_by_user(self, clerk_user_id: str, assessment_id: str | None = None) -> list[DbRow]:
        """One row per conversation with its message tally, newest activity first.

        chat_sessions.updated_at never moves — the trigger only fires on UPDATE and a new
        message only touches chat_messages — so the ordering key is the last message instead.

        Scoped to one assessment, or to the sessions belonging to no assessment at all, so the
        portfolio list and each workspace list stay disjoint.
        """
        params = [{"name": "clerk_user_id", "value": {"stringValue": clerk_user_id}}]
        if assessment_id is None:
            scope = "s.assessment_id IS NULL"
        else:
            scope = "s.assessment_id = :assessment_id::uuid"
            params.append({"name": "assessment_id", "value": {"stringValue": assessment_id}})

        sql = f"""
            SELECT s.id, s.title,
                   COALESCE(m.message_count, 0) AS message_count,
                   m.last_message,
                   COALESCE(m.last_at, s.created_at) AS last_at
            FROM chat_sessions s
            LEFT JOIN LATERAL (
                SELECT COUNT(*) AS message_count,
                       MAX(created_at) AS last_at,
                       (ARRAY_AGG(content ORDER BY created_at DESC))[1] AS last_message
                FROM chat_messages
                WHERE session_id = s.id
            ) m ON TRUE
            WHERE s.clerk_user_id = :clerk_user_id AND {scope}
            ORDER BY last_at DESC
        """
        return self.db.query(sql, params)


class ChatMessages(Table):
    def find_by_session(self, session_id: str) -> list[DbRow]:
        sql = "SELECT * FROM chat_messages WHERE session_id = :session_id::uuid ORDER BY created_at"
        return self.db.query(sql, [{"name": "session_id", "value": {"stringValue": session_id}}])


class PolicyDocuments(Table):
    def find_active(self, clerk_user_id: str) -> list[DbRow]:
        sql = """
            SELECT * FROM policy_documents
            WHERE clerk_user_id = :clerk_user_id AND active = TRUE
            ORDER BY id
        """
        return self.db.query(sql, [{"name": "clerk_user_id", "value": {"stringValue": clerk_user_id}}])

    def find_owned(self, clerk_user_id: str, document_id: str) -> DbRow | None:
        sql = """
            SELECT * FROM policy_documents
            WHERE clerk_user_id = :clerk_user_id AND id = :id::uuid
        """
        params: list[DbRow] = [
            {"name": "clerk_user_id", "value": {"stringValue": clerk_user_id}},
            {"name": "id", "value": {"stringValue": document_id}},
        ]
        return self.db.query_one(sql, params)

    def delete_owned(self, clerk_user_id: str, document_id: str) -> int:
        return self.db.delete(
            self.table,
            "clerk_user_id = :clerk_user_id AND id = :id::uuid",
            {"clerk_user_id": clerk_user_id, "id": document_id},
        )


class Database:
    def __init__(
        self,
        cluster_arn: str | None = None,
        secret_arn: str | None = None,
        database: str | None = None,
        region: str | None = None,
    ):
        self.client: DataAPIClient = DataAPIClient(cluster_arn, secret_arn, database, region)
        self.users: Users = Users(self.client, "users")
        self.applicants: Table = Table(self.client, "applicants")
        self.applications: Applications = Applications(self.client, "applications")
        self.assessments: Table = Table(self.client, "assessments")
        self.decisions: Table = Table(self.client, "decisions")
        self.chat_sessions: ChatSessions = ChatSessions(self.client, "chat_sessions")
        self.chat_messages: ChatMessages = ChatMessages(self.client, "chat_messages")
        self.policy_documents: PolicyDocuments = PolicyDocuments(self.client, "policy_documents")
