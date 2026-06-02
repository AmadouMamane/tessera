"""Run the failure-catalogue regression harness from the CLI.

Thin wrapper around :func:`eval.runner.main` — the documented entry point in
the README quickstart.
"""

from __future__ import annotations

import sys
from pathlib import Path

# When invoked directly (`python scripts/run_eval.py`), sys.path[0] is this
# script's directory, not the repo root — so the top-level `eval` package is not
# importable. Put the repo root on the path before importing it.
sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from eval.runner import main

if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
