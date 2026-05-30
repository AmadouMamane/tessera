"""Unit tests for long-term ranking and backend Protocol conformance (ADR 0007)."""

from __future__ import annotations

from datetime import UTC, datetime, timedelta

import pytest

from tessera.memory import MemoryBackend
from tessera.memory.persistent import PersistentBackend, rank_memories
from tessera.memory.protocol import EntityLedger, MemoryItem
from tessera.memory.summary import SummaryBackend
from tessera.memory.window import WindowBackend


def _item(text: str, *, score: float, age_days: float, importance: float) -> MemoryItem:
    return MemoryItem(
        kind="semantic",
        text=text,
        entities=EntityLedger(),
        score=score,
        created_at=datetime.now(UTC) - timedelta(days=age_days),
        importance=importance,
    )


class TestRankMemories:
    def test_recent_beats_stale_at_equal_relevance(self) -> None:
        items = [
            _item("stale", score=0.9, age_days=120, importance=0.5),
            _item("fresh", score=0.9, age_days=0, importance=0.5),
        ]
        ranked = rank_memories(items, top_k=2)
        assert ranked[0].text == "fresh"

    def test_importance_breaks_ties(self) -> None:
        items = [
            _item("low", score=0.8, age_days=1, importance=0.1),
            _item("high", score=0.8, age_days=1, importance=0.9),
        ]
        ranked = rank_memories(items, top_k=2)
        assert ranked[0].text == "high"

    def test_relevance_dominates_when_recency_equal(self) -> None:
        items = [
            _item("weak", score=0.2, age_days=1, importance=0.5),
            _item("strong", score=0.95, age_days=1, importance=0.5),
        ]
        ranked = rank_memories(items, top_k=1)
        assert ranked[0].text == "strong"

    def test_top_k_truncates(self) -> None:
        items = [_item(f"m{i}", score=0.5, age_days=i, importance=0.5) for i in range(10)]
        assert len(rank_memories(items, top_k=3)) == 3


class TestProtocolConformance:
    @pytest.mark.parametrize(
        "backend",
        [WindowBackend(), SummaryBackend(), PersistentBackend()],
    )
    def test_native_backends_satisfy_protocol(self, backend: object) -> None:
        # Structural conformance: each native tier is a valid MemoryBackend.
        assert isinstance(backend, MemoryBackend)
