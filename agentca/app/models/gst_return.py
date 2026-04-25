"""GST return schemas."""

from __future__ import annotations
from datetime import date
from pydantic import BaseModel


class GSTReturnCreate(BaseModel):
    business_id: str
    return_type: str       # GSTR1, GSTR3B, GSTR9, CMP08
    period: str            # MMYYYY
    deadline: date


class GSTReturnResponse(BaseModel):
    id: str
    business_id: str
    return_type: str
    period: str
    status: str
    arn: str | None = None
    filed_at: str | None = None
    deadline: str
    is_deleted: bool = False
    created_at: str | None = None


class GSTSummary(BaseModel):
    """Monthly GST summary."""
    period: str
    total_sales: float = 0
    total_purchases: float = 0
    output_cgst: float = 0
    output_sgst: float = 0
    output_igst: float = 0
    input_cgst: float = 0
    input_sgst: float = 0
    input_igst: float = 0
    net_cgst_payable: float = 0
    net_sgst_payable: float = 0
    net_igst_payable: float = 0
    net_tax_payable: float = 0
    b2b_invoice_count: int = 0
    b2c_sales: float = 0
