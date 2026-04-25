"""Scheduled tasks — daily summaries and filing reminders.

NOTE: On Render free tier, there's no built-in cron.
Use UptimeRobot to ping /api/cron/daily at 8 PM IST for daily summaries.
Or use GitHub Actions scheduled workflow.
"""

from __future__ import annotations
import logging
from datetime import date
from app import database as db
from app.services import whatsapp as wa
from app.utils.formatters import format_inr
from app.utils.date_helpers import get_gstr1_deadline, get_gstr3b_deadline, days_until

logger = logging.getLogger(__name__)


async def send_daily_summary(business_id: str) -> None:
    """Send daily transaction summary to a business."""
    biz = db.select_one("businesses", {"id": business_id})
    if not biz or biz.get("is_deleted"):
        return

    today = date.today()
    txns = db.select("transactions", {"business_id": business_id})

    # Filter today's transactions
    today_credit = sum(
        t["amount"] for t in txns
        if t.get("transaction_date") == today.isoformat() and t.get("type") == "credit"
    )
    today_debit = sum(
        t["amount"] for t in txns
        if t.get("transaction_date") == today.isoformat() and t.get("type") == "debit"
    )

    name = biz.get("owner_name", "")
    msg = (
        f"📊 Aaj ka summary ({today.strftime('%d %b')}):\n\n"
        f"💰 Income: {format_inr(today_credit)}\n"
        f"💸 Expense: {format_inr(today_debit)}\n"
        f"📈 Net: {format_inr(today_credit - today_debit)}\n"
    )

    # Add deadline info
    gstr1_deadline = get_gstr1_deadline(today.month, today.year)
    gstr3b_deadline = get_gstr3b_deadline(today.month, today.year)
    days_gstr1 = days_until(gstr1_deadline)
    days_gstr3b = days_until(gstr3b_deadline)

    if 0 < days_gstr1 <= 7:
        msg += f"\n⚠️ GSTR-1 deadline: {days_gstr1} din baaki!"
    if 0 < days_gstr3b <= 7:
        msg += f"\n⚠️ GSTR-3B deadline: {days_gstr3b} din baaki!"

    await wa.send_text(biz["phone"], msg)


async def run_daily_summaries() -> int:
    """Send daily summaries to all active businesses. Returns count sent."""
    businesses = db.select("businesses", {"is_active": True, "onboarding_step": 6})
    count = 0
    for biz in businesses:
        try:
            await send_daily_summary(biz["id"])
            count += 1
        except Exception as e:
            logger.error(f"daily_summary_error: {biz['id']}: {e}")
    return count
