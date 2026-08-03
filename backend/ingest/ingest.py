from pathlib import Path
from typing import TypedDict

from botocore.exceptions import ClientError
from dotenv import load_dotenv
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_core.documents import Document
from langchain_openai import OpenAIEmbeddings
from langchain_text_splitters import RecursiveCharacterTextSplitter

import boto3
import os

KNOWLEDGE_BASE = str(Path(__file__).parent / "knowledge_base")
EMBEDDING_DIMENSION = 1536
BATCH_SIZE = 50

load_dotenv(dotenv_path=Path(__file__).parent.parent.parent / ".env", override=True)

VECTOR_BUCKET = os.getenv("VECTOR_BUCKET", "aluci-vectors")
INDEX_NAME = os.getenv("INDEX_NAME", "policy-docs")
OPENROUTER_BASE_URL = "https://openrouter.ai/api/v1"
EMBEDDING_MODEL = "openai/text-embedding-3-small"

embeddings = OpenAIEmbeddings(
    model=os.getenv("OPENROUTER_EMBEDDING_MODEL", EMBEDDING_MODEL),
    api_key=lambda: os.environ["OPENROUTER_API_KEY"],
    base_url=os.getenv("OPENROUTER_BASE_URL", OPENROUTER_BASE_URL),
)
s3_vectors = boto3.client("s3vectors")


class PolicyDocument(TypedDict):
    id: str
    clerk_user_id: str
    title: str
    body: str
    category: str


def fetch_documents(kb_path: str | None = None) -> list[Document]:
    documents = DirectoryLoader(
        kb_path or KNOWLEDGE_BASE, glob="**/*.md", loader_cls=TextLoader, loader_kwargs={"encoding": "utf-8"}
    ).load()
    for doc in documents:
        doc.metadata["doc_type"] = "markdown"
    return documents


def documents_from_policies(policies: list[PolicyDocument]) -> list[Document]:
    return [
        Document(
            page_content=policy["body"],
            metadata={
                "source": policy["title"],
                "doc_type": "markdown",
                "policy_id": policy["id"],
                "clerk_user_id": policy["clerk_user_id"],
                "category": policy["category"],
            },
        )
        for policy in policies
    ]


def create_chunks(documents: list[Document]) -> list[Document]:
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=200)
    chunks = text_splitter.split_documents(documents)
    counters: dict[str, int] = {}
    for chunk in chunks:
        policy_id = str(chunk.metadata.get("policy_id", ""))
        chunk.metadata["chunk_index"] = counters.get(policy_id, 0)
        counters[policy_id] = counters.get(policy_id, 0) + 1
    return chunks


def vector_key(chunk: Document, offset: int) -> str:
    user_id = chunk.metadata.get("clerk_user_id", "")
    policy_id = chunk.metadata.get("policy_id", "")
    chunk_index = chunk.metadata.get("chunk_index", offset)
    return f"{user_id}:{policy_id}:{chunk_index}"


def create_embeddings(chunks: list[Document]) -> None:
    if not chunks:
        return

    try:
        s3_vectors.get_index(vectorBucketName=VECTOR_BUCKET, indexName=INDEX_NAME)
    except ClientError as error:
        if error.response.get("Error", {}).get("Code") not in {"NotFoundException", "ResourceNotFoundException"}:
            raise
        s3_vectors.create_index(
            vectorBucketName=VECTOR_BUCKET,
            indexName=INDEX_NAME,
            dataType="float32",
            dimension=EMBEDDING_DIMENSION,
            distanceMetric="cosine",
        )

    texts = [chunk.page_content for chunk in chunks]
    vectors = embeddings.embed_documents(texts)

    for start in range(0, len(chunks), BATCH_SIZE):
        batch = []
        for offset, chunk in enumerate(chunks[start : start + BATCH_SIZE], start=start):
            batch.append(
                {
                    "key": vector_key(chunk, offset),
                    "data": {"float32": vectors[offset]},
                    "metadata": {
                        "text": chunk.page_content,
                        "source": chunk.metadata.get("source", ""),
                        "doc_type": chunk.metadata.get("doc_type", "markdown"),
                        "policy_id": chunk.metadata.get("policy_id", ""),
                        "clerk_user_id": chunk.metadata.get("clerk_user_id", ""),
                        "category": chunk.metadata.get("category", ""),
                    },
                }
            )
        s3_vectors.put_vectors(
            vectorBucketName=VECTOR_BUCKET,
            indexName=INDEX_NAME,
            vectors=batch,
        )

    print(f"Indexed {len(chunks):,} vectors into {VECTOR_BUCKET}/{INDEX_NAME}")


def delete_embeddings(chunks: list[Document]) -> None:
    keys = [vector_key(chunk, offset) for offset, chunk in enumerate(chunks)]
    for start in range(0, len(keys), BATCH_SIZE):
        s3_vectors.delete_vectors(
            vectorBucketName=VECTOR_BUCKET,
            indexName=INDEX_NAME,
            keys=keys[start : start + BATCH_SIZE],
        )
