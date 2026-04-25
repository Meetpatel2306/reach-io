"""Health check — verify all dependencies are reachable."""

from __future__ import annotations
import logging
from app.config import get_settings

logger = logging.getLogger(__name__)


async def check_health() -> dict:
    """
    Check health of all dependencies.
    Returns dict with status of each service.
    Used by /health endpoint and UptimeRobot.
    """
    results = {
        "status": "healthy",
        "services": {},
    }

    # Check Supabase
    try:
        from app.database import get_db
        db = get_db()
        db.table("businesses").select("id").limit(1).execute()
        results["services"]["database"] = "ok"
    except Exception as e:
        results["services"]["database"] = f"error: {e}"
        results["status"] = "degraded"

    # Check Groq
    try:
        from groq import Groq
        s = get_settings()
        if s.groq_api_key:
            results["services"]["groq"] = "configured"
        else:
            results["services"]["groq"] = "not_configured"
    except Exception:
        results["services"]["groq"] = "not_available"

    # Check Gemini
    try:
        s = get_settings()
        if s.gemini_api_key:
            results["services"]["gemini"] = "configured"
        else:
            results["services"]["gemini"] = "not_configured"
    except Exception:
        results["services"]["gemini"] = "not_available"

    # Check Redis
    try:
        from app.production.rate_limiter import _get_redis
        redis = _get_redis()
        if redis:
            redis.ping()
            results["services"]["redis"] = "ok"
        else:
            results["services"]["redis"] = "not_configured"
    except Exception as e:
        results["services"]["redis"] = f"error: {e}"

    return results
