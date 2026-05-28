"""Ingest the EU regulatory corpus (DORA, CNIL, BaFin, GDPR).

The script reads from ``src/tessera/corpus/data/regulations_*.json`` and
delegates the actual chunking + embedding + insertion to
:func:`tessera.corpus.ingestion.ingest_path`.
"""

from __future__ import annotations

import asyncio
import sys

from tessera.corpus.ingestion import main

if __name__ == "__main__":
    raise SystemExit(asyncio.run(main(sys.argv[1:])))
