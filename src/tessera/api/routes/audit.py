"""Read-only audit-trail endpoint.

For the demo we expose the audit log via a thin filesystem-backed reader so
that the dashboard at ``webapp/frontend/app/audit/page.tsx`` has something
real to render. The production wiring queries Cloud Logging directly; the
schema returned by both readers is identical, defined here as
:class:`AuditEntry`.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, HTTPException, Query
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter(tags=["audit"])


class AuditEntry(BaseModel):
    """One audit-trail entry, identical in shape across sinks."""

    model_config = ConfigDict(extra="ignore")

    occurred_at: str
    target: str
    outcome: Literal["allowed", "denied", "error"]
    arguments: dict[str, object] = Field(default_factory=dict)
    decisions: list[dict[str, object]] = Field(default_factory=list)
    error: str | None = None


class AuditPage(BaseModel):
    """Paged audit response."""

    model_config = ConfigDict(extra="forbid")

    entries: list[AuditEntry]
    cursor: int
    has_more: bool


_AUDIT_FILE_ENV = "TESSERA_AUDIT_FILE"
_DEFAULT_AUDIT_FILE = Path("/var/log/tessera/audit.log")
_PAGE_DEFAULT = 50
_PAGE_MAX = 500


def _resolve_audit_path() -> Path:
    raw = os.environ.get(_AUDIT_FILE_ENV)
    return Path(raw) if raw else _DEFAULT_AUDIT_FILE


def _read_entries(path: Path) -> list[AuditEntry]:
    if not path.exists():
        return []
    out: list[AuditEntry] = []
    with path.open("r", encoding="utf-8") as fp:
        for line in fp:
            line = line.strip()
            if not line:
                continue
            try:
                payload = json.loads(line)
            except json.JSONDecodeError:
                continue
            try:
                out.append(AuditEntry(**payload))
            except Exception:  # noqa: BLE001  skip malformed entry
                continue
    return out


@router.get("/audit", response_model=AuditPage)
async def audit_list(
    cursor: Annotated[int, Query(ge=0)] = 0,
    limit: Annotated[int, Query(ge=1, le=_PAGE_MAX)] = _PAGE_DEFAULT,
    target: Annotated[str | None, Query()] = None,
    outcome: Annotated[
        Literal["allowed", "denied", "error"] | None, Query()
    ] = None,
) -> AuditPage:
    """Return a paged slice of the audit log."""
    path = _resolve_audit_path()
    entries = _read_entries(path)
    if target:
        entries = [e for e in entries if e.target == target]
    if outcome:
        entries = [e for e in entries if e.outcome == outcome]
    if cursor >= len(entries) and entries:
        raise HTTPException(status_code=416, detail="cursor beyond end of log")
    slice_ = entries[cursor : cursor + limit]
    return AuditPage(
        entries=slice_,
        cursor=cursor + len(slice_),
        has_more=(cursor + len(slice_)) < len(entries),
    )
