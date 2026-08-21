import hashlib
import os

from langchain_community.vectorstores import FAISS
from langchain_huggingface import HuggingFaceEmbeddings

embedding = HuggingFaceEmbeddings(model_name="sentence-transformers/all-MiniLM-L6-v2")

# ---------------------------------------------------------------------------
# SECURITY NOTE — why the extra code below exists
# ---------------------------------------------------------------------------
# FAISS.load_local() reads a Python "pickle" file (rag_index/index.pkl).
# Un-pickling a file can RUN CODE hidden inside it, which is why LangChain makes
# you pass allow_dangerous_deserialization=True before it will load one at all.
#
# The rule that keeps this safe: only ever load an index that YOU built, on a
# machine you trust. Never load an index that was downloaded, shared, or built
# from files an outside user uploaded.
#
# As a guardrail we also record a fingerprint (SHA-256) of the index files and
# refuse to load if they change unexpectedly — this catches tampering. The
# permanent fix (later in the roadmap) is to move off pickle-based FAISS to a
# real vector database, which removes this risk entirely.
# ---------------------------------------------------------------------------

_INDEX_FILES = ("index.faiss", "index.pkl")
_STAMP_NAME = "index.sha256"


def _fingerprint(persist_path):
    """A single SHA-256 hash over the index files — a unique 'fingerprint'."""
    h = hashlib.sha256()
    for name in _INDEX_FILES:
        with open(os.path.join(persist_path, name), "rb") as f:
            h.update(f.read())
    return h.hexdigest()


def refresh_fingerprint(persist_path="rag_index"):
    """Record the current index fingerprint as the trusted one. Call this right
    after (re)building the index so future loads know this version is good."""
    with open(os.path.join(persist_path, _STAMP_NAME), "w") as f:
        f.write(_fingerprint(persist_path))


def _check_integrity(persist_path):
    stamp = os.path.join(persist_path, _STAMP_NAME)
    current = _fingerprint(persist_path)
    if not os.path.exists(stamp):
        # Trust-on-first-use: remember today's (self-built) index as the good one.
        with open(stamp, "w") as f:
            f.write(current)
        return
    with open(stamp) as f:
        expected = f.read().strip()
    if current != expected:
        raise RuntimeError(
            f"RAG index fingerprint does not match {stamp}. The index files "
            "changed unexpectedly. If you rebuilt the index on purpose, run "
            "build_rag_index.py (it refreshes the fingerprint) or delete the "
            ".sha256 file. Otherwise do NOT load it — it may have been tampered with."
        )


def load_retriever(persist_path="rag_index"):
    _check_integrity(persist_path)
    # Safe here ONLY because we build this index ourselves and verify it above.
    return FAISS.load_local(persist_path, embedding, allow_dangerous_deserialization=True)
