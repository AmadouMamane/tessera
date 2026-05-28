"""Hybrid (vector + lexical) search — the public entry point for retrieval.

Workers call :func:`search` to obtain a ranked list of
:class:`RetrievedDocument` instances. The implementation:

1. Embeds the query using the active backend.
2. Runs an HNSW nearest-neighbour query against pgvector.
3. Reranks the candidates with RRF fusion.
4. Materialises :class:`RetrievedDocument` records for the agent state.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from tessera.agent.state import RetrievedDocument
from tessera.retrieval import embeddings, reranking, store

if TYPE_CHECKING:
    from tessera.settings import LanguageCode

__all__ = ["search"]


_VECTOR_OVERFETCH: int = 3


async def search(
    *,
    query: str,
    language: LanguageCode,
    corpus: str,
    top_k: int = 4,
) -> list[RetrievedDocument]:
    """Search ``corpus`` for ``query`` in ``language`` and return top-k hits.

    Over-fetches by :data:`_VECTOR_OVERFETCH` from the vector index so the
    reranker has enough candidates to meaningfully reorder.
    """
    if not query.strip():
        return []

    [query_vec] = await embeddings.embed([query])
    raw_hits = await store.knn_search(
        query_embedding=query_vec,
        corpus=corpus,
        language=language,
        top_k=top_k * _VECTOR_OVERFETCH,
    )
    if not raw_hits:
        return []

    reranked = reranking.rerank(query=query, hits=raw_hits, top_k=top_k)
    return [
        RetrievedDocument(
            source=item.hit.source,
            chunk_id=item.hit.chunk_id,
            language=item.hit.language,
            text=item.hit.text,
            score=item.fused_score,
            metadata=item.hit.metadata,
        )
        for item in reranked
    ]
