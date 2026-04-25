"""Transaction API — CRUD with soft delete."""

from __future__ import annotations
from fastapi import APIRouter, HTTPException
from app import database as db
from app.production.soft_delete import delete_record, restore_record

router = APIRouter(prefix="/api/v1", tags=["transactions"])


@router.get("/businesses/{business_id}/transactions")
async def list_transactions(business_id: str, limit: int = 20, offset: int = 0):
    return db.select("transactions", {"business_id": business_id}, order_by="-transaction_date", limit=limit, offset=offset)


@router.delete("/transactions/{txn_id}")
async def delete_transaction(txn_id: str):
    txn = db.select_one("transactions", {"id": txn_id})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    delete_record("transactions", txn_id, business_id=txn.get("business_id"))
    return {"status": "deleted"}


@router.post("/transactions/{txn_id}/restore")
async def restore_transaction(txn_id: str):
    txn = db.select_one("transactions", {"id": txn_id}, include_deleted=True)
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    restore_record("transactions", txn_id, business_id=txn.get("business_id"))
    return {"status": "restored"}
