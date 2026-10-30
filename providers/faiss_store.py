"""The knowledge-base 'memory', backed by per-tenant local FAISS indexes.

This is a thin wrapper: the actual per-org build/retrieve logic lives in kb.py.
The app depends on this provider interface, not on FAISS directly, so when we
move to a networked vector DB (pgvector / Qdrant) later, only kb.py and this
file change.
"""
from .base import VectorStoreProvider


class FAISSStore(VectorStoreProvider):
    def get_retriever(self, org_id: str):
        from kb import get_retriever_for_org

        return get_retriever_for_org(org_id)

    def build_index(self, org_id: str, *, texts=None, file_paths=None, urls=None) -> int:
        from kb import build_index_for_org

        return build_index_for_org(
            org_id, texts=texts, file_paths=file_paths, urls=urls
        )

    def add_documents(self, org_id: str, *, texts=None, file_paths=None, urls=None) -> int:
        from kb import add_documents_for_org

        return add_documents_for_org(
            org_id, texts=texts, file_paths=file_paths, urls=urls
        )

    def has_index(self, org_id: str) -> bool:
        from kb import has_index

        return has_index(org_id)

    def list_chunks(self, org_id: str, limit: int = 500) -> list[dict]:
        from kb import list_chunks

        return list_chunks(org_id, limit=limit)

    def reset_index(self, org_id: str) -> bool:
        from kb import reset_index

        return reset_index(org_id)
