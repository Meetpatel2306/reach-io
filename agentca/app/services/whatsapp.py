"""WhatsApp Cloud API wrapper — Meta direct (no BSP fees)."""

from __future__ import annotations
import logging
import httpx
from app.config import get_settings
from app.production.retry import retry
from app.production.pii import mask_phone

logger = logging.getLogger(__name__)

BASE_URL = "https://graph.facebook.com/v21.0"


def _headers() -> dict:
    s = get_settings()
    return {
        "Authorization": f"Bearer {s.whatsapp_token}",
        "Content-Type": "application/json",
    }


def _url(endpoint: str = "messages") -> str:
    s = get_settings()
    return f"{BASE_URL}/{s.whatsapp_phone_number_id}/{endpoint}"


@retry(max_attempts=2, exceptions=(httpx.TimeoutException, httpx.HTTPStatusError))
async def send_text(phone: str, text: str) -> dict:
    """Send a plain text message."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(_url(), headers=_headers(), json={
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "text",
            "text": {"body": text},
        })
        resp.raise_for_status()
        logger.info(f"wa_sent: text to {mask_phone(phone)}")
        return resp.json()


@retry(max_attempts=2, exceptions=(httpx.TimeoutException, httpx.HTTPStatusError))
async def send_buttons(phone: str, body: str, buttons: list[dict]) -> dict:
    """
    Send interactive button message.
    buttons: [{"id": "confirm", "title": "Confirm"}] (max 3 buttons)
    """
    btn_list = [{"type": "reply", "reply": b} for b in buttons[:3]]
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(_url(), headers=_headers(), json={
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "interactive",
            "interactive": {
                "type": "button",
                "body": {"text": body},
                "action": {"buttons": btn_list},
            },
        })
        resp.raise_for_status()
        return resp.json()


@retry(max_attempts=2, exceptions=(httpx.TimeoutException, httpx.HTTPStatusError))
async def send_document(phone: str, document_url: str, caption: str = "", filename: str = "invoice.pdf") -> dict:
    """Send a document (PDF invoice)."""
    async with httpx.AsyncClient(timeout=15) as client:
        resp = await client.post(_url(), headers=_headers(), json={
            "messaging_product": "whatsapp",
            "to": phone,
            "type": "document",
            "document": {
                "link": document_url,
                "caption": caption,
                "filename": filename,
            },
        })
        resp.raise_for_status()
        return resp.json()


async def download_media(media_id: str) -> bytes:
    """Download media (image/audio) from WhatsApp CDN."""
    s = get_settings()
    headers = {"Authorization": f"Bearer {s.whatsapp_token}"}

    async with httpx.AsyncClient(timeout=30) as client:
        # Step 1: Get media URL
        resp = await client.get(f"{BASE_URL}/{media_id}", headers=headers)
        resp.raise_for_status()
        media_url = resp.json().get("url", "")

        # Step 2: Download actual file
        resp = await client.get(media_url, headers=headers)
        resp.raise_for_status()
        return resp.content


async def mark_read(message_id: str) -> None:
    """Mark a message as read (blue ticks)."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            await client.post(_url(), headers=_headers(), json={
                "messaging_product": "whatsapp",
                "status": "read",
                "message_id": message_id,
            })
    except Exception:
        pass  # Non-critical
