"""Retry decorator with exponential backoff for external API calls."""

from __future__ import annotations
import asyncio
import logging
from functools import wraps
from typing import Type

logger = logging.getLogger(__name__)


def retry(
    max_attempts: int = 3,
    backoff_base: float = 2.0,
    exceptions: tuple[Type[Exception], ...] = (Exception,),
    on_retry_log: str | None = None,
):
    """
    Decorator for retrying async functions with exponential backoff.

    Usage:
        @retry(max_attempts=3, exceptions=(httpx.TimeoutException,))
        async def call_groq(prompt):
            ...
    """
    def decorator(func):
        @wraps(func)
        async def wrapper(*args, **kwargs):
            last_exception = None
            for attempt in range(1, max_attempts + 1):
                try:
                    return await func(*args, **kwargs)
                except exceptions as e:
                    last_exception = e
                    if attempt < max_attempts:
                        delay = backoff_base ** (attempt - 1)
                        log_msg = on_retry_log or func.__name__
                        logger.warning(
                            f"retry: {log_msg} attempt {attempt}/{max_attempts} "
                            f"failed ({e}), retrying in {delay}s"
                        )
                        await asyncio.sleep(delay)
                    else:
                        logger.error(
                            f"retry: {func.__name__} failed after {max_attempts} attempts"
                        )
            raise last_exception  # type: ignore
        return wrapper
    return decorator
