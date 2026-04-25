"""Message deduplication — WhatsApp sometimes sends duplicate webhooks."""

from __future__ import annotations
import logging
from app import database as db

logger = logging.getLogger(__name__)


def is_duplicate_message(whatsapp_msg_id: str) -> bool:
    """
    Check if we've already processed this WhatsApp message.
    Returns True if duplicate (should skip processing).
    """
    if not whatsapp_msg_id:
        return False

    try:
        existing = db.select_one(
            "processed_messages",
            {"whatsapp_msg_id": whatsapp_msg_id},
        )
        return existing is not None
    except Exception:
        # On error, allow processing (fail open)
        return False


def mark_message_processed(
    whatsapp_msg_id: str,
    business_id: str | None = None,
    result: str = "success",
) -> None:
    """Record that we've processed this message (for deduplication)."""
    if not whatsapp_msg_id:
        return

    try:
        db.insert("processed_messages", {
            "whatsapp_msg_id": whatsapp_msg_id,
            "business_id": business_id,
            "result": result,
        })
    except Exception as e:
        # Duplicate key = already recorded = fine
        logger.debug(f"mark_processed: {e}")
