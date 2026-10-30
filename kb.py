"""Per-tenant knowledge base.

Every organization gets its OWN vector index on disk, in a folder named after its
org id. Building and retrieving ALWAYS go through that org's own folder, so one
company's question can only ever be answered from that company's documents:

    tenant_indexes/
        <org-id-A>/   index.faiss  index.pkl  index.sha256
        <org-id-B>/   index.faiss  index.pkl  index.sha256

This replaces the single shared rag_index/ the prototype used, where every user
searched the same pile of documents.

This is the FAISS-backed implementation of the knowledge base. When we move to a
networked vector database later in the roadmap (e.g. pgvector), this file is the
main thing that changes; the rest of the app keeps calling the provider layer.
"""
import os
import shutil

from langchain_community.vectorstores import FAISS
from langchain_core.documents import Document

from document_loader import split_documents
from rag_retriever import get_embedding, load_retriever, refresh_fingerprint

# Where each org's index folder lives. Override with TENANT_INDEX_DIR in .env.
BASE_DIR = os.getenv("TENANT_INDEX_DIR", "tenant_indexes")


def org_index_path(org_id: str) -> str:
    """The folder that holds one org's index. os.path.basename strips any path
    separators, so an org id can never point outside BASE_DIR (defence in depth —
    org ids come from our own database, but we don't trust them blindly)."""
    safe = os.path.basename(str(org_id))
    if not safe:
        raise ValueError("Empty org id.")
    return os.path.join(BASE_DIR, safe)


def has_index(org_id: str) -> bool:
    """True if this org has already had a knowledge base built."""
    return os.path.exists(os.path.join(org_index_path(org_id), "index.faiss"))


def _collect_documents(texts=None, file_paths=None, urls=None):
    """Turn raw inputs (plain strings, files, or URLs) into LangChain documents."""
    docs = []
    for t in texts or []:
        docs.append(Document(page_content=t))
    for path in file_paths or []:
        ext = os.path.splitext(path)[1].lower()
        if ext == ".pdf":
            from document_loader import load_pdf

            docs += load_pdf(path)
        elif ext in (".txt", ".md"):
            from document_loader import load_txt

            docs += load_txt(path)
        elif ext in (".docx", ".doc"):
            from document_loader import load_docx

            docs += load_docx(path)
        else:
            raise ValueError(f"Unsupported file type: {ext} ({path})")
    for url in urls or []:
        from document_loader import load_website

        docs += load_website(url)
    return docs


def _index_documents(org_id: str, docs, *, append: bool) -> int:
    """Write documents into an org's index. If append=True and the org already has
    an index, add to it; otherwise build a fresh one. Returns chunks written."""
    if not docs:
        raise ValueError("No documents to index — nothing was provided.")

    chunks = split_documents(docs)
    path = org_index_path(org_id)
    os.makedirs(path, exist_ok=True)

    if append and has_index(org_id):
        # Load the org's existing index (integrity-checked) and add to it, so
        # uploading a second document doesn't wipe out the first.
        db = load_retriever(path)
        db.add_documents(chunks)
    else:
        db = FAISS.from_documents(chunks, get_embedding())

    db.save_local(path)
    refresh_fingerprint(path)
    return len(chunks)


def build_index_for_org(org_id: str, *, texts=None, file_paths=None, urls=None) -> int:
    """Build (or REPLACE) one org's knowledge base from the given inputs.

    Returns the number of text chunks indexed. Saves the index into that org's
    own folder and records a trusted fingerprint (the same security guardrail the
    shared index used).
    """
    docs = _collect_documents(texts=texts, file_paths=file_paths, urls=urls)
    return _index_documents(org_id, docs, append=False)


def add_documents_for_org(org_id: str, *, texts=None, file_paths=None, urls=None) -> int:
    """ADD documents to one org's knowledge base (creates it if none exists yet).

    This is what the upload endpoint uses, so a company can keep adding documents
    over time without losing what it uploaded before.
    """
    docs = _collect_documents(texts=texts, file_paths=file_paths, urls=urls)
    return _index_documents(org_id, docs, append=True)


def get_retriever_for_org(org_id: str):
    """Return a retriever over ONE org's documents. Raises if that org has no
    knowledge base yet (it must upload/build documents first)."""
    if not has_index(org_id):
        raise FileNotFoundError(
            f"No knowledge base for org {org_id} yet — upload documents first."
        )
    return load_retriever(org_index_path(org_id)).as_retriever()


def list_chunks(org_id: str, limit: int = 500) -> list[dict]:
    """Return the text chunks stored in one org's knowledge base, so the owner can
    review exactly what their receptionist can search. Read-only; scoped to the org."""
    if not has_index(org_id):
        return []
    db = load_retriever(org_index_path(org_id))
    store = getattr(db, "docstore", None)
    mapping = getattr(store, "_dict", None) or {}
    out: list[dict] = []
    for doc in mapping.values():
        content = (getattr(doc, "page_content", "") or "").strip()
        if not content:
            continue
        meta = getattr(doc, "metadata", {}) or {}
        out.append({"text": content, "source": meta.get("source") or meta.get("title") or ""})
        if len(out) >= limit:
            break
    return out


def reset_index(org_id: str) -> bool:
    """Delete one org's knowledge base entirely (index files + folder). Returns True
    if something was removed. Scoped to the org — only ever touches its own folder."""
    path = org_index_path(org_id)
    if os.path.isdir(path):
        shutil.rmtree(path, ignore_errors=True)
        return True
    return False
