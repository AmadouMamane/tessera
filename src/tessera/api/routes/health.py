"""Liveness, readiness, and metrics endpoints."""

from __future__ import annotations

from fastapi import APIRouter, Response, status
from pydantic import BaseModel

from tessera import __version__
from tessera.llm import get_budget_tracker

router = APIRouter(tags=["ops"])


class HealthResponse(BaseModel):
    """Body returned by ``/healthz`` and ``/readyz``."""

    status: str
    version: str


@router.get("/healthz", response_model=HealthResponse)
async def liveness() -> HealthResponse:
    """Liveness probe — returns 200 as soon as the process is up."""
    return HealthResponse(status="ok", version=__version__)


@router.get("/readyz", response_model=HealthResponse)
async def readiness() -> HealthResponse:
    """Readiness probe — distinct from liveness so deployments can stagger."""
    return HealthResponse(status="ready", version=__version__)


@router.get("/budget", response_class=Response, status_code=status.HTTP_200_OK)
async def budget() -> Response:
    """Return the running LLM-cost estimate as text/plain for quick scrapes."""
    snapshot = get_budget_tracker().snapshot()
    body = (
        f"input_tokens {snapshot.input_tokens}\n"
        f"output_tokens {snapshot.output_tokens}\n"
        f"estimated_cost_eur {snapshot.estimated_cost_eur:.6f}\n"
    )
    return Response(content=body, media_type="text/plain")
