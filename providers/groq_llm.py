"""The language model, served by Groq's fast hosted API.

Groq runs open models (GPT-OSS, Qwen, ...) on specialised hardware, so replies
come back in about a second instead of the ~10s a local model takes. That speed
is what makes the voice assistant feel like a real phone call.

Model and temperature are read from environment variables. The API key is read
automatically by ChatGroq from GROQ_API_KEY -- it is never hard-coded here.
To move to another hosted API later (Anthropic, OpenAI, Bedrock), add a sibling
LLMProvider and switch it in providers/__init__.py.
"""
import os

from langchain_groq import ChatGroq

from .base import LLMProvider


class GroqProvider(LLMProvider):
    def __init__(self, model=None):
        # Fast, cheap, and more than enough for short spoken answers. Override
        # with GROQ_MODEL (e.g. "openai/gpt-oss-120b") for higher quality.
        self._model = model or os.getenv("GROQ_MODEL", "openai/gpt-oss-20b")
        # Low temperature keeps answers tight and on-script. This matters for the
        # pricing guardrails: we don't want it getting "creative" with numbers.
        self._temperature = float(os.getenv("GROQ_TEMPERATURE", "0.2"))

    def get_llm(self):
        # ChatGroq reads the API key from the GROQ_API_KEY environment variable.
        return ChatGroq(model=self._model, temperature=self._temperature)
