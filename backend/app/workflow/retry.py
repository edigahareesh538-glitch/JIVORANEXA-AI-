"""Retry & Error Handler.

retry -> timeout -> switch API -> still failed -> ask user
"""
from typing import Callable, Any
from app.logs.action_logger import ActionLogger


def with_retry(
    fn: Callable[[], Any],
    fallback_fn: Callable[[], Any] | None,
    step_name: str,
    logger: ActionLogger,
    max_attempts: int = 2,
) -> tuple[Any, bool]:
    """Returns (result, needs_user_input)."""
    for attempt in range(1, max_attempts + 1):
        result = fn()
        if not (isinstance(result, dict) and result.get("status") == "failed"):
            if attempt > 1:
                logger.log(f"{step_name} succeeded after retry #{attempt - 1}", status="ok")
            return result, False
        logger.log(f"{step_name} failed (attempt {attempt}): {result.get('reason')}", status="retry")

    if fallback_fn:
        logger.log(f"{step_name}: switching to alternative provider", status="retry")
        result = fallback_fn()
        if not (isinstance(result, dict) and result.get("status") == "failed"):
            return result, False

    logger.log(f"{step_name}: still failing after retries, asking user", status="error")
    return None, True
