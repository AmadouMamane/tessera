"""Router node — detects the input language and seeds the conversation state.

We deliberately keep language detection rule-based and offline for two reasons:

1. The router runs on every turn; an LLM call here would dominate latency.
2. The non-regression harness needs deterministic replays. A statistical
   classifier that returns the same answer for the same input every time is
   exactly what the harness expects.

The detector matches stopword frequencies for FR / DE / EN and falls back to
the configured default language when confidence is too low. The thresholds
were tuned on the multilingual evaluation set documented in
``docs/multilingual.md``.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

from tessera.agent.state import AgentState
from tessera.settings import LanguageCode, get_settings

__all__ = ["LanguageDetectionResult", "detect_language", "run"]


# ---------------------------------------------------------------------------
# Stopword lexicons
# ---------------------------------------------------------------------------

# Small, high-frequency stopwords. Chosen so that overlap between FR/DE/EN is
# minimal — words like "the" appear only in EN, "le/la/les" only in FR, etc.
_STOPWORDS: dict[LanguageCode, frozenset[str]] = {
    LanguageCode.FR: frozenset(
        {
            "le", "la", "les", "un", "une", "des", "du", "de", "et", "ou",
            "que", "qui", "dans", "pour", "avec", "sur", "est", "sont", "ce",
            "cette", "ces", "mon", "ma", "mes", "votre", "vos", "nous", "vous",
            "ils", "elles", "n'", "j'", "l'", "d'", "c'", "qu'",
            "compte", "banque", "carte", "virement", "épargne", "crédit",
        }
    ),
    LanguageCode.DE: frozenset(
        {
            "der", "die", "das", "ein", "eine", "und", "oder", "ist", "sind",
            "im", "in", "den", "dem", "des", "auf", "mit", "für", "von", "zu",
            "ich", "du", "er", "sie", "es", "wir", "ihr", "nicht", "kein",
            "keine", "haben", "habe", "hat", "sein", "war", "wird", "werden",
            "konto", "bank", "karte", "überweisung", "sparen", "kredit",
        }
    ),
    LanguageCode.EN: frozenset(
        {
            "the", "a", "an", "and", "or", "is", "are", "was", "were", "be",
            "been", "being", "have", "has", "had", "do", "does", "did", "will",
            "would", "could", "should", "i", "you", "he", "she", "it", "we",
            "they", "this", "that", "these", "those", "not", "no", "yes",
            "account", "bank", "card", "transfer", "savings", "credit",
        }
    ),
}

_TOKEN_RE = re.compile(r"[a-zA-ZàâäéèêëïîôöùûüçÀÂÄÉÈÊËÏÎÔÖÙÛÜÇßẞ]+")


@dataclass(frozen=True, slots=True)
class LanguageDetectionResult:
    """Outcome of language detection for a single utterance."""

    language: LanguageCode
    confidence: float
    fallback_used: bool


def detect_language(
    text: str,
    *,
    default: LanguageCode | None = None,
    min_confidence: float = 0.35,
) -> LanguageDetectionResult:
    """Detect the language of ``text`` using stopword-frequency scoring.

    Args:
        text: The raw user input.
        default: Language to fall back to when confidence is below
            ``min_confidence``. Defaults to the configured
            :attr:`Settings.default_language`.
        min_confidence: The threshold below which we treat the detection as
            unreliable and fall back to ``default``.

    Returns:
        A :class:`LanguageDetectionResult`. ``fallback_used`` indicates
        whether the result reflects detection or the configured default.
    """
    tokens = [match.group(0).lower() for match in _TOKEN_RE.finditer(text)]
    if not tokens:
        fallback = default if default is not None else get_settings().default_language
        return LanguageDetectionResult(
            language=fallback, confidence=0.0, fallback_used=True
        )

    scores: dict[LanguageCode, int] = {
        lang: sum(1 for token in tokens if token in stopwords)
        for lang, stopwords in _STOPWORDS.items()
    }
    total = sum(scores.values())
    if total == 0:
        fallback = default if default is not None else get_settings().default_language
        return LanguageDetectionResult(
            language=fallback, confidence=0.0, fallback_used=True
        )

    best_language = max(scores, key=lambda key: scores[key])
    confidence = scores[best_language] / total

    if confidence < min_confidence:
        fallback = default if default is not None else get_settings().default_language
        return LanguageDetectionResult(
            language=fallback, confidence=confidence, fallback_used=True
        )

    return LanguageDetectionResult(
        language=best_language, confidence=confidence, fallback_used=False
    )


def run(state: AgentState) -> dict[str, object]:
    """Router node entry point.

    Updates ``language`` and ``language_confidence`` on the state when the
    detector returns a confident result, or keeps the existing values if the
    caller already pinned them (useful in tests and replays).
    """
    if state.get("language_confidence", 0.0) > 0.99:
        # Caller has pinned the language explicitly; respect it.
        return {}

    detection = detect_language(state["user_input"])
    return {
        "language": detection.language,
        "language_confidence": detection.confidence,
    }
