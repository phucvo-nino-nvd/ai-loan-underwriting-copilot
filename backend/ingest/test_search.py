from pathlib import Path

from dotenv import load_dotenv
from langchain_openai import OpenAIEmbeddings

import boto3
import os

load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env", override=True)

VECTOR_BUCKET = os.getenv("VECTOR_BUCKET", "aluci-vectors")
INDEX_NAME = os.getenv("INDEX_NAME", "policy-docs")
TEST_QUERY = "How do lenders use credit bureau information to assess loan risk?"
TEST_USER_ID = "user_test_underwriter"

embeddings = OpenAIEmbeddings(
    model=os.getenv("OPENROUTER_EMBEDDING_MODEL", "openai/text-embedding-3-small"),
    api_key=lambda: os.environ["OPENROUTER_API_KEY"],
    base_url=os.getenv("OPENROUTER_BASE_URL", "https://openrouter.ai/api/v1"),
)

if __name__ == "__main__":
    print(f"Querying {VECTOR_BUCKET}/{INDEX_NAME}: {TEST_QUERY}")

    response = boto3.client("s3vectors").query_vectors(
        vectorBucketName=VECTOR_BUCKET,
        indexName=INDEX_NAME,
        queryVector={"float32": embeddings.embed_query(TEST_QUERY)},
        topK=5,
        filter={"clerk_user_id": TEST_USER_ID},
        returnMetadata=True,
    )
    results = [text for v in response.get("vectors", []) if (text := v.get("metadata", {}).get("text", ""))]

    if not results:
        print("No results. Run test_ingest.py first, then try again.")
        raise SystemExit(1)

    for index, text in enumerate(results, 1):
        print(f"{index}. {text.replace(chr(10), ' ')[:300]}...")
    print(f"\n{len(results)} results")
