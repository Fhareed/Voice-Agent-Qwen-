"""
Provider interfaces -- the "standard sockets" the app plugs into.

The rest of the app asks for a capability (listen, speak, think, remember)
through these abstract classes and never names a specific vendor directly.
Swapping a vendor later means writing one small new class here, not rewiring
the whole app.
"""
from abc import ABC, abstractmethod
from typing import Optional


class STTProvider(ABC):
    """Speech-to-text: turn recorded audio into text."""

    @abstractmethod
    def transcribe(self, audio_bytes: bytes, language: str = "english") -> Optional[str]:
        """Return the spoken text, or None if nothing could be understood."""
        ...


class TTSProvider(ABC):
    """Text-to-speech: turn text into spoken audio (mp3 bytes)."""

    @abstractmethod
    def synthesize(self, text: str) -> bytes:
        ...


class LLMProvider(ABC):
    """The 'brain': provides a LangChain-compatible language model object."""

    @abstractmethod
    def get_llm(self):
        ...


class VectorStoreProvider(ABC):
    """The 'memory': a per-tenant knowledge base.

    Every method takes an org_id, because in a B2B product each organization has
    its own separate knowledge base — one company can never read another's.
    """

    @abstractmethod
    def get_retriever(self, org_id: str):
        """Return a retriever over just this org's documents."""
        ...

    @abstractmethod
    def build_index(self, org_id: str, *, texts=None, file_paths=None, urls=None) -> int:
        """Build/replace this org's knowledge base. Returns chunks indexed."""
        ...

    @abstractmethod
    def add_documents(self, org_id: str, *, texts=None, file_paths=None, urls=None) -> int:
        """Add documents to this org's knowledge base (creates it if needed)."""
        ...

    @abstractmethod
    def has_index(self, org_id: str) -> bool:
        """True if this org already has a knowledge base."""
        ...

    def list_chunks(self, org_id: str, limit: int = 500) -> list[dict]:
        """Return this org's stored text chunks for review. Optional; default empty."""
        return []

    def reset_index(self, org_id: str) -> bool:
        """Delete this org's knowledge base. Optional; default no-op."""
        return False
