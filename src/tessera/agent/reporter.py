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
from tessera.settings import LanguageCode

if TYPE_CHECKING:
    from collections.abc import Iterable

__all__ = ["load_prompts", "render", "run"]


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


def _format_citations(citations: Iterable[Citation], language: LanguageCode) -> str:
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


def render(state: AgentState) -> str:
    """Render the final user-facing response for ``state``."""
    language = state["language"]
    draft = state.get("draft_response")
    if not draft:
        return _FALLBACK_RESPONSES[language]

    prompts = load_prompts(language)
    template = prompts.get("reporter")
    if template is None:
        # No template configured for this language → return the draft as-is
        # plus a citation footer.
        return draft + _format_citations(state.get("citations", []), language)

    return template.format(
        draft=draft,
        citations=_format_citations(state.get("citations", []), language).strip(),
    ).rstrip()


def run(state: AgentState) -> dict[str, object]:
    """Reporter node entry point."""
    final = render(state)
    return {
        "final_response": final,
        "messages": [ConversationMessage(role="assistant", content=final)],
    }
