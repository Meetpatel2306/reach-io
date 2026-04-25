"""Invoice CRUD with soft delete, audit logging, and auto-numbering."""

from __future__ import annotations
from datetime import date
from app import database as db
from app.models.invoice import InvoiceCreate, InvoiceItemCreate
from app.services.gst_calculator import calculate_item_tax, is_intra_state
from app.production.audit_log import log_action
from app.utils.date_helpers import get_fiscal_year_label


def generate_invoice_number(business_id: str) -> str:
    """Generate next invoice number: INV/2026-27/001."""
    biz = db.select_one("businesses", {"id": business_id})
    if not biz:
        return "INV/0000/001"

    prefix = biz.get("invoice_prefix", "INV")
    next_num = biz.get("next_invoice_number", 1)
    fy = get_fiscal_year_label()

    # Increment counter
    db.update("businesses", business_id, {"next_invoice_number": next_num + 1})

    return f"{prefix}/{fy}/{next_num:03d}"


def create_invoice(data: InvoiceCreate) -> dict:
    """Create invoice with line items and tax calculations."""
    biz = db.select_one("businesses", {"id": data.business_id})
    if not biz:
        raise ValueError("Business not found")

    buyer_state = biz.get("state_code", "")
    invoice_number = generate_invoice_number(data.business_id)

    # Calculate totals
    total_subtotal = 0.0
    total_cgst = 0.0
    total_sgst = 0.0
    total_igst = 0.0
    total_amount = 0.0

    # Determine if intra-state (for tax type)
    contact = None
    if data.contact_id:
        contact = db.select_one("contacts", {"id": data.contact_id})

    contact_state = (contact or {}).get("state_code", buyer_state)
    intra = is_intra_state(buyer_state, contact_state)

    # Process items
    processed_items = []
    for i, item in enumerate(data.items):
        tax = calculate_item_tax(
            taxable_amount=item.quantity * item.rate * (1 - item.discount_percent / 100),
            gst_rate=item.gst_rate,
            intra_state=intra,
        )
        processed_items.append({
            "description": item.description,
            "hsn_code": item.hsn_code,
            "quantity": item.quantity,
            "unit": item.unit,
            "rate": item.rate,
            "discount_percent": item.discount_percent,
            "gst_rate": item.gst_rate,
            "taxable_amount": tax["taxable_amount"],
            "cgst_amount": tax["cgst"],
            "sgst_amount": tax["sgst"],
            "igst_amount": tax["igst"],
            "cess_amount": 0,
            "total_amount": tax["total"],
            "sort_order": i,
        })
        total_subtotal += tax["taxable_amount"]
        total_cgst += tax["cgst"]
        total_sgst += tax["sgst"]
        total_igst += tax["igst"]
        total_amount += tax["total"]

    # Round off
    round_off = round(total_amount) - total_amount
    final_total = round(total_amount)

    # Insert invoice
    invoice = db.insert("invoices", {
        "business_id": data.business_id,
        "contact_id": data.contact_id,
        "invoice_number": invoice_number,
        "invoice_type": data.invoice_type,
        "invoice_date": data.invoice_date.isoformat(),
        "due_date": data.due_date.isoformat() if data.due_date else None,
        "subtotal": total_subtotal,
        "cgst": total_cgst,
        "sgst": total_sgst,
        "igst": total_igst,
        "round_off": round_off,
        "total": final_total,
        "status": "draft",
        "payment_mode": data.payment_mode,
        "source": data.source,
        "original_image_url": data.original_image_url,
    })

    # Insert line items
    for item_data in processed_items:
        item_data["invoice_id"] = invoice["id"]
        db.insert("invoice_items", item_data)

    # Update business stats
    db.update("businesses", data.business_id, {
        "total_invoices": (biz.get("total_invoices", 0) or 0) + 1,
    })

    # Audit
    log_action(
        business_id=data.business_id,
        actor_type="user",
        action="create",
        entity_type="invoices",
        entity_id=invoice["id"],
        new_data={"invoice_number": invoice_number, "total": final_total, "type": data.invoice_type},
    )

    return invoice


def get_invoices(business_id: str, invoice_type: str | None = None, limit: int = 20) -> list[dict]:
    """Get invoices for a business (soft-delete-aware)."""
    filters = {"business_id": business_id}
    if invoice_type:
        filters["invoice_type"] = invoice_type
    return db.select("invoices", filters, order_by="-invoice_date", limit=limit)
