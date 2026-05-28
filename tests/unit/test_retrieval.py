"""Unit tests for the retrieval layer's deterministic helpers."""

from __future__ import annotations

from tessera.retrieval.chunking import ChunkerConfig, chunk_text
from tessera.retrieval.reranking import lexical_score, rerank
from tessera.retrieval.store import VectorHit
from tessera.settings import LanguageCode


class TestChunker:
    def test_short_text_is_dropped(self) -> None:
        chunks = chunk_text("court.", language=LanguageCode.FR)
        assert chunks == []

    def test_long_text_yields_multiple_chunks(self) -> None:
        body = (
            "Premier paragraphe. " * 40
            + "\n\n"
            + "Deuxième paragraphe avec encore plus de contenu. " * 60
        )
        chunks = chunk_text(
            body,
            language=LanguageCode.FR,
            config=ChunkerConfig(target_chars=400, overlap_chars=80, minimum_chars=100),
        )
        assert len(chunks) >= 2
        for chunk in chunks:
            assert chunk.language is LanguageCode.FR
            assert chunk.text.strip()


class TestReranker:
    def test_lexical_score_rewards_overlap(self) -> None:
        score_match = lexical_score(
            "solde compte courant",
            "Le solde du compte courant est de 1234 euros.",
        )
        score_miss = lexical_score(
            "solde compte courant",
            "Bonjour comment allez-vous aujourd'hui ?",
        )
        assert score_match > score_miss

    def test_rerank_orders_by_fused_score(self) -> None:
        hits = [
            VectorHit(
                source="doc-a",
                chunk_id="1",
                language=LanguageCode.EN,
                text="The mortgage rate offered today is 3.5%.",
                metadata={},
                score=0.8,
            ),
            VectorHit(
                source="doc-b",
                chunk_id="1",
                language=LanguageCode.EN,
                text="Generic banking information unrelated to mortgages.",
                metadata={},
                score=0.85,
            ),
        ]
        reranked = rerank("mortgage rate today", hits)
        assert reranked[0].hit.source == "doc-a"
