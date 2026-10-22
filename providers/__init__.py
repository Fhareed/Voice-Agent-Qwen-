"""
Provider abstraction layer -- the single place that decides which vendor backs
each capability.

The app calls get_stt(), get_tts(), get_llm_provider(), get_vector_store() and
never names a vendor. To swap a vendor, change it HERE (or via an env var) and
the rest of the app is untouched.

Each provider is imported lazily (only when its factory is called) so that
importing this package stays cheap and doesn't drag in every vendor's SDK.
"""
import os

from .base import LLMProvider, STTProvider, TTSProvider, VectorStoreProvider


def get_stt() -> STTProvider:
    provider = os.getenv("STT_PROVIDER", "google").lower()
    if provider == "google":
        from .google_stt import GoogleSTT
        return GoogleSTT()
    if provider == "groq":
        from .groq_stt import GroqWhisperSTT
        return GroqWhisperSTT()
    raise ValueError(f"Unknown STT_PROVIDER: {provider}")


def get_tts() -> TTSProvider:
    provider = os.getenv("TTS_PROVIDER", "elevenlabs").lower()
    if provider == "elevenlabs":
        from .elevenlabs_tts import ElevenLabsTTS
        return ElevenLabsTTS()
    raise ValueError(f"Unknown TTS_PROVIDER: {provider}")


def get_llm_provider() -> LLMProvider:
    provider = os.getenv("LLM_PROVIDER", "ollama").lower()
    if provider == "ollama":
        from .ollama_llm import OllamaProvider
        return OllamaProvider()
    if provider == "groq":
        from .groq_llm import GroqProvider
        return GroqProvider()
    raise ValueError(f"Unknown LLM_PROVIDER: {provider}")


def get_vector_store() -> VectorStoreProvider:
    provider = os.getenv("VECTOR_STORE", "faiss").lower()
    if provider == "faiss":
        from .faiss_store import FAISSStore
        return FAISSStore()
    raise ValueError(f"Unknown VECTOR_STORE: {provider}")
