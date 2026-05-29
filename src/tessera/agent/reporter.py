"""Reporter node — renders the final answer in the user's language.

The reporter selects the language-matched prompt template from
``src/tessera/agent/prompts/{fr,de,en}.yaml``, fills in placeholders from the
state (draft response, citations, tool results), and writes the rendered text
to ``state["final_response"]``.

When no draft response is present (planner returned empty plan, all workers
failed silently), the reporter emits a polite fallback message and triggers
escalation as a safety net.
"""

from __future__ import annotations

from functools import lru_cache
from importlib import resources
from typing import TYPE_CHECKING, Final

import yaml

from tessera.agent.state import AgentState, Citation, ConversationMessage
from tessera.llm.router import ChatMessage, get_chat_backend
from tessera.settings import LanguageCode

if TYPE_CHECKING:
    from collections.abc import AsyncIterator, Iterable

__all__ = ["astream_synthesise", "format_citations", "load_prompts", "render", "run"]


_FALLBACK_RESPONSES: Final[dict[LanguageCode, str]] = {
    LanguageCode.FR: (
        "Je suis désolé, je n'ai pas pu rassembler les informations nécessaires "
        "pour répondre avec certitude. Je transmets votre demande à un conseiller "
        "qui reviendra vers vous rapidement."
    ),
    LanguageCode.DE: (
        "Es tut mir leid, ich konnte die nötigen Informationen nicht "
        "zusammenstellen, um Ihre Frage sicher zu beantworten. Ich leite Ihre "
        "Anfrage an einen Berater weiter, der sich umgehend bei Ihnen melden wird."
    ),
    LanguageCode.EN: (
        "I'm sorry — I couldn't gather enough information to answer with "
        "confidence. I'm forwarding your request to a human advisor who will "
        "get back to you shortly."
    ),
}


@lru_cache(maxsize=3)
def load_prompts(language: LanguageCode) -> dict[str, str]:
    """Load the YAML prompt bundle for ``language``.

    Cached per language so the file is read once per process. The returned
    dict must contain at least a ``reporter`` key — other keys (``planner``,
    ``reviewer``) are reserved for future LLM-assisted variants of those
    nodes.
    """
    package = resources.files("tessera.agent.prompts")
    target = package.joinpath(f"{language.value}.yaml")
    raw_text = target.read_text(encoding="utf-8")
    parsed = yaml.safe_load(raw_text)
    if not isinstance(parsed, dict):
        raise TypeError(
            f"Prompt bundle for {language.value} must be a YAML mapping; "
            f"got {type(parsed).__name__}"
        )
    return {str(key): str(value) for key, value in parsed.items()}


def format_citations(citations: Iterable[Citation], language: LanguageCode) -> str:
    """Render citations into a compact, language-aware footer."""
    citations = list(citations)
    if not citations:
        return ""

    headers: dict[LanguageCode, str] = {
        LanguageCode.FR: "Sources",
        LanguageCode.DE: "Quellen",
        LanguageCode.EN: "Sources",
    }
    lines = [f"\n\n{headers[language]}:"]
    for citation in citations:
        lines.append(f"- {citation.source} ({citation.locator})")
    return "\n".join(lines)


async def _synthesise(state: AgentState) -> str:
    """Call the LLM to produce a grounded answer from all available sources.

    When a tool-result draft is also present (e.g. account balance alongside
    RGPD docs), it is injected as additional context so the LLM can address
    every aspect of the user's question in one coherent response.
    """
    language = state["language"]
    prompts = load_prompts(language)
    system_prompt = prompts.get("system", "You are a helpful banking assistant.")

    docs = state.get("retrieved_documents", [])
    context = "\n\n".join(f"[{doc.source}]\n{doc.text}" for doc in docs[:6])

    draft = state.get("draft_response", "")
    tool_context = f"\nInformation récupérée en base : {draft}\n" if draft else ""

    user_message = (
        f"Question du client : {state['user_input']}\n"
        f"{tool_context}"
        f"\nDocuments disponibles :\n{context}\n\n"
        "Réponds de façon concise et précise en adressant tous les aspects de la question, "
        "en te basant sur les documents et les données disponibles."
    )

    backend = get_chat_backend()
    response = await backend.chat(
        [
            ChatMessage(role="system", content=system_prompt),
            ChatMessage(role="user", content=user_message),
        ],
        temperature=0.2,
    )
    return response.content.strip()


async def astream_synthesise(state: AgentState) -> AsyncIterator[str]:
    """Streaming variant of ``_synthesise`` — yields tokens as they arrive.

    Used by the chat route to emit ``turn.token`` SSE events without waiting
    for the full LLM response. The caller is responsible for collecting the
    tokens and assembling the final string for ``turn.end``.
    """
    language = state["language"]
    prompts = load_prompts(language)
    system_prompt = prompts.get("system", "You are a helpful banking assistant.")
    docs = state.get("retrieved_documents", [])
    context = "\n\n".join(f"[{doc.source}]\n{doc.text}" for doc in docs[:6])
    draft = state.get("draft_response", "")
    tool_context = f"\nInformation récupérée en base : {draft}\n" if draft else ""
    user_message = (
        f"Question du client : {state['user_input']}\n"
        f"{tool_context}"
        f"\nDocuments disponibles :\n{context}\n\n"
        "Réponds de façon concise et précise en adressant tous les aspects de la question, "
        "en te basant sur les documents et les données disponibles."
    )
    backend = get_chat_backend()
    async for token in backend.stream_chat(
        [
            ChatMessage(role="system", content=system_prompt),
            ChatMessage(role="user", content=user_message),
        ],
        temperature=0.2,
    ):
        yield token


def render(state: AgentState) -> str:
    """Render the final user-facing response for ``state`` (sync path only)."""
    language = state["language"]
    draft = state.get("draft_response")
    if not draft:
        return _FALLBACK_RESPONSES[language]

    prompts = load_prompts(language)
    template = prompts.get("reporter")
    if template is None:
        return draft + format_citations(state.get("citations", []), language)

    return template.format(
        draft=draft,
        citations=format_citations(state.get("citations", []), language).strip(),
    ).rstrip()


async def run(state: AgentState) -> dict[str, object]:
    """Reporter node entry point."""
    language = state["language"]
    draft = state.get("draft_response")
    docs = state.get("retrieved_documents", [])

    if docs:
        # Retrieved documents are present — always synthesise via LLM so
        # every aspect of the question (tool result + regulation) is addressed.
        final = await _synthesise(state)
        citations_footer = format_citations(state.get("citations", []), language)
        if citations_footer:
            final = final + citations_footer
    elif draft:
        # Tool result only, no retrieval docs — render the draft directly.
        final = render(state)
    else:
        final = _FALLBACK_RESPONSES[language]

    return {
        "final_response": final,
        "messages": [ConversationMessage(role="assistant", content=final)],
    }
