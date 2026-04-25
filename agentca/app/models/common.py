"""Common Pydantic models — shared across all entities."""

from __future__ import annotations
from datetime import datetime
from pydantic import BaseModel


class SoftDeleteMixin(BaseModel):
    """Mixin for all entities that support soft delete."""
    is_deleted: bool = False
    deleted_at: datetime | None = None
    deleted_by: str | None = None


class TimestampMixin(BaseModel):
    """Mixin for created_at / updated_at."""
    created_at: datetime | None = None
    updated_at: datetime | None = None


class PaginatedResponse(BaseModel):
    """Standard paginated response wrapper."""
    data: list = []
    total: int = 0
    page: int = 1
    page_size: int = 20
    has_more: bool = False


class SuccessResponse(BaseModel):
    success: bool = True
    message: str = ""


class ErrorResponse(BaseModel):
    success: bool = False
    error: str = ""
    detail: str | None = None
