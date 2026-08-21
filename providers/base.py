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
    """The 'memory': provides a retriever over the knowledge base."""

    @abstractmethod
    def get_retriever(self):
        ...
