"""Tests for WhatsApp webhook payload parsing."""

from app.models.whatsapp import parse_webhook_payload


def test_parse_text_message():
    payload = {
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{
                        "from": "919876543210",
                        "id": "wamid.abc123",
                        "timestamp": "1712345678",
                        "type": "text",
                        "text": {"body": "Hello AgentCA"},
                    }]
                }
            }]
        }]
    }
    msg = parse_webhook_payload(payload)
    assert msg is not None
    assert msg.phone == "919876543210"
    assert msg.msg_id == "wamid.abc123"
    assert msg.msg_type == "text"
    assert msg.text == "Hello AgentCA"


def test_parse_image_message():
    payload = {
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{
                        "from": "919876543210",
                        "id": "wamid.img456",
                        "timestamp": "1712345678",
                        "type": "image",
                        "image": {
                            "id": "media_id_123",
                            "mime_type": "image/jpeg",
                            "caption": "My bill",
                        },
                    }]
                }
            }]
        }]
    }
    msg = parse_webhook_payload(payload)
    assert msg is not None
    assert msg.msg_type == "image"
    assert msg.media_id == "media_id_123"
    assert msg.text == "My bill"


def test_parse_button_reply():
    payload = {
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{
                        "from": "919876543210",
                        "id": "wamid.btn789",
                        "timestamp": "1712345678",
                        "type": "interactive",
                        "interactive": {
                            "type": "button_reply",
                            "button_reply": {
                                "id": "confirm",
                                "title": "Confirm",
                            },
                        },
                    }]
                }
            }]
        }]
    }
    msg = parse_webhook_payload(payload)
    assert msg is not None
    assert msg.msg_type == "interactive"
    assert msg.button_id == "confirm"
    assert msg.button_text == "Confirm"


def test_parse_empty_payload():
    msg = parse_webhook_payload({"entry": [{"changes": [{"value": {}}]}]})
    assert msg is None


def test_parse_no_messages():
    msg = parse_webhook_payload({"entry": [{"changes": [{"value": {"messages": []}}]}]})
    assert msg is None


def test_parse_audio_message():
    payload = {
        "entry": [{
            "changes": [{
                "value": {
                    "messages": [{
                        "from": "919876543210",
                        "id": "wamid.aud111",
                        "timestamp": "1712345678",
                        "type": "audio",
                        "audio": {
                            "id": "audio_media_id",
                            "mime_type": "audio/ogg",
                        },
                    }]
                }
            }]
        }]
    }
    msg = parse_webhook_payload(payload)
    assert msg is not None
    assert msg.msg_type == "audio"
    assert msg.media_id == "audio_media_id"
