"""WhatsApp webhook payload schemas (Meta Cloud API)."""

from __future__ import annotations
from pydantic import BaseModel


class WhatsAppMessage(BaseModel):
    """Parsed incoming WhatsApp message."""
    msg_id: str = ""
    phone: str = ""               # Sender phone (91XXXXXXXXXX)
    timestamp: str = ""
    msg_type: str = "text"        # text, image, audio, document, interactive, button
    text: str = ""                # Text content (for text messages)
    media_id: str = ""            # Media ID (for image/audio/document)
    mime_type: str = ""           # MIME type of media
    button_id: str = ""           # Button callback ID (for interactive replies)
    button_text: str = ""         # Button display text


def parse_webhook_payload(payload: dict) -> WhatsAppMessage | None:
    """Parse Meta webhook payload into WhatsAppMessage."""
    try:
        entry = payload.get("entry", [{}])[0]
        changes = entry.get("changes", [{}])[0]
        value = changes.get("value", {})
        messages = value.get("messages", [])

        if not messages:
            return None

        msg = messages[0]
        phone = msg.get("from", "")
        msg_id = msg.get("id", "")
        timestamp = msg.get("timestamp", "")
        msg_type = msg.get("type", "text")

        result = WhatsAppMessage(
            msg_id=msg_id,
            phone=phone,
            timestamp=timestamp,
            msg_type=msg_type,
        )

        if msg_type == "text":
            result.text = msg.get("text", {}).get("body", "")

        elif msg_type == "image":
            img = msg.get("image", {})
            result.media_id = img.get("id", "")
            result.mime_type = img.get("mime_type", "")
            result.text = img.get("caption", "")

        elif msg_type == "audio":
            audio = msg.get("audio", {})
            result.media_id = audio.get("id", "")
            result.mime_type = audio.get("mime_type", "")

        elif msg_type == "document":
            doc = msg.get("document", {})
            result.media_id = doc.get("id", "")
            result.mime_type = doc.get("mime_type", "")
            result.text = doc.get("caption", "")

        elif msg_type == "interactive":
            interactive = msg.get("interactive", {})
            reply_type = interactive.get("type", "")
            if reply_type == "button_reply":
                btn = interactive.get("button_reply", {})
                result.button_id = btn.get("id", "")
                result.button_text = btn.get("title", "")
            elif reply_type == "list_reply":
                lst = interactive.get("list_reply", {})
                result.button_id = lst.get("id", "")
                result.button_text = lst.get("title", "")

        elif msg_type == "button":
            btn = msg.get("button", {})
            result.text = btn.get("text", "")
            result.button_id = btn.get("payload", "")

        return result

    except (IndexError, KeyError, TypeError):
        return None
