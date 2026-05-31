"""HTTP security primitives: security-headers middleware and route-level authz.

These complement, rather than replace, the existing :class:`AuthMiddleware`.
The header set is hand-rolled (≈ one dict) instead of pulling a dependency so
it stays auditable and deployment-aware (ADR 0008): HSTS is emitted only when
TLS is actually terminated for this deployment.

The route-level authorization dependency is defence in depth for the read
surfaces (``/audit``, ``/memory``): when a bearer token is configured these
routes require it even if the global middleware were ever bypassed.
"""

from __future__ import annotations

import secrets
from typing import TYPE_CHECKING

from fastapi import HTTPException, Request, status
from starlette.middleware.base import BaseHTTPMiddleware

from tessera.settings import get_settings

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from starlette.responses import Response

__all__ = ["SecurityHeadersMiddleware", "require_bearer"]


# A conservative, framework-agnostic header set. CSP is intentionally strict:
# the API serves JSON and (in non-prod) the Swagger UI at /docs, which needs a
# small allowance handled by FastAPI's own assets; we keep a default-deny base.
_STATIC_HEADERS: dict[str, str] = {
    "X-Content-Type-Options": "nosniff",
    "X-Frame-Options": "DENY",
    "Referrer-Policy": "strict-origin-when-cross-origin",
    "Cross-Origin-Opener-Policy": "same-origin",
    "Permissions-Policy": "camera=(), microphone=(), geolocation=()",
    "Content-Security-Policy": "default-src 'none'; frame-ancestors 'none'; base-uri 'none'",
}

# RFC 6797: two years, include subdomains, eligible for preload.
_HSTS_VALUE = "max-age=63072000; includeSubDomains; preload"


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    """Attach security headers to every response (ADR 0008).

    HSTS is conditional on ``settings.hsts_enabled`` so an on-prem deployment
    that terminates TLS at a separate proxy (or runs plain HTTP internally) does
    not advertise a policy it cannot honour.
    """

    async def dispatch(
        self,
        request: Request,
        call_next: Callable[[Request], Awaitable[Response]],
    ) -> Response:
        """Run the handler, then stamp the response with security headers."""
        response = await call_next(request)
        settings = get_settings()
        if not settings.api.security_headers_enabled:
            return response
        for key, value in _STATIC_HEADERS.items():
            response.headers.setdefault(key, value)
        if settings.hsts_enabled:
            response.headers.setdefault("Strict-Transport-Security", _HSTS_VALUE)
        return response


def require_bearer(request: Request) -> None:
    """FastAPI dependency: enforce the bearer token at the route level.

    Defence in depth for the read surfaces. A no-op when no token is configured
    (the documented CI posture), so health and local development stay reachable
    without secret material — mirroring :class:`AuthMiddleware`.
    """
    token = get_settings().api.bearer_token
    if token is None:
        return
    expected = token.get_secret_value()
    header = request.headers.get("authorization", "")
    if not header.lower().startswith("bearer "):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="missing bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
    presented = header[len("bearer ") :].strip()
    if not secrets.compare_digest(presented, expected):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="invalid bearer token",
            headers={"WWW-Authenticate": "Bearer"},
        )
