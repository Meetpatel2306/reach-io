"""WhatsApp webhook — receives all incoming messages from Meta."""

from __future__ import annotations
import hmac
import hashlib
import logging
from fastapi import APIRouter, Request, Response, HTTPException
from app.config import get_settings
from app.models.whatsapp import parse_webhook_payload
from app.services.conversation import handle_message
from app.production.idempotency import is_duplicate_message, mark_message_processed
from app.production.rate_limiter import check_webhook_rate_limit
from app.production.pii import mask_phone

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/webhook", tags=["webhook"])


@router.get("/whatsapp")
async def verify_webhook(request: Request):
    """Meta webhook verification — returns hub.challenge."""
    params = request.query_params
    mode = params.get("hub.mode", "")
    token = params.get("hub.verify_token", "")
    challenge = params.get("hub.challenge", "")

    s = get_settings()
    if mode == "subscribe" and token == s.whatsapp_verify_token:
        logger.info("webhook_verified")
        return Response(content=challenge, media_type="text/plain")

    raise HTTPException(status_code=403, detail="Verification failed")


@router.post("/whatsapp")
async def receive_message(request: Request):
    """Receive WhatsApp messages — process async, return 200 immediately."""
    # Rate limit by IP
    client_ip = request.client.host if request.client else "unknown"
    if check_webhook_rate_limit(client_ip):
        return {"status": "rate_limited"}

    # Verify webhook signature (HMAC-SHA256)
    s = get_settings()
    if s.whatsapp_app_secret and s.is_production:
        signature = request.headers.get("x-hub-signature-256", "")
        body = await request.body()
        expected = "sha256=" + hmac.new(
            s.whatsapp_app_secret.encode(), body, hashlib.sha256
        ).hexdigest()
        if not hmac.compare_digest(signature, expected):
            logger.warning("webhook: invalid signature")
            raise HTTPException(status_code=401, detail="Invalid signature")

    # Parse payload
    payload = await request.json()
    msg = parse_webhook_payload(payload)

    if msg is None:
        return {"status": "no_message"}

    # Idempotency check
    if is_duplicate_message(msg.msg_id):
        logger.debug(f"webhook: duplicate message {msg.msg_id}")
        return {"status": "duplicate"}

    # Process message
    try:
        await handle_message(msg)
        mark_message_processed(msg.msg_id, result="success")
    except Exception as e:
        logger.exception(f"webhook_error: {mask_phone(msg.phone)}")
        mark_message_processed(msg.msg_id, result="error")
        # Don't crash — WhatsApp will retry if we return non-200
        try:
            from app.services.whatsapp import send_text
            await send_text(msg.phone, "Kuch gadbad ho gayi. Please dobara try karein. 🙏")
        except Exception:
            pass

    return {"status": "ok"}
