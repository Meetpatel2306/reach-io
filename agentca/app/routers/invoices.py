"""Invoice API — CRUD with soft delete."""

from __future__ import annotations
from fastapi import APIRouter, HTTPException
from app import database as db
from app.production.soft_delete import delete_record, restore_record

router = APIRouter(prefix="/api/v1", tags=["invoices"])


@router.get("/businesses/{business_id}/invoices")
async def list_invoices(business_id: str, limit: int = 20, offset: int = 0):
    return db.select("invoices", {"business_id": business_id}, order_by="-invoice_date", limit=limit, offset=offset)


@router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str):
    inv = db.select_one("invoices", {"id": invoice_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    items = db.select("invoice_items", {"invoice_id": invoice_id})
    return {"invoice": inv, "items": items}


@router.delete("/invoices/{invoice_id}")
async def delete_invoice(invoice_id: str):
    """Soft delete — never permanent."""
    inv = db.select_one("invoices", {"id": invoice_id})
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    delete_record("invoices", invoice_id, business_id=inv.get("business_id"))
    # Also soft-delete line items
    items = db.select("invoice_items", {"invoice_id": invoice_id})
    for item in items:
        db.soft_delete("invoice_items", item["id"])
    return {"status": "deleted", "invoice_id": invoice_id}


@router.post("/invoices/{invoice_id}/restore")
async def restore_invoice(invoice_id: str):
    """Restore a soft-deleted invoice."""
    inv = db.select_one("invoices", {"id": invoice_id}, include_deleted=True)
    if not inv:
        raise HTTPException(status_code=404, detail="Invoice not found")
    restore_record("invoices", invoice_id, business_id=inv.get("business_id"))
    items = db.select("invoice_items", {"invoice_id": invoice_id}, include_deleted=True)
    for item in items:
        db.restore("invoice_items", item["id"])
    return {"status": "restored", "invoice_id": invoice_id}
