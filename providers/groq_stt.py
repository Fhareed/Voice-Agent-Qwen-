"""Speech-to-text using Groq's hosted Whisper.

Groq runs Whisper on the same fast hardware as the LLM, so transcription comes
back in a fraction of the time the free Google web recognizer takes -- and it
reuses the GROQ_API_KEY you already set. It also accepts the browser's WebM/Opus
audio directly, so there's no ffmpeg conversion step.

Model is read from an environment variable (defaults to the turbo model, the
fastest). To move to another STT vendor later, add a sibling STTProvider and
switch it in providers/__init__.py.
"""
import os

from groq import Groq

from .base import STTProvider

# Whisper wants ISO codes; map the friendly names the app uses. Anything not
# listed is left to Whisper's own auto-detection.
_LANG_MAP = {"english": "en", "finnish": "fi", "swedish": "sv"}


class GroqWhisperSTT(STTProvider):
    def __init__(self, model=None):
        api_key = os.getenv("GROQ_API_KEY")
        if not api_key:
            raise RuntimeError(
                "GROQ_API_KEY is not set. Add it to .env (same key as the LLM)."
            )
        self._client = Groq(api_key=api_key)
        self._model = model or os.getenv("GROQ_STT_MODEL", "whisper-large-v3-turbo")

    def transcribe(self, audio_bytes, language="english"):
        code = _LANG_MAP.get(str(language).lower())  # None -> auto-detect
        kwargs = {
            "file": ("audio.webm", audio_bytes),
            "model": self._model,
            "response_format": "text",
        }
        if code:
            kwargs["language"] = code
        try:
            result = self._client.audio.transcriptions.create(**kwargs)
        except Exception as e:
            print(f"❌ Groq STT error: {e}")
            return None

        # response_format="text" returns a plain string; be tolerant either way.
        text = result if isinstance(result, str) else getattr(result, "text", "")
        text = (text or "").strip()
        return text or None
