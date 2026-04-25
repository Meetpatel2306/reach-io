"""Supabase database client with soft-delete-aware query helpers."""

from __future__ import annotations
from datetime import datetime, timezone
from supabase import create_client, Client
from app.config import get_settings

_client: Client | None = None


def get_db() -> Client:
    """Get Supabase client singleton."""
    global _client
    if _client is None:
        s = get_settings()
        _client = create_client(s.supabase_url, s.supabase_key)
    return _client


# ── CRUD with automatic soft-delete filtering ──────────────────


def insert(table: str, data: dict) -> dict:
    """Insert a row and return it."""
    result = get_db().table(table).insert(data).execute()
    return result.data[0] if result.data else {}


def select(
    table: str,
    filters: dict | None = None,
    include_deleted: bool = False,
    order_by: str | None = None,
    limit: int = 100,
    offset: int = 0,
) -> list[dict]:
    """Select rows — automatically excludes soft-deleted records."""
    query = get_db().table(table).select("*")

    if not include_deleted:
        query = query.eq("is_deleted", False)

    if filters:
        for key, value in filters.items():
            query = query.eq(key, value)

    if order_by:
        desc = order_by.startswith("-")
        col = order_by.lstrip("-")
        query = query.order(col, desc=desc)

    result = query.range(offset, offset + limit - 1).execute()
    return result.data or []


def select_one(table: str, filters: dict, include_deleted: bool = False) -> dict | None:
    """Select a single row."""
    rows = select(table, filters, include_deleted=include_deleted, limit=1)
    return rows[0] if rows else None


def update(table: str, row_id: str, data: dict) -> dict:
    """Update a row by ID."""
    data["updated_at"] = datetime.now(timezone.utc).isoformat()
    result = get_db().table(table).update(data).eq("id", row_id).execute()
    return result.data[0] if result.data else {}


def upsert(table: str, data: dict) -> dict:
    """Upsert a row."""
    result = get_db().table(table).upsert(data).execute()
    return result.data[0] if result.data else {}


def count(table: str, filters: dict | None = None, include_deleted: bool = False) -> int:
    """Count rows matching filters."""
    query = get_db().table(table).select("id", count="exact")
    if not include_deleted:
        query = query.eq("is_deleted", False)
    if filters:
        for key, value in filters.items():
            query = query.eq(key, value)
    result = query.execute()
    return result.count or 0


# ── Soft Delete Operations ──────────────────────────────────────


def soft_delete(table: str, row_id: str, deleted_by: str | None = None) -> dict:
    """Soft delete — mark as deleted, never remove from DB."""
    data = {
        "is_deleted": True,
        "deleted_at": datetime.now(timezone.utc).isoformat(),
        "deleted_by": deleted_by,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = get_db().table(table).update(data).eq("id", row_id).execute()
    return result.data[0] if result.data else {}


def restore(table: str, row_id: str) -> dict:
    """Restore a soft-deleted record."""
    data = {
        "is_deleted": False,
        "deleted_at": None,
        "deleted_by": None,
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    result = get_db().table(table).update(data).eq("id", row_id).execute()
    return result.data[0] if result.data else {}
