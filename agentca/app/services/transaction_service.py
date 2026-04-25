"""Transaction CRUD with soft delete."""

from __future__ import annotations
from app import database as db
from app.models.transaction import TransactionCreate
from app.production.audit_log import log_action


def record_transaction(data: TransactionCreate) -> dict:
    """Record a new transaction."""
    txn = db.insert("transactions", {
        "business_id": data.business_id,
        "amount": data.amount,
        "type": data.type,
        "description": data.description,
        "category": data.category,
        "sub_category": data.sub_category,
        "source": data.source,
        "raw_sms": data.raw_sms,
        "transaction_date": data.transaction_date.isoformat(),
        "reference_id": data.reference_id,
        "counterparty_name": data.counterparty_name,
        "is_confirmed": data.source == "manual",
    })

    # Update business stats
    biz = db.select_one("businesses", {"id": data.business_id})
    if biz:
        db.update("businesses", data.business_id, {
            "total_transactions": (biz.get("total_transactions", 0) or 0) + 1,
        })

    log_action(
        business_id=data.business_id,
        actor_type="user",
        action="create",
        entity_type="transactions",
        entity_id=txn["id"],
        new_data={"amount": data.amount, "type": data.type, "source": data.source},
    )

    return txn


def confirm_transaction(txn_id: str) -> dict:
    """Mark a transaction as confirmed by user."""
    return db.update("transactions", txn_id, {"is_confirmed": True})


def link_to_invoice(txn_id: str, invoice_id: str) -> dict:
    """Link a transaction to an invoice (reconciliation)."""
    return db.update("transactions", txn_id, {
        "invoice_id": invoice_id,
        "is_reconciled": True,
    })


def get_transactions(business_id: str, limit: int = 20) -> list[dict]:
    return db.select("transactions", {"business_id": business_id}, order_by="-transaction_date", limit=limit)
