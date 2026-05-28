"""Run the failure-catalogue regression harness from the CLI.

Thin wrapper around :func:`eval.runner.main` — the documented entry point in
the README quickstart.
"""

from __future__ import annotations

import sys

from eval.runner import main


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
