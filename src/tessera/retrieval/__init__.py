"""Retrieval layer.

The retrieval layer is implemented in five small modules:

* :mod:`tessera.retrieval.chunking` — splits long documents into overlapping
  semantic chunks.
* :mod:`tessera.retrieval.embeddings` — produces dense vectors via Vertex AI
  or Ollama, depending on the resolved LLM profile.
* :mod:`tessera.retrieval.store` — owns the pgvector connection pool and
  the schema migrations.
* :mod:`tessera.retrieval.reranking` — score-blends vector and lexical
  signals into a final order.
* :mod:`tessera.retrieval.hybrid_search` — the public entrypoint used by the
  workers; orchestrates the four above.

Callers should import :mod:`tessera.retrieval.hybrid_search` rather than the
internal modules directly.
"""

from __future__ import annotations

from tessera.retrieval import (
    chunking,
    embeddings,
    hybrid_search,
    reranking,
    store,
)

__all__ = ["chunking", "embeddings", "hybrid_search", "reranking", "store"]
