"""Generate synthetic Crédit Aurore product corpus pages.

The generator produces deterministic, multilingual product pages for the
fictional retail bank. Output goes to ``src/tessera/corpus/data/``; the
seed_demo script then ingests the result.
"""

from __future__ import annotations

import asyncio
import sys

from tessera.corpus.generator import main


if __name__ == "__main__":
    raise SystemExit(asyncio.run(main(sys.argv[1:])))
