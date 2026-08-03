from datetime import date, datetime
from decimal import Decimal
from typing import Any

from dotenv import load_dotenv

import boto3
import json
import os

load_dotenv(override=True)

type DbRow = dict[str, Any]

UUID_REFERENCE_COLUMNS = {"applicant_id", "application_id", "assessment_id", "session_id"}


def placeholder_for(column: str, value: object) -> str:
    """Data API sends everything as a string, so cast non-text columns in SQL."""
    if isinstance(value, (dict, list)):
        return f":{column}::jsonb"
    if column in UUID_REFERENCE_COLUMNS:
        return f":{column}::uuid"
    if isinstance(value, Decimal):
        return f":{column}::numeric"
    if isinstance(value, date) and not isinstance(value, datetime):
        return f":{column}::date"
    if isinstance(value, datetime):
        return f":{column}::timestamp"
    return f":{column}"


class DataAPIClient:
    """Wrapper for AWS RDS Data API to simplify database operations"""

    def __init__(
        self,
        cluster_arn: str | None = None,
        secret_arn: str | None = None,
        database: str | None = None,
        region: str | None = None,
    ):
        """Each argument falls back to its AURORA_* / DEFAULT_AWS_REGION env var."""
        self.cluster_arn = cluster_arn or os.environ.get("AURORA_CLUSTER_ARN")
        self.secret_arn = secret_arn or os.environ.get("AURORA_SECRET_ARN")
        self.database = database or os.environ.get("AURORA_DATABASE", "aluci")

        if not self.cluster_arn or not self.secret_arn:
            raise ValueError(
                "Missing required Aurora configuration. "
                "Set AURORA_CLUSTER_ARN and AURORA_SECRET_ARN environment variables."
            )

        self.region = region or os.environ.get("DEFAULT_AWS_REGION") or os.environ.get("AWS_REGION", "us-east-1")
        self.client = boto3.client("rds-data", region_name=self.region)

    def execute(self, sql: str, parameters: list[DbRow] | None = None) -> dict[str, Any]:
        """Execute a SQL statement and return the raw Data API response."""
        return self.client.execute_statement(
            resourceArn=self.cluster_arn,
            secretArn=self.secret_arn,
            database=self.database,
            sql=sql,
            includeResultMetadata=True,
            parameters=parameters or [],
        )

    def query(self, sql: str, parameters: list[DbRow] | None = None) -> list[DbRow]:
        """Execute a SELECT and return the rows as dicts keyed by column name."""
        response = self.execute(sql, parameters)

        if "records" not in response:
            return []

        columns = [col["name"] for col in response.get("columnMetadata", [])]
        return [
            {col: self._extract_value(record[i]) for i, col in enumerate(columns)}
            for record in response["records"]
        ]

    def query_one(self, sql: str, parameters: list[DbRow] | None = None) -> DbRow | None:
        """Execute a SELECT and return its first row, or None."""
        results = self.query(sql, parameters)
        return results[0] if results else None

    def insert(self, table: str, data: DbRow, returning: str = "id") -> str:
        """Insert one record and return its `returning` column."""
        columns = list(data.keys())
        placeholders = [placeholder_for(col, data[col]) for col in columns]

        sql = f"""
            INSERT INTO {table} ({", ".join(columns)})
            VALUES ({", ".join(placeholders)})
            RETURNING {returning}
        """
        response = self.execute(sql, self._build_parameters(data))

        records = response.get("records")
        if not records:
            raise RuntimeError(f"insert into {table} did not return {returning}")
        return str(self._extract_value(records[0][0]))

    def update(self, table: str, data: DbRow, where: str, where_params: DbRow | None = None) -> int:
        """Update rows matching `where` (written without the WHERE keyword)."""
        set_clause = ", ".join(f"{col} = {placeholder_for(col, val)}" for col, val in data.items())

        sql = f"""
            UPDATE {table}
            SET {set_clause}
            WHERE {where}
        """
        parameters = self._build_parameters({**data, **(where_params or {})})

        response = self.execute(sql, parameters)
        return response.get("numberOfRecordsUpdated", 0)

    def delete(self, table: str, where: str, where_params: DbRow | None = None) -> int:
        """Delete rows matching `where` (written without the WHERE keyword)."""
        sql = f"DELETE FROM {table} WHERE {where}"
        parameters = self._build_parameters(where_params) if where_params else None

        response = self.execute(sql, parameters)
        return response.get("numberOfRecordsUpdated", 0)

    def _build_parameters(self, data: DbRow) -> list[DbRow]:
        """Convert dictionary to Data API parameter format"""
        if not data:
            return []

        parameters: list[DbRow] = []
        for key, value in data.items():
            param: DbRow = {"name": key}

            if value is None:
                param["value"] = {"isNull": True}
            elif isinstance(value, bool):
                param["value"] = {"booleanValue": value}
            elif isinstance(value, int):
                param["value"] = {"longValue": value}
            elif isinstance(value, float):
                param["value"] = {"doubleValue": value}
            elif isinstance(value, Decimal):
                param["value"] = {"stringValue": str(value)}
            elif isinstance(value, (date, datetime)):
                param["value"] = {"stringValue": value.isoformat()}
            elif isinstance(value, (dict, list)):
                param["value"] = {"stringValue": json.dumps(value)}
            else:
                param["value"] = {"stringValue": str(value)}

            parameters.append(param)

        return parameters

    def _extract_value(self, field: DbRow) -> Any:
        """Extract value from Data API field response"""
        if field.get("isNull"):
            return None
        elif "booleanValue" in field:
            return field["booleanValue"]
        elif "longValue" in field:
            return field["longValue"]
        elif "doubleValue" in field:
            return field["doubleValue"]
        elif "stringValue" in field:
            value = field["stringValue"]
            # Try to parse JSON if it looks like JSON
            if value and value[0] in ["{", "["]:
                try:
                    return json.loads(value)
                except json.JSONDecodeError:
                    pass
            return value
        elif "blobValue" in field:
            return field["blobValue"]
        else:
            return None
