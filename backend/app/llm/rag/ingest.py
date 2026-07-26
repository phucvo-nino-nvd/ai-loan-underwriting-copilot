import os
import glob
from pathlib import Path
from langchain_community.document_loaders import DirectoryLoader, TextLoader
from langchain_text_splitters import RecursiveCharacterTextSplitter
from langchain_chroma import Chroma
from langchain_nvidia_ai_endpoints import NVIDIAEmbeddings

from dotenv import load_dotenv

DB_NAME = str(Path(__file__).parent.parent / "vector_db")
KNOWLEDGE_BASE = str(Path(__file__).parent / "knowledge_base")

load_dotenv(dotenv_path=Path(__file__).parent.parent.parent.parent / ".env.local", override=True)

embeddings = NVIDIAEmbeddings(
    model="nvidia/nv-embedqa-e5-v5", api_key=os.getenv("NVIDIA_API_KEY")
)


def fetch_documents():
    documents = []
    loader = DirectoryLoader(
        KNOWLEDGE_BASE, glob="**/*.md", loader_cls=TextLoader, loader_kwargs={"encoding": "utf-8"}
    )
    folder_docs = loader.load()
    for doc in folder_docs:
        doc.metadata["doc_type"] = "markdown"
        documents.append(doc)
    return documents


def create_chunks(documents):
    text_splitter = RecursiveCharacterTextSplitter(chunk_size=500, chunk_overlap=200)
    chunks = text_splitter.split_documents(documents)
    return chunks


def create_embeddings(chunks):
    if os.path.exists(DB_NAME):
        Chroma(persist_directory=DB_NAME, embedding_function=embeddings).delete_collection()

    vectorstore = Chroma.from_documents(
        documents=chunks, embedding=embeddings, persist_directory=DB_NAME
    )

    collection = vectorstore._collection
    count = collection.count()

    sample_embedding = collection.get(limit=1, include=["embeddings"])["embeddings"][0]
    dimensions = len(sample_embedding)
    print(f"There are {count:,} vectors with {dimensions:,} dimensions in the vector store")
    return vectorstore


if __name__ == "__main__":
    documents = fetch_documents()
    chunks = create_chunks(documents)
    create_embeddings(chunks)
    print("Ingestion complete")