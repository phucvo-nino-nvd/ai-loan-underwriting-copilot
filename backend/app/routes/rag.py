from __future__ import annotations

import os
import shutil
from pathlib import Path

from fastapi import APIRouter, File, UploadFile, HTTPException
from fastapi.responses import JSONResponse

from ..llm.rag.ingest import DB_NAME, KNOWLEDGE_BASE, fetch_documents, create_chunks, create_embeddings

router = APIRouter(prefix="/api/rag", tags=["rag"])

ALLOWED_EXTENSIONS = {".md"}


@router.get("/documents")
async def list_documents():
    """Return the list of documents currently in the knowledge base."""
    kb = Path(KNOWLEDGE_BASE)
    kb.mkdir(parents=True, exist_ok=True)

    files = []
    for f in sorted(kb.iterdir()):
        if f.is_file() and f.suffix in ALLOWED_EXTENSIONS:
            files.append({"name": f.name, "size": f.stat().st_size})
    return {"documents": files}


@router.post("/upload")
async def upload_document(file: UploadFile = File(...)):
    """Accept a policy document, save to knowledge_base, then re-ingest the vector store."""
    ext = Path(file.filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported file type '{ext}'. Allowed: {', '.join(ALLOWED_EXTENSIONS)}",
        )

    kb = Path(KNOWLEDGE_BASE)
    kb.mkdir(parents=True, exist_ok=True)
    dest = kb / file.filename

    # Avoid overwrite — append a suffix if the name already exists
    if dest.exists():
        stem = dest.stem
        counter = 1
        while dest.exists():
            dest = kb / f"{stem}_{counter}{ext}"
            counter += 1

    try:
        with open(dest, "wb") as f:
            f.write(await file.read())
    except OSError as e:
        raise HTTPException(status_code=500, detail=f"Failed to save file: {e}")

    # Re-ingest the entire knowledge base
    try:
        documents = fetch_documents()
        chunks = create_chunks(documents)
        create_embeddings(chunks)
    except Exception as e:
        # If ingestion fails, remove the uploaded file to avoid inconsistency
        dest.unlink(missing_ok=True)
        raise HTTPException(status_code=500, detail=f"Ingestion failed: {e}")

    return JSONResponse(
        content={"message": f"'{file.filename}' uploaded and ingested.", "file": file.filename},
        status_code=201,
    )


@router.delete("/documents/{filename}")
async def delete_document(filename: str):
    """Delete a document from the knowledge base and re-ingest."""
    kb = Path(KNOWLEDGE_BASE)
    target = kb / filename

    if not target.exists() or not target.is_file():
        raise HTTPException(status_code=404, detail=f"Document '{filename}' not found.")

    target.unlink()

    # Re-ingest
    try:
        documents = fetch_documents()
        chunks = create_chunks(documents)
        create_embeddings(chunks)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Re-ingestion after delete failed: {e}")

    return {"message": f"'{filename}' deleted and vector store updated."}
