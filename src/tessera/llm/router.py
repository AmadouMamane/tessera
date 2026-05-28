"""Chat-backend selection and the common protocol.

The router is a thin selector — it does *not* implement chat itself. The
implementations live in :mod:`tessera.llm.frontier` (Vertex AI) and
:mod:`tessera.llm.local` (Ollama). The selector caches the chosen backend
for the lifetime of the process.
"""

from __future__ import annotations

from collections.abc import Sequence
from dataclasses import dataclass
from functools import lru_cache
from typing import Literal, Protocol, runtime_checkable

from tessera.settings import LLMProfile, get_settings

__all__ = [
    "ChatBackend",
    "ChatMessage",
    "ChatResponse",
    "get_chat_backend",
]


@dataclass(frozen=True, slots=True)
class ChatMessage:
    """A single message in a chat exchange."""

    role: Literal["system", "user", "assistant", "tool"]
    content: str
    name: str | None = None


@dataclass(frozen=True, slots=True)
class ChatResponse:
    """A model response, with usage metadata for budgeting."""

    content: str
    model: str
    input_tokens: int
    output_tokens: int
    finish_reason: Literal["stop", "length", "tool_call", "content_filter", "error"]


@runtime_checkable
class ChatBackend(Protocol):
    """The narrow interface both Vertex AI and Ollama backends implement."""

    name: str
    model: str

    async def chat(
        self,
        messages: Sequence[ChatMessage],
        *,
        temperature: float = 0.2,
        max_output_tokens: int | None = None,
    ) -> ChatResponse:
        """Produce a single response for the given message sequence."""
        ...


@lru_cache(maxsize=1)
def get_chat_backend() -> ChatBackend:
    """Return the backend matching the resolved LLM profile.

    Imports are deferred so that on-prem hosts do not need Vertex AI
    credentials and frontier hosts do not need Ollama installed.
    """
    profile = get_settings().resolved_llm_profile()
    if profile is LLMProfile.FRONTIER:
        from tessera.llm.frontier import VertexAIBackend

        return VertexAIBackend()
    from tessera.llm.local import OllamaBackend

    return OllamaBackend()
