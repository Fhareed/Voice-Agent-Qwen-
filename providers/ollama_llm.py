"""The language model, served locally by Ollama.

Model name and host are read from environment variables so you can point at a
different model or a remote Ollama without touching code. To move to a managed
API later (Anthropic, OpenAI, Bedrock), add a sibling LLMProvider and switch it
in providers/__init__.py.
"""
import os

from langchain_ollama import OllamaLLM

from .base import LLMProvider


class OllamaProvider(LLMProvider):
    def __init__(self, model=None):
        self._model = model or os.getenv("OLLAMA_MODEL", "qwen:7b")
        self._base_url = os.getenv("OLLAMA_HOST")  # optional, e.g. http://host:11434

    def get_llm(self):
        kwargs = {"model": self._model}
        if self._base_url:
            kwargs["base_url"] = self._base_url
        return OllamaLLM(**kwargs)
