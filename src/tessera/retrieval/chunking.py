"""Document chunking strategy.

We chunk on sentence boundaries with a fixed character-budget window and a
configurable overlap. The strategy is intentionally simple: a more
sophisticated chunker (semantic similarity, recursive splitting) is on the
backlog but adds complexity that the day-twenty deadline does not justify.
"""

from __future__ import annotations

import re
import unicodedata
from dataclasses import dataclass
from typing import Final

from tessera.settings import LanguageCode

__all__ = ["Chunk", "ChunkerConfig", "chunk_text"]


_DEFAULT_TARGET: Final[int] = 800
_DEFAULT_OVERLAP: Final[int] = 150
_DEFAULT_MIN: Final[int] = 200
_SENTENCE_RE = re.compile(r"(?<=[.!?])\s+(?=[A-ZÀ-Ÿ\d])")


@dataclass(frozen=True, slots=True)
class ChunkerConfig:
    """Chunker tunables, exposed so tests can override per-corpus."""

    target_chars: int = _DEFAULT_TARGET
    overlap_chars: int = _DEFAULT_OVERLAP
    minimum_chars: int = _DEFAULT_MIN


@dataclass(frozen=True, slots=True)
class Chunk:
    """A single chunk emitted by :func:`chunk_text`."""

    text: str
    start: int
    end: int
    language: LanguageCode


def _normalise(text: str) -> str:
    """Strip control characters and collapse whitespace."""
    text = unicodedata.normalize("NFKC", text)
    text = "".join(ch for ch in text if ch.isprintable() or ch in "\n\t")
    text = re.sub(r"[ \t]+", " ", text)
    text = re.sub(r"\n{3,}", "\n\n", text)
    return text.strip()


def _split_sentences(text: str) -> list[str]:
    parts = _SENTENCE_RE.split(text)
    return [p.strip() for p in parts if p.strip()]


def chunk_text(
    text: str,
    *,
    language: LanguageCode,
    config: ChunkerConfig | None = None,
) -> list[Chunk]:
    """Split ``text`` into overlapping chunks suitable for embedding.

    Args:
        text: The full document body.
        language: The document's language, propagated onto every chunk.
        config: Optional override of the default chunker tunables.

    Returns:
        A list of :class:`Chunk` objects in document order. Empty when the
        normalised text falls below the minimum chunk length.
    """
    cfg = config or ChunkerConfig()
    cleaned = _normalise(text)
    if len(cleaned) < cfg.minimum_chars:
        return []

    sentences = _split_sentences(cleaned)
    chunks: list[Chunk] = []
    buffer: list[str] = []
    buffer_len = 0
    cursor = 0

    def flush(end_pos: int) -> None:
        nonlocal buffer, buffer_len
        body = " ".join(buffer).strip()
        if len(body) >= cfg.minimum_chars:
            chunks.append(
                Chunk(text=body, start=cursor, end=end_pos, language=language)
            )
        buffer = []
        buffer_len = 0

    for sentence in sentences:
        if buffer_len + len(sentence) + 1 > cfg.target_chars:
            flush(end_pos=cursor + buffer_len)
            # Carry over enough trailing sentences to satisfy the overlap.
            if cfg.overlap_chars > 0 and chunks:
                tail = chunks[-1].text[-cfg.overlap_chars:]
                buffer.append(tail)
                buffer_len = len(tail)
            cursor = max(0, cursor + buffer_len)
        buffer.append(sentence)
        buffer_len += len(sentence) + 1

    flush(end_pos=cursor + buffer_len)
    return chunks
