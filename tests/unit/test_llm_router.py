"""Unit tests for the LLM router and budget tracker."""

from __future__ import annotations

from decimal import Decimal

import pytest

from tessera.llm.budget import BudgetTracker
from tessera.llm.router import get_chat_backend
from tessera.settings import LLMProfile, get_settings


class TestBudgetTracker:
    def test_records_accumulate(self) -> None:
        tracker = BudgetTracker()
        tracker.record(
            backend="vertex-ai",
            model="gemini-2.0-flash-001",
            input_tokens=1000,
            output_tokens=500,
        )
        snapshot = tracker.snapshot()
        assert snapshot.input_tokens == 1000
        assert snapshot.output_tokens == 500
        assert snapshot.estimated_cost_eur > Decimal("0")

    def test_unknown_model_costs_zero(self) -> None:
        tracker = BudgetTracker()
        tracker.record(
            backend="unknown",
            model="mystery-model",
            input_tokens=10_000,
            output_tokens=10_000,
        )
        snapshot = tracker.snapshot()
        assert snapshot.estimated_cost_eur == Decimal("0")

    def test_reset_zeroes_counters(self) -> None:
        tracker = BudgetTracker()
        tracker.record(
            backend="ollama",
            model="llama3.3:70b",
            input_tokens=1,
            output_tokens=1,
        )
        tracker.reset()
        snapshot = tracker.snapshot()
        assert snapshot.input_tokens == 0
        assert snapshot.output_tokens == 0


class TestProfileResolution:
    def test_auto_falls_back_to_on_prem_without_vertex_project(self) -> None:
        get_settings.cache_clear()
        settings = get_settings()
        assert settings.resolved_llm_profile() is LLMProfile.ON_PREM

    def test_get_chat_backend_returns_ollama_by_default(
        self, monkeypatch: pytest.MonkeyPatch
    ) -> None:
        get_chat_backend.cache_clear()
        backend = get_chat_backend()
        assert backend.name == "ollama"
