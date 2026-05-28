"""LLM access layer: frontier (Vertex AI) and on-prem (Ollama).

Both backends implement the :class:`ChatBackend` protocol so that callers
work against a single interface and let :mod:`tessera.llm.router` choose at
runtime. The :mod:`tessera.llm.budget` module tracks token usage and is
queried by the API layer to enforce per-conversation cost caps.
"""

from __future__ import annotations

from tessera.llm.budget import BudgetSnapshot, get_budget_tracker
from tessera.llm.router import ChatBackend, ChatMessage, ChatResponse, get_chat_backend

__all__ = [
    "BudgetSnapshot",
    "ChatBackend",
    "ChatMessage",
    "ChatResponse",
    "get_budget_tracker",
    "get_chat_backend",
]
