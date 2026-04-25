"""AI Engine — Groq (FREE primary) + Gemini Flash (FREE fallback)."""

from __future__ import annotations
import json
import logging
from groq import AsyncGroq
from app.config import get_settings
from app.production.circuit_breaker import groq_breaker, gemini_breaker, CircuitBreakerError

logger = logging.getLogger(__name__)

# ── Groq Client (Llama 3.3 70B — FREE) ──


def _groq_client() -> AsyncGroq:
    return AsyncGroq(api_key=get_settings().groq_api_key)


@groq_breaker
async def _call_groq(system_prompt: str, user_message: str, json_mode: bool = True) -> str:
    """Call Groq Llama 3.3 70B."""
    client = _groq_client()
    kwargs = {
        "model": "llama-3.3-70b-versatile",
        "messages": [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_message},
        ],
        "temperature": 0.1,
        "max_tokens": 1000,
    }
    if json_mode:
        kwargs["response_format"] = {"type": "json_object"}

    response = await client.chat.completions.create(**kwargs)
    return response.choices[0].message.content or ""


# ── Gemini Fallback (FREE) ──


async def _call_gemini(system_prompt: str, user_message: str) -> str:
    """Call Gemini Flash as fallback."""
    try:
        import google.generativeai as genai
        s = get_settings()
        if not s.gemini_api_key:
            raise ValueError("Gemini API key not configured")

        genai.configure(api_key=s.gemini_api_key)
        model = genai.GenerativeModel("gemini-1.5-flash")
        response = model.generate_content(f"{system_prompt}\n\nUser: {user_message}")
        return response.text or ""
    except Exception as e:
        logger.error(f"gemini_error: {e}")
        raise


# ── Fallback Chain ──


async def call_ai(system_prompt: str, user_message: str, json_mode: bool = True) -> str:
    """
    Call AI with fallback chain: Groq → Gemini → empty.
    Always returns a string (never crashes).
    """
    # Try Groq first (fastest, free)
    try:
        return await _call_groq(system_prompt, user_message, json_mode)
    except CircuitBreakerError:
        logger.warning("ai: Groq circuit open, trying Gemini")
    except Exception as e:
        logger.warning(f"ai: Groq failed ({e}), trying Gemini")

    # Try Gemini (free fallback)
    try:
        return await _call_gemini(system_prompt, user_message)
    except Exception as e:
        logger.error(f"ai: Gemini also failed ({e})")

    return ""


# ── Intent Classification ──

INTENT_PROMPT = """You are AgentCA's intent classifier for an Indian MSME accounting WhatsApp bot.
Given a user message (Hindi, English, Hinglish, Gujarati), classify the intent.

Return ONLY valid JSON:
{"intent": "<intent>", "confidence": <0-1>, "entities": {}}

Intents: create_invoice, record_expense, record_transaction, check_gst,
view_report, view_invoices, check_deadline, general_query, greeting, menu, help, unknown

Entity examples:
- create_invoice: {"customer": "name", "items": [{"name": "x", "qty": 1, "rate": 100}], "gst_rate": 18}
- record_expense: {"description": "bijli bill", "amount": 2500}
- record_transaction: {"amount": 15000, "type": "credit", "from": "name"}"""


async def classify_intent(message: str) -> dict:
    """Classify user message intent. Returns dict with intent, confidence, entities."""
    result = await call_ai(INTENT_PROMPT, message, json_mode=True)
    try:
        return json.loads(result)
    except (json.JSONDecodeError, TypeError):
        # Keyword fallback
        msg = message.lower()
        if any(w in msg for w in ["invoice", "bill", "बिल", "बना", "bana"]):
            return {"intent": "create_invoice", "confidence": 0.5, "entities": {}}
        if any(w in msg for w in ["gst", "tax", "टैक्स"]):
            return {"intent": "check_gst", "confidence": 0.5, "entities": {}}
        if any(w in msg for w in ["report", "रिपोर्ट", "summary"]):
            return {"intent": "view_report", "confidence": 0.5, "entities": {}}
        if any(w in msg for w in ["hi", "hello", "namaste", "नमस्ते"]):
            return {"intent": "greeting", "confidence": 0.8, "entities": {}}
        if any(w in msg for w in ["menu", "मेनू"]):
            return {"intent": "menu", "confidence": 0.8, "entities": {}}
        if any(w in msg for w in ["help", "मदद"]):
            return {"intent": "help", "confidence": 0.8, "entities": {}}
        return {"intent": "unknown", "confidence": 0.0, "entities": {}}


# ── Conversational Response ──

CONVERSATION_PROMPT = """You are AgentCA, a friendly AI accountant for Indian small businesses.
Communicate via WhatsApp in {language}. Keep messages SHORT (under 300 chars).
Be warm: use "ji" suffix, emojis sparingly. Explain GST simply, not jargon.
Business: {business_name}, Owner: {owner_name}, GSTIN: {gstin}"""


async def generate_response(
    message: str,
    language: str = "hi",
    business_name: str = "",
    owner_name: str = "",
    gstin: str = "",
) -> str:
    """Generate a conversational response."""
    prompt = CONVERSATION_PROMPT.format(
        language=language,
        business_name=business_name or "Unknown",
        owner_name=owner_name or "User",
        gstin=gstin or "N/A",
    )
    result = await call_ai(prompt, message, json_mode=False)
    return result or "Samjha nahi, kya aap dobara bhej sakte hain?"


# ── SMS Parser ──

SMS_PROMPT = """Parse this Indian bank/UPI SMS. Return ONLY valid JSON:
{"amount": number, "type": "credit"|"debit", "counterparty": "name or null",
"date": "YYYY-MM-DD or null", "reference_id": "string or null",
"mode": "upi"|"neft"|"rtgs"|"imps", "category_suggestion": "sale"|"purchase"|"expense"|"other",
"confidence": 0.0-1.0}"""


async def parse_sms(sms_text: str) -> dict:
    """Parse bank/UPI SMS into structured transaction data."""
    result = await call_ai(SMS_PROMPT, sms_text, json_mode=True)
    try:
        return json.loads(result)
    except (json.JSONDecodeError, TypeError):
        return {"amount": 0, "type": "unknown", "confidence": 0}


# ── Voice Command Parser ──

VOICE_PROMPT = """Parse this transcribed voice command from an Indian business owner.
The transcription may be Hindi, English, Hinglish, or Gujarati.
Return ONLY valid JSON:
{"action": "create_invoice"|"record_purchase"|"record_expense"|"record_payment"|"query",
"data": {relevant extracted data}, "confidence": 0.0-1.0}

For create_invoice: data = {"customer_name": "", "items": [{"name": "", "quantity": 0, "rate": 0}], "gst_rate": 0}
For record_purchase/expense: data = {"description": "", "amount": 0, "supplier_name": ""}
For record_payment: data = {"amount": 0, "from_name": "", "mode": "upi|cash"}"""


async def parse_voice_command(transcription: str) -> dict:
    """Parse voice command transcription."""
    result = await call_ai(VOICE_PROMPT, transcription, json_mode=True)
    try:
        return json.loads(result)
    except (json.JSONDecodeError, TypeError):
        return {"action": "query", "data": {"text": transcription}, "confidence": 0}
