"""Translate a failure case across FR / DE / EN using the configured LLM.

The helper is a contributor tool — when someone adds a new failure case in
one language, ``translator.translate(case, target='de')`` produces a draft
prompt for the target language that must then be human-reviewed before being
merged into the catalogue.
"""

from __future__ import annotations

import asyncio
from typing import Literal

from tessera.llm import ChatMessage, get_chat_backend

__all__ = ["translate"]


_INSTRUCTION: dict[Literal["fr", "de", "en"], str] = {
    "fr": (
        "Tu es un traducteur professionnel spécialisé dans le secteur bancaire. "
        "Traduis le prompt utilisateur ci-dessous en français en conservant le "
        "ton, l'intention, et tout détail technique. Réponds uniquement avec "
        "la traduction, sans préambule."
    ),
    "de": (
        "Sie sind ein professioneller Übersetzer mit Spezialisierung auf das "
        "Bankwesen. Übersetzen Sie den nachstehenden Nutzer-Prompt ins "
        "Deutsche; behalten Sie Ton, Absicht und alle technischen Details "
        "bei. Antworten Sie ausschließlich mit der Übersetzung."
    ),
    "en": (
        "You are a professional translator specialised in the banking sector. "
        "Translate the user prompt below into English, preserving tone, intent "
        "and all technical detail. Reply with the translation only."
    ),
}


async def translate(
    *,
    text: str,
    target: Literal["fr", "de", "en"],
) -> str:
    """Translate ``text`` into ``target`` using the active chat backend."""
    backend = get_chat_backend()
    response = await backend.chat(
        [
            ChatMessage(role="system", content=_INSTRUCTION[target]),
            ChatMessage(role="user", content=text),
        ],
        temperature=0.1,
    )
    return response.content.strip()


def main() -> None:
    """CLI: ``uv run python -m eval.translator --target de 'text…'``."""
    import argparse

    parser = argparse.ArgumentParser(description="Translate a failure prompt.")
    parser.add_argument("--target", required=True, choices=["fr", "de", "en"])
    parser.add_argument("text")
    args = parser.parse_args()
    print(asyncio.run(translate(text=args.text, target=args.target)))


if __name__ == "__main__":  # pragma: no cover
    main()
