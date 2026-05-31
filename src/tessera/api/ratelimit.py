"""Rate limiting middleware (ADR 0008).

The windowing and storage are delegated to the ``limits`` library (the same
engine that backs slowapi) — we do not reinvent the algorithm. Tessera adds only
a thin, deployment-aware middleware:

* a **key function** that prefers the bearer-token identity over the client IP,
  so an authenticated caller is limited as themselves, not by shared NAT;
* **per-surface limits**: a strict limit on ``POST /chat`` (LLM cost) and a
  looser one on the read endpoints;
* **deployment-aware enforcement**: on-prem there is no upstream load balancer to
  absorb abuse, so the limiter cannot be silently disabled there
  (``Settings.rate_limit_required``).

Storage defaults to in-memory (per-instance). For multi-instance Cloud Run, set
``api.rate_limit_storage_uri`` to a shared ``redis://`` URI for global limits.
"""

from __future__ import annotations

from typing import TYPE_CHECKING

from limits import RateLimitItem, parse
from limits.storage import storage_from_string
from limits.strategies import MovingWindowRateLimiter
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.responses import JSONResponse

from tessera.settings import get_settings

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from starlette.requests import Request
    from starlette.responses import Response

__all__ = ["RateLimitMiddleware", "client_identity"]

# Endpoints that get the strict (LLM-cost) limit; everything else gets the read
# limit. Keyed by (method, path).
_STRICT_ROUTES: frozenset[tuple[str, str]] = frozenset({("POST", "/chat")})
# Never rate-limit liveness/readiness/metrics — they must stay scrapeable.
_EXEMPT_PATHS: frozenset[str] = frozenset({"/healthz", "/readyz", "/metrics"})


def client_identity(request: Request) -> str:
    """Rate-limit key: bearer token if present, else client IP.

    The token value stays server-side (it is the limiter key, never echoed), so
    an authenticated caller is throttled as themselves rather than by shared IP.
    """
    header = request.headers.get("authorization", "")
    if header.lower().startswith("bearer "):
        token = header[len("bearer ") :].strip()
        if token:
            return f"tok:{token}"
    client = request.client
    return f"ip:{client.host if client else 'unknown'}"


class RateLimitMiddleware(BaseHTTPMiddleware):
    """Sliding-window rate limiting backed by the ``limits`` library."""

    def __init__(self, app: object) -> None:
        super().__init__(app)  # type: ignore[arg-type]
        settings = get_settings()
        self._enabled = settings.rate_limit_required
        self._strict: RateLimitItem = parse(settings.api.rate_limit_chat)
        self._read: RateLimitItem = parse(settings.api.rate_limit_read)
        storage_uri = settings.api.rate_limit_storage_uri or "memory://"
        self._limiter = MovingWindowRateLimiter(storage_from_string(storage_uri))

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """Check the limit for this caller+surface, else 429."""
        if not self._enabled or request.url.path in _EXEMPT_PATHS:
            return await call_next(request)

        item = (
            self._strict
            if (request.method, request.url.path) in _STRICT_ROUTES
            else self._read
        )
        identity = client_identity(request)
        # hit() returns False when the window is exhausted.
        if not self._limiter.hit(item, identity, request.url.path):
            retry_after = str(item.get_expiry())
            return JSONResponse(
                {"detail": "rate limit exceeded"},
                status_code=429,
                headers={"Retry-After": retry_after},
            )
        return await call_next(request)
