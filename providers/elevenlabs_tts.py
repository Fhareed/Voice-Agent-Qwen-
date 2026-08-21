"""Text-to-speech using ElevenLabs (modern SDK client).

The voice and model are read from environment variables so they can be changed
without editing code, with sensible defaults (Bella, which works on the free plan).
"""
import os

from elevenlabs import ElevenLabs

from .base import TTSProvider

_DEFAULT_VOICE_ID = "hpp4J3VqNfWAUOO0d1Us"  # Bella -- usable on the free plan
_DEFAULT_MODEL_ID = "eleven_multilingual_v2"


class ElevenLabsTTS(TTSProvider):
    def __init__(self, voice_id=None, model_id=None):
        api_key = os.getenv("ELEVEN_API_KEY")
        if not api_key:
            raise RuntimeError(
                "ELEVEN_API_KEY is not set. Copy .env.example to .env and add your key."
            )
        self._client = ElevenLabs(api_key=api_key)
        self._voice_id = voice_id or os.getenv("ELEVEN_VOICE_ID", _DEFAULT_VOICE_ID)
        self._model_id = model_id or os.getenv("ELEVEN_MODEL_ID", _DEFAULT_MODEL_ID)

    def synthesize(self, text):
        audio = self._client.text_to_speech.convert(
            voice_id=self._voice_id,
            model_id=self._model_id,
            text=text,
            output_format="mp3_44100_128",
        )
        # The SDK returns an iterator of byte chunks; join them into one bytes object.
        if isinstance(audio, (bytes, bytearray)):
            return bytes(audio)
        return b"".join(audio)
