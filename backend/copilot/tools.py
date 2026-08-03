from __future__ import annotations

from pathlib import Path

from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings

import boto3
import os

load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env", override=True)

VECTOR_BUCKET = os.getenv("VECTOR_BUCKET", "aluci-vectors")
INDEX_NAME = os.getenv("INDEX_NAME", "policy-docs")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
EMBEDDING_MODEL = "openai/text-embedding-3-small"
s3_vectors = boto3.client("s3vectors")
embeddings = OpenAIEmbeddings(
    model=os.getenv("OPENROUTER_EMBEDDING_MODEL", EMBEDDING_MODEL),
    api_key=lambda: os.environ["OPENROUTER_API_KEY"],
    base_url=os.getenv("OPENROUTER_BASE_URL", OPENROUTER_BASE_URL),
)


def search_vectors(query: str, clerk_user_id: str, k: int = 10) -> list[str]:
    response = s3_vectors.query_vectors(
        vectorBucketName=VECTOR_BUCKET,
        indexName=INDEX_NAME,
        queryVector={"float32": embeddings.embed_query(query)},
        topK=k,
        filter={"clerk_user_id": clerk_user_id},
        returnMetadata=True,
    )
    return [text for v in response.get("vectors", []) if (text := v.get("metadata", {}).get("text", ""))]
