"""Invoice PDF generation — HTML template → WeasyPrint → PDF."""

from __future__ import annotations
import logging
from pathlib import Path
from jinja2 import Template
from app.utils.formatters import format_inr
from app.utils.number_to_words import amount_in_words
from app.utils.date_helpers import format_indian_date

logger = logging.getLogger(__name__)

TEMPLATE_PATH = Path(__file__).parent.parent / "templates" / "invoice.html"


def generate_invoice_pdf(
    invoice: dict,
    items: list[dict],
    business: dict,
    contact: dict | None = None,
) -> bytes:
    """Generate PDF bytes from invoice data."""
    try:
        from weasyprint import HTML
    except ImportError:
        logger.error("weasyprint not installed — PDF generation unavailable")
        return b""

    template_str = TEMPLATE_PATH.read_text(encoding="utf-8")
    template = Template(template_str)

    html_content = template.render(
        invoice=invoice,
        items=items,
        business=business,
        contact=contact or {},
        format_inr=format_inr,
        amount_words=amount_in_words(invoice.get("total", 0)),
    )

    pdf_bytes = HTML(string=html_content).write_pdf()
    logger.info(f"pdf_generated: {invoice.get('invoice_number', 'unknown')} ({len(pdf_bytes)} bytes)")
    return pdf_bytes
