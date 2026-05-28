"""Non-regression evaluation harness.

The harness exercises the agent against a catalogue of publicly documented
agent failures (under ``eval/failures/``). Each failure case is one JSON
file validated against ``eval/failures/_schema.json``.

The package is not part of the runtime wheel — it ships as an ``eval`` group
in ``pyproject.toml`` so contributors can ``uv sync --group eval`` without
pulling the harness deps into production.
"""

from __future__ import annotations
