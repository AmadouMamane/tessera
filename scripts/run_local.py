"""Boot the Tessera FastAPI app for local development.

Equivalent to ``uv run tessera`` (the console script) but lives at a path the
README quickstart can document plainly.
"""

from __future__ import annotations

from tessera.api.main import cli


def main() -> None:
    cli()


if __name__ == "__main__":
    main()
