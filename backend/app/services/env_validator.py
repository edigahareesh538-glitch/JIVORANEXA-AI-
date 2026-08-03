"""Environment variable validation (Phase 16).

Raises EnvironmentError at app startup when a required secret is missing
or has the documented insecure default. Catches the most common
deployment footgun: forgetting to set JWT_SECRET_KEY in production.
"""
from __future__ import annotations

import secrets as _secrets
import string

INSECURE_JWT_DEFAULTS = {
    "dev-only-insecure-secret-change-me",
    "secret",
    "changeme",
    "",
}


def validate_environment(allow_insecure: bool = False) -> dict[str, str]:
    """Return a dict of environment warnings/errors. With
    `allow_insecure=False` (default) we hard-fail on JWT_SECRET_KEY being
    the dev default. With True (local dev convenience) we just log them."""
    warnings: list[str] = []
    errors: list[str] = []
    from app.services.config import settings
    if settings.JWT_SECRET_KEY in INSECURE_JWT_DEFAULTS:
        msg = (f"JWT_SECRET_KEY is the insecure dev default or empty. "
               f"Generate one with: python -c \"import secrets; print(secrets.token_hex(32))\".")
        if allow_insecure:
            warnings.append(msg)
        else:
            errors.append(msg)
    if not settings.CORS_ORIGINS:
        warnings.append("CORS_ORIGINS is empty - browser requests will be blocked.")
    if not errors:
        return {"status": "ok", "warnings": warnings}
    if allow_insecure:
        return {"status": "warn", "warnings": warnings + [f"[would-error] {e}" for e in errors]}
    raise EnvironmentError("; ".join(errors))


def suggest_secret(length: int = 64) -> str:
    """Helper for first-time setup: returns a strong secret."""
    alphabet = string.ascii_letters + string.digits
    return "".join(_secrets.choice(alphabet) for _ in range(length))
