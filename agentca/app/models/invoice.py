"""Invoice and line item schemas."""

from __future__ import annotations
from datetime import date
from enum import Enum
from pydantic import BaseModel


class InvoiceType(str, Enum):
    SALE = "sale"
    PURCHASE = "purchase"
    CREDIT_NOTE = "credit_note"
    DEBIT_NOTE = "debit_note"


class InvoiceStatus(str, Enum):
    DRAFT = "draft"
    SENT = "sent"
    PAID = "paid"
    CANCELLED = "cancelled"


class InvoiceSource(str, Enum):
    MANUAL = "manual"
    PHOTO = "photo"
    VOICE = "voice"
    SMS_AUTO = "sms_auto"


class InvoiceItemCreate(BaseModel):
    description: str
    hsn_code: str | None = None
    quantity: float = 1.0
    unit: str = "NOS"
    rate: float
    gst_rate: float
    discount_percent: float = 0.0


class InvoiceCreate(BaseModel):
    business_id: str
    contact_id: str | None = None
    invoice_type: InvoiceType
    invoice_date: date
    due_date: date | None = None
    items: list[InvoiceItemCreate] = []
    payment_mode: str | None = None
    source: InvoiceSource = InvoiceSource.MANUAL
    original_image_url: str | None = None


class InvoiceResponse(BaseModel):
    id: str
    business_id: str
    contact_id: str | None = None
    invoice_number: str
    invoice_type: str
    invoice_date: str
    subtotal: float
    cgst: float
    sgst: float
    igst: float
    total: float
    status: str
    payment_status: str = "unpaid"
    source: str
    is_deleted: bool = False
    created_at: str | None = None


class OCRInvoiceData(BaseModel):
    """Data extracted from invoice photo via Gemini Vision."""
    supplier_name: str | None = None
    supplier_gstin: str | None = None
    invoice_number: str | None = None
    invoice_date: str | None = None
    items: list[InvoiceItemCreate] = []
    subtotal: float | None = None
    cgst: float | None = None
    sgst: float | None = None
    igst: float | None = None
    total: float | None = None
    confidence: float = 0.0
