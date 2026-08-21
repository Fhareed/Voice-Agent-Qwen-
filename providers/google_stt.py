"""Speech-to-text using Google's recognizer via the SpeechRecognition library.

This is a thin wrapper so the rest of the app never calls SpeechRecognition
directly. To move to a production STT vendor later (Deepgram, AssemblyAI, ...),
add a sibling class that implements STTProvider and switch it in providers/__init__.py.
"""
import io

import speech_recognition as sr
from pydub import AudioSegment

from .base import STTProvider

# Map friendly language names to the codes Google expects.
_LANG_MAP = {"english": "en-US", "finnish": "fi-FI", "swedish": "sv-SE"}


def _to_wav(audio_bytes):
    """Browsers record WebM/Opus, but the recognizer only reads WAV/AIFF/FLAC.

    Convert whatever we received into WAV bytes. Uses ffmpeg under the hood,
    so ffmpeg must be installed on the machine (brew install ffmpeg on macOS).
    """
    segment = AudioSegment.from_file(io.BytesIO(audio_bytes))
    buffer = io.BytesIO()
    segment.export(buffer, format="wav")
    return buffer.getvalue()


class GoogleSTT(STTProvider):
    def transcribe(self, audio_bytes, language="english"):
        code = _LANG_MAP.get(str(language).lower(), "en-US")

        try:
            wav_bytes = _to_wav(audio_bytes)
        except Exception as e:
            print(f"❌ Could not convert audio: {e}. Install ffmpeg: brew install ffmpeg")
            return None

        recognizer = sr.Recognizer()
        with sr.AudioFile(io.BytesIO(wav_bytes)) as source:
            audio = recognizer.record(source)
        try:
            return recognizer.recognize_google(audio, language=code)
        except (sr.UnknownValueError, sr.RequestError):
            return None
