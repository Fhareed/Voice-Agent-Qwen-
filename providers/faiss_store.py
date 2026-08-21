"""The knowledge-base 'memory', backed by the local FAISS index.

This wraps the existing rag_retriever so the app depends on the interface, not
on FAISS directly. When we move to a networked vector DB (pgvector / Qdrant)
later in the roadmap, only this file changes.
"""
from rag_retriever import load_retriever

from .base import VectorStoreProvider


class FAISSStore(VectorStoreProvider):
    def __init__(self, persist_path="rag_index"):
        self._persist_path = persist_path

    def get_retriever(self):
        store = load_retriever(self._persist_path)
        return store.as_retriever()
