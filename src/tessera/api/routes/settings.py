"""Runtime application-settings endpoints (read + write superadmin grants).

These endpoints carry no role check of their own — the service is reached only
through the trusted front (BFF), which holds the bearer token and enforces who
may write (the superadmin). The agent persists the flag; the front decides who
flips it. See ADR 0009 for the identity-at-the-front model.
"""

from __future__ import annotations

from fastapi import APIRouter
from pydantic import BaseModel

from tessera.api.settings_store import get_synthesis_admin, set_synthesis_admin

router = APIRouter(prefix="/settings", tags=["settings"])


class SynthesisAdminFlag(BaseModel):
    """Whether the ``admin`` role may view the failure synthesis."""

    enabled: bool


@router.get("/synthesis-admin", response_model=SynthesisAdminFlag)
async def read_synthesis_admin() -> SynthesisAdminFlag:
    """Return the current admin-visibility grant for the synthesis."""
    return SynthesisAdminFlag(enabled=await get_synthesis_admin())


@router.put("/synthesis-admin", response_model=SynthesisAdminFlag)
async def write_synthesis_admin(flag: SynthesisAdminFlag) -> SynthesisAdminFlag:
    """Grant or revoke admin visibility of the synthesis (superadmin action)."""
    return SynthesisAdminFlag(enabled=await set_synthesis_admin(enabled=flag.enabled))
