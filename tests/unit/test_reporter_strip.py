"""Unit tests for reasoning-trace stripping in the reporter (DeepSeek-R1)."""

from __future__ import annotations

from tessera.agent.reporter import _strip_reasoning


def test_strips_think_block() -> None:
    assert _strip_reasoning("<think>je réfléchis</think>\n\nLa garantie est de 100 000 €.") == (
        "La garantie est de 100 000 €."
    )


def test_multiline_think() -> None:
    assert _strip_reasoning("<think>\nstep 1\nstep 2\n</think>Réponse finale.") == "Réponse finale."


def test_plain_answer_unchanged() -> None:
    assert _strip_reasoning("Réponse sans raisonnement.") == "Réponse sans raisonnement."


def test_unclosed_think_dropped() -> None:
    # Truncated reasoning (no closing tag) → drop from the opening tag.
    assert _strip_reasoning("Réponse.<think>raisonnement tronqué") == "Réponse."
