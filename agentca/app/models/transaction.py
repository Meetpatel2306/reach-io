"""Transaction schemas (bank/UPI)."""

from __future__ import annotations
from datetime import date
from pydantic import BaseModel


class TransactionCreate(BaseModel):
    business_id: str
    amount: float
    type: str              # credit, debit
    description: str | None = None
    category: str | None = None
    sub_category: str | None = None
    source: str = "manual"  # upi_sms, bank_sms, manual
    raw_sms: str | None = None
    transaction_date: date
    reference_id: str | None = None
    counterparty_name: str | None = None


class TransactionResponse(BaseModel):
    id: str
    business_id: str
    amount: float
    type: str
    description: str | None = None
    category: str | None = None
    counterparty_name: str | None = None
    source: str
    transaction_date: str
    is_confirmed: bool
    is_reconciled: bool = False
    invoice_id: str | None = None
    is_deleted: bool = False
    created_at: str | None = None


class SMSParseResult(BaseModel):
    """Structured data from a parsed bank/UPI SMS."""
    amount: float
    type: str              # credit, debit
    counterparty: str | None = None
    date: str | None = None
    reference_id: str | None = None
    bank_account_last4: str | None = None
    mode: str = "upi"      # upi, neft, rtgs, imps
    category_suggestion: str = "other"
    confidence: float = 0.0
