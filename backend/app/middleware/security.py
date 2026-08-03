"""
Security hardening:
 - HTTP security headers on every response
 - API rate limiting (slowapi / token bucket per client IP)
 - request body size cap (basic DoS guard)

Wired into app/main.py.
"""
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request
from slowapi import Limiter
from slowapi.util import get_remote_address

# Shared limiter instance -- import this in route files to add
# per-route limits, e.g. @limiter.limit("10/minute")
limiter = Limiter(key_func=get_remote_address, default_limits=["120/minute"])


class SecurityHeadersMiddleware(BaseHTTPMiddleware):
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        response.headers["X-Content-Type-Options"] = "nosniff"
        response.headers["X-Frame-Options"] = "DENY"
        response.headers["Referrer-Policy"] = "strict-origin-when-cross-origin"
        response.headers["X-XSS-Protection"] = "1; mode=block"
        # HSTS only matters behind HTTPS (e.g. in production behind a proxy);
        # harmless to send locally over HTTP.
        response.headers["Strict-Transport-Security"] = "max-age=63072000; includeSubDomains"
        response.headers["Permissions-Policy"] = "geolocation=(self), camera=(), microphone=(self)"
        return response


class BodySizeLimitMiddleware(BaseHTTPMiddleware):
    """Rejects request bodies over MAX_BODY_BYTES to blunt naive DoS /
    oversized-upload abuse. Image uploads (plan-from-image) get a higher
    limit; everything else is capped small."""

    MAX_JSON_BYTES = 256 * 1024        # 256 KB for normal JSON API calls
    MAX_UPLOAD_BYTES = 10 * 1024 * 1024  # 10 MB for image uploads

    async def dispatch(self, request: Request, call_next):
        content_length = request.headers.get("content-length")
        if content_length is not None:
            limit = self.MAX_UPLOAD_BYTES if "multipart/form-data" in request.headers.get("content-type", "") else self.MAX_JSON_BYTES
            if int(content_length) > limit:
                from starlette.responses import JSONResponse
                return JSONResponse(status_code=413, content={"detail": "Request body too large."})
        return await call_next(request)
