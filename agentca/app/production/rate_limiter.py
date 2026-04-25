"""Redis-based rate limiting using Upstash (FREE tier)."""

from __future__ import annotations
import time
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)

# Lazy Redis client
_redis = None


def _get_redis():
    global _redis
    if _redis is None:
        try:
            from upstash_redis import Redis
            s = get_settings()
            if s.upstash_redis_url and s.upstash_redis_token:
                _redis = Redis(url=s.upstash_redis_url, token=s.upstash_redis_token)
            else:
                logger.warning("rate_limiter: Redis not configured, rate limiting disabled")
        except ImportError:
            logger.warning("rate_limiter: upstash-redis not installed")
    return _redis


def is_rate_limited(
    key: str,
    max_requests: int,
    window_seconds: int,
) -> bool:
    """
    Check if a key is rate-limited using sliding window counter.

    Args:
        key: Unique identifier (e.g., "ai:91XXXXXXXXXX")
        max_requests: Maximum allowed requests in the window
        window_seconds: Window size in seconds

    Returns:
        True if rate limited, False if allowed
    """
    redis = _get_redis()
    if redis is None:
        return False  # No Redis = no rate limiting (dev mode)

    try:
        full_key = f"rl:{key}"
        current = redis.get(full_key)

        if current is None:
            redis.set(full_key, 1, ex=window_seconds)
            return False

        count = int(current)
        if count >= max_requests:
            logger.warning(f"rate_limited: {key} ({count}/{max_requests})")
            return True

        redis.incr(full_key)
        return False

    except Exception as e:
        logger.warning(f"rate_limiter_error: {e}")
        return False  # Fail open — don't block users on Redis errors


# ── Pre-configured rate limit checks ──


def check_ai_rate_limit(phone: str) -> bool:
    """Max 50 AI calls per user per hour (protect free tier)."""
    return is_rate_limited(f"ai:{phone}", max_requests=50, window_seconds=3600)


def check_webhook_rate_limit(ip: str) -> bool:
    """Max 100 webhook requests per IP per minute."""
    return is_rate_limited(f"wh:{ip}", max_requests=100, window_seconds=60)


def check_invoice_rate_limit(phone: str) -> bool:
    """Max 20 invoices per user per hour."""
    return is_rate_limited(f"inv:{phone}", max_requests=20, window_seconds=3600)
