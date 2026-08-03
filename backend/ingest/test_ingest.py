from pathlib import Path

import sys

sys.path.insert(0, str(Path(__file__).resolve().parents[2]))

from backend.ingest.ingest import (
    INDEX_NAME,
    KNOWLEDGE_BASE,
    VECTOR_BUCKET,
    create_chunks,
    create_embeddings,
    fetch_documents,
)

TEST_USER_ID = "user_test_underwriter"

if __name__ == "__main__":
    print(f"Ingesting {KNOWLEDGE_BASE} into {VECTOR_BUCKET}/{INDEX_NAME}")

    documents = fetch_documents()
    for document in documents:
        # search filters on clerk_user_id, so unowned chunks would be invisible to test_search.py
        document.metadata["policy_id"] = Path(str(document.metadata.get("source", "policy"))).stem
        document.metadata["clerk_user_id"] = TEST_USER_ID
        document.metadata["category"] = "test"

    chunks = create_chunks(documents)
    print(f"{len(documents)} documents, {len(chunks)} chunks")
    if not chunks:
        print("No chunks. Add markdown files to the knowledge_base folder first.")
        raise SystemExit(1)

    create_embeddings(chunks)
    print("Done. Run test_search.py to query the index.")
