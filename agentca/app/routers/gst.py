"""GST API — summaries and return tracking."""

from __future__ import annotations
from fastapi import APIRouter
from app import database as db
from app.services.gst_calculator import calculate_net_liability

router = APIRouter(prefix="/api/v1", tags=["gst"])


@router.get("/businesses/{business_id}/gst/summary")
async def gst_summary(business_id: str, period: str | None = None):
    """Get GST summary for a period (MMYYYY). Defaults to current month."""
    from datetime import date
    from app.utils.date_helpers import get_gst_period

    period = period or get_gst_period()
    month = int(period[:2])
    year = int(period[2:])

    # Get sales and purchases for the period
    sales = db.select("invoices", {"business_id": business_id, "invoice_type": "sale"})
    purchases = db.select("invoices", {"business_id": business_id, "invoice_type": "purchase"})

    # Filter by period
    period_start = f"{year}-{month:02d}-01"
    if month == 12:
        period_end = f"{year + 1}-01-01"
    else:
        period_end = f"{year}-{month + 1:02d}-01"

    month_sales = [s for s in sales if period_start <= (s.get("invoice_date", "") or "") < period_end]
    month_purchases = [p for p in purchases if period_start <= (p.get("invoice_date", "") or "") < period_end]

    output_cgst = sum(s.get("cgst", 0) or 0 for s in month_sales)
    output_sgst = sum(s.get("sgst", 0) or 0 for s in month_sales)
    output_igst = sum(s.get("igst", 0) or 0 for s in month_sales)

    input_cgst = sum(p.get("cgst", 0) or 0 for p in month_purchases)
    input_sgst = sum(p.get("sgst", 0) or 0 for p in month_purchases)
    input_igst = sum(p.get("igst", 0) or 0 for p in month_purchases)

    liability = calculate_net_liability(output_cgst, output_sgst, output_igst, input_cgst, input_sgst, input_igst)

    return {
        "period": period,
        "total_sales": sum(s.get("subtotal", 0) or 0 for s in month_sales),
        "total_purchases": sum(p.get("subtotal", 0) or 0 for p in month_purchases),
        "output_cgst": output_cgst,
        "output_sgst": output_sgst,
        "output_igst": output_igst,
        "input_cgst": input_cgst,
        "input_sgst": input_sgst,
        "input_igst": input_igst,
        "sale_count": len(month_sales),
        "purchase_count": len(month_purchases),
        **liability,
    }
