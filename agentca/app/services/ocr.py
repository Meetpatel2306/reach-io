"""OCR — Gemini Flash Vision (FREE) for invoice photo → structured data."""

from __future__ import annotations
import json
import logging
from app.config import get_settings
from app.models.invoice import OCRInvoiceData

logger = logging.getLogger(__name__)

OCR_PROMPT = """Extract invoice data from this image. Return ONLY valid JSON:
{
  "supplier_name": "string or null",
  "supplier_gstin": "15-char GSTIN or null",
  "invoice_number": "string or null",
  "invoice_date": "DD/MM/YYYY or null",
  "items": [{"description": "item", "hsn_code": "code or null", "quantity": 1, "unit": "NOS", "rate": 100.0, "gst_rate": 18}],
  "subtotal": 0.0, "cgst": 0.0, "sgst": 0.0, "igst": 0.0, "total": 0.0,
  "confidence": 0.9
}
Indian GST rates: 0%, 5%, 12%, 18%, 28%. If CGST+SGST present, it's intra-state. If IGST, inter-state."""


async def extract_invoice_from_image(image_bytes: bytes) -> OCRInvoiceData:
    """Send invoice photo to Gemini Flash Vision → get structured data."""
    try:
        import google.generativeai as genai
        import PIL.Image
        import io

        s = get_settings()
        genai.configure(api_key=s.gemini_api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")

        image = PIL.Image.open(io.BytesIO(image_bytes))
        response = model.generate_content([OCR_PROMPT, image])

        # Parse JSON from response
        text = response.text or ""
        # Clean markdown code blocks if present
        text = text.strip()
        if text.startswith("```"):
            text = text.split("\n", 1)[1] if "\n" in text else text[3:]
        if text.endswith("```"):
            text = text[:-3]
        text = text.strip()

        data = json.loads(text)
        return OCRInvoiceData(**data)

    except Exception as e:
        logger.error(f"ocr_error: {e}")
        return OCRInvoiceData(confidence=0.0)


async def extract_invoice_from_text(ocr_text: str) -> OCRInvoiceData:
    """Fallback: extract from raw OCR text using Groq LLM."""
    from app.services.ai_engine import call_ai

    EXTRACT_PROMPT = """Extract invoice data from this OCR text of an Indian invoice.
Return ONLY valid JSON with: supplier_name, supplier_gstin, invoice_number, invoice_date,
items (description, hsn_code, quantity, unit, rate, gst_rate), subtotal, cgst, sgst, igst, total, confidence."""

    result = await call_ai(EXTRACT_PROMPT, ocr_text, json_mode=True)
    try:
        data = json.loads(result)
        return OCRInvoiceData(**data)
    except (json.JSONDecodeError, TypeError):
        return OCRInvoiceData(confidence=0.0)
