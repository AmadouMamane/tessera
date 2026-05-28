"""Corpus generation, ingestion, and on-disk catalogue.

Three submodules:

* :mod:`tessera.corpus.generator` builds synthetic Crédit Aurore product
  pages from a structured catalogue.
* :mod:`tessera.corpus.translator` produces FR/DE/EN parallels via the LLM
  router (with mandatory human review before merge).
* :mod:`tessera.corpus.ingestion` chunks + embeds + inserts documents into
  the pgvector store.
"""

from __future__ import annotations
