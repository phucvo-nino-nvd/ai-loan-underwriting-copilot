from typing import TypedDict

import json

from .ingest import (
    PolicyDocument,
    create_chunks,
    create_embeddings,
    delete_embeddings,
    documents_from_policies,
)


class IngestEvent(TypedDict, total=False):
    clerk_user_id: str
    documents: list[PolicyDocument]
    deleted_documents: list[PolicyDocument]


def lambda_handler(event: IngestEvent, _context: object) -> dict[str, int | str]:
    user = event.get("clerk_user_id", "")

    deleted = documents_from_policies(
        [{**doc, "clerk_user_id": doc.get("clerk_user_id") or user} for doc in event.get("deleted_documents", [])]
    )
    if deleted:
        delete_embeddings(create_chunks(deleted))

    documents = documents_from_policies(
        [{**doc, "clerk_user_id": doc.get("clerk_user_id") or user} for doc in event.get("documents", [])]
    )
    chunks = create_chunks(documents)
    create_embeddings(chunks)
    return {
        "statusCode": 200,
        "body": json.dumps({"documents": len(documents), "chunks": len(chunks)}),
    }
