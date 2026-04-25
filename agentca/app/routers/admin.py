"""Admin API — platform stats and management."""

from __future__ import annotations
from fastapi import APIRouter
from app import database as db
from app.production.health import check_health

router = APIRouter(prefix="/api/v1/admin", tags=["admin"])


@router.get("/stats")
async def platform_stats():
    """Platform-wide statistics."""
    return {
        "businesses": db.count("businesses"),
        "invoices": db.count("invoices"),
        "transactions": db.count("transactions"),
        "deleted_businesses": db.count("businesses", include_deleted=True) - db.count("businesses"),
    }


@router.get("/health")
async def health_check():
    """Detailed health check."""
    return await check_health()
