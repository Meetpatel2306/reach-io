"""Soft delete helpers with audit logging.

Every delete in AgentCA is a soft delete. Data is NEVER permanently removed.
This module wraps database.soft_delete with audit logging.
"""

from __future__ import annotations
from app import database as db
from app.production.audit_log import log_action


def delete_record(
    table: str,
    row_id: str,
    deleted_by: str | None = None,
    business_id: str | None = None,
) -> dict:
    """Soft delete a record with audit logging."""
    # Fetch current data for audit trail
    old_data = db.select_one(table, {"id": row_id}, include_deleted=True)

    result = db.soft_delete(table, row_id, deleted_by=deleted_by)

    if old_data:
        log_action(
            business_id=business_id,
            actor_type="user" if deleted_by else "system",
            actor_id=deleted_by,
            action="delete",
            entity_type=table,
            entity_id=row_id,
            old_data=old_data,
        )

    return result


def restore_record(
    table: str,
    row_id: str,
    restored_by: str | None = None,
    business_id: str | None = None,
) -> dict:
    """Restore a soft-deleted record with audit logging."""
    result = db.restore(table, row_id)

    log_action(
        business_id=business_id,
        actor_type="user" if restored_by else "system",
        actor_id=restored_by,
        action="restore",
        entity_type=table,
        entity_id=row_id,
    )

    return result


def cascade_delete(
    parent_table: str,
    parent_id: str,
    child_table: str,
    fk_column: str,
    deleted_by: str | None = None,
    business_id: str | None = None,
) -> int:
    """Soft delete parent + all children (e.g., invoice + invoice_items)."""
    # Delete parent
    delete_record(parent_table, parent_id, deleted_by, business_id)

    # Delete children
    children = db.select(child_table, {fk_column: parent_id})
    for child in children:
        db.soft_delete(child_table, child["id"], deleted_by)

    return len(children)
