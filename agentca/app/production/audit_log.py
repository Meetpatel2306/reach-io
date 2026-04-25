"""Audit logging — track who did what, when."""

from __future__ import annotations
import logging
from app import database as db

logger = logging.getLogger(__name__)


def log_action(
    business_id: str | None = None,
    actor_type: str = "system",
    actor_id: str | None = None,
    action: str = "",
    entity_type: str = "",
    entity_id: str | None = None,
    old_data: dict | None = None,
    new_data: dict | None = None,
    metadata: dict | None = None,
) -> None:
    """Write an audit log entry. Never fails — errors are logged but swallowed."""
    try:
        db.insert("audit_logs", {
            "business_id": business_id,
            "actor_type": actor_type,
            "actor_id": actor_id,
            "action": action,
            "entity_type": entity_type,
            "entity_id": str(entity_id) if entity_id else None,
            "old_data": old_data,
            "new_data": new_data,
            "metadata": metadata,
        })
    except Exception as e:
        # Audit logging must NEVER crash the main flow
        logger.warning(f"audit_log_failed: {e}")
