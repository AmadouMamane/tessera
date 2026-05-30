"""Unit tests for the Tier 0 sliding-window memory backend and the contract types."""

from __future__ import annotations

import uuid

import pytest

from tessera.agent.state import ConversationMessage
from tessera.memory import EntityLedger, MemoryBackend, get_memory_backend, scope_for
from tessera.memory.window import WindowBackend, strip_format_directives
from tessera.settings import LanguageCode


def _scope():
    return scope_for(uuid.UUID(int=1), LanguageCode.FR)


def _msgs(*pairs: tuple[str, str]) -> list[ConversationMessage]:
    return [ConversationMessage(role=role, content=content) for role, content in pairs]  # type: ignore[arg-type]


class TestWindowBackend:
    async def test_returns_only_prior_messages_excluding_current(self) -> None:
        backend = WindowBackend(history_window=6)
        messages = _msgs(
            ("user", "première question"),
            ("assistant", "première réponse"),
            ("user", "question courante"),  # current turn — excluded
        )
        ctx = await backend.load(scope=_scope(), messages=messages, query="question courante")
        assert [m.content for m in ctx.recent_verbatim] == [
            "première question",
            "première réponse",
        ]
        assert ctx.summary is None
        assert ctx.entities.is_empty()
        assert ctx.long_term == []

    async def test_window_keeps_only_last_n(self) -> None:
        backend = WindowBackend(history_window=2)
        messages = _msgs(
            ("user", "u1"),
            ("assistant", "a1"),
            ("user", "u2"),
            ("assistant", "a2"),
            ("user", "current"),
        )
        ctx = await backend.load(scope=_scope(), messages=messages, query="current")
        assert [m.content for m in ctx.recent_verbatim] == ["u2", "a2"]

    async def test_strips_format_directives_from_user_history(self) -> None:
        backend = WindowBackend(history_window=6)
        messages = _msgs(
            ("user", "Quel est mon solde ? réponds en 2 lignes"),
            ("assistant", "Votre solde est de 100 €."),
            ("user", "current"),
        )
        ctx = await backend.load(scope=_scope(), messages=messages, query="current")
        # The one-shot directive must not survive into injected history.
        assert "réponds en 2 lignes" not in ctx.recent_verbatim[0].content
        assert ctx.recent_verbatim[0].content.startswith("Quel est mon solde")
        # Assistant content is left untouched.
        assert ctx.recent_verbatim[1].content == "Votre solde est de 100 €."

    async def test_empty_history(self) -> None:
        backend = WindowBackend(history_window=6)
        ctx = await backend.load(scope=_scope(), messages=_msgs(("user", "only")), query="only")
        assert ctx.recent_verbatim == []

    async def test_record_and_forget_are_noops(self) -> None:
        backend = WindowBackend()
        # Should not raise and should persist nothing.
        await backend.forget(scope=_scope())


class TestStripFormatDirectives:
    @pytest.mark.parametrize(
        ("raw", "needle"),
        [
            ("Mon solde ? réponds en 3 mots", "réponds en 3 mots"),
            ("Balance? answer in 2 lines", "answer in 2 lines"),
            ("Kontostand? antworte in 2 Zeilen", "antworte in 2 Zeilen"),
            ("Explique brièvement", "brièvement"),
        ],
    )
    def test_removes_directive(self, raw: str, needle: str) -> None:
        assert needle not in strip_format_directives(raw)


class TestFactory:
    def test_default_backend_is_window(self) -> None:
        backend = get_memory_backend()
        assert isinstance(backend, WindowBackend)
        # Structural conformance to the Protocol.
        assert isinstance(backend, MemoryBackend)

    def test_missing_extra_raises_with_hint(self, monkeypatch: pytest.MonkeyPatch) -> None:
        # Selecting an external adapter whose optional extra is not installed is
        # an explicit, actionable error — not a silent fallback.
        monkeypatch.setenv("TESSERA_MEMORY__BACKEND", "mem0")
        from tessera.settings import get_settings

        get_settings.cache_clear()
        get_memory_backend.cache_clear()
        try:
            import mem0  # noqa: F401
        except ImportError:
            from tessera.memory.adapters import MissingMemoryExtraError

            with pytest.raises(MissingMemoryExtraError, match="memory-mem0"):
                get_memory_backend()
        else:
            pytest.skip("mem0 is installed; missing-extra path not exercised")


class TestEntityLedger:
    def test_is_empty(self) -> None:
        assert EntityLedger().is_empty()
        assert not EntityLedger(amounts=("100 €",)).is_empty()

    def test_merge_unions_and_dedups_preserving_order(self) -> None:
        a = EntityLedger(amounts=("100 €", "200 €"), citations=("DORA Art. 28",))
        b = EntityLedger(amounts=("200 €", "300 €"))
        merged = a.merge(b)
        assert merged.amounts == ("100 €", "200 €", "300 €")
        assert merged.citations == ("DORA Art. 28",)
