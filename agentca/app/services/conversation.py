"""Conversation state machine — ALL flows fully implemented."""

from __future__ import annotations
import json
import logging
from datetime import date
from app import database as db
from app.models.business import ConversationState, BusinessCreate
from app.models.invoice import InvoiceCreate, InvoiceItemCreate, InvoiceType, InvoiceSource
from app.models.transaction import TransactionCreate
from app.models.whatsapp import WhatsAppMessage
from app.services import whatsapp as wa
from app.services import ai_engine
from app.services.ocr import extract_invoice_from_image
from app.services.voice import transcribe
from app.services.invoice_service import create_invoice, get_invoices
from app.services.transaction_service import record_transaction, get_transactions
from app.services.gst_calculator import calculate_net_liability
from app.utils.gstin_validator import validate_gstin, extract_pan, get_state_code
from app.utils.formatters import format_inr, format_phone
from app.utils.date_helpers import (
    get_gst_period, get_gstr1_deadline, get_gstr3b_deadline,
    days_until, format_month_year,
)
from app.production.pii import mask_phone
from app.production.audit_log import log_action
from app.production.rate_limiter import check_ai_rate_limit

logger = logging.getLogger(__name__)


async def handle_message(msg: WhatsAppMessage) -> None:
    """Main entry — route message based on conversation state."""
    phone = format_phone(msg.phone)
    logger.info(f"msg_in: {msg.msg_type} from {mask_phone(phone)}")

    await wa.mark_read(msg.msg_id)

    # Update last_message_at
    business = db.select_one("businesses", {"phone": phone})

    if business is None:
        business = db.insert("businesses", BusinessCreate(phone=phone).model_dump())
        log_action(business_id=business["id"], actor_type="user",
                   actor_id=phone, action="create", entity_type="businesses",
                   entity_id=business["id"])

    db.update("businesses", business["id"], {"last_message_at": "now()"})
    state = business.get("conversation_state", "new")

    if state.startswith("onboarding") or state == "new":
        await _handle_onboarding(business, msg)
    elif state.startswith("active:confirming"):
        await _handle_confirmation(business, msg)
    else:
        await _handle_active(business, msg)


# ═══════════════════════════════════════════════════════════════
# ONBOARDING (unchanged from before)
# ═══════════════════════════════════════════════════════════════

async def _handle_onboarding(business: dict, msg: WhatsAppMessage) -> None:
    phone = business["phone"]
    biz_id = business["id"]
    state = business.get("conversation_state", "new")
    text = msg.text.strip()

    if state == "new":
        await wa.send_text(phone,
            "🙏 Namaste! AgentCA mein aapka swagat hai!\n\n"
            "Main aapka AI accountant hoon — WhatsApp pe invoice banana, "
            "kharche track karna, aur GST manage karna mera kaam hai.\n\n"
            "Shuru karte hain! Aapka naam kya hai?"
        )
        db.update("businesses", biz_id, {"conversation_state": ConversationState.ONBOARDING_NAME})

    elif state == ConversationState.ONBOARDING_NAME:
        db.update("businesses", biz_id, {
            "owner_name": text,
            "conversation_state": ConversationState.ONBOARDING_BUSINESS,
        })
        await wa.send_text(phone, f"Dhanyavaad {text} ji! 🙏\n\nAapke business ka naam kya hai?")

    elif state == ConversationState.ONBOARDING_BUSINESS:
        db.update("businesses", biz_id, {
            "business_name": text,
            "conversation_state": ConversationState.ONBOARDING_GSTIN,
        })
        await wa.send_text(phone,
            f"Bahut accha! {text}.\n\n"
            "Kya aapke paas GST number (GSTIN) hai?\n"
            "Agar hai to type karein, nahi to \"Skip\" bhejein."
        )

    elif state == ConversationState.ONBOARDING_GSTIN:
        if text.lower() == "skip":
            db.update("businesses", biz_id, {
                "business_type": "unregistered",
                "conversation_state": ConversationState.ONBOARDING_LANGUAGE,
            })
        else:
            is_valid, message = validate_gstin(text)
            if is_valid:
                db.update("businesses", biz_id, {
                    "gstin": text.upper(),
                    "pan": extract_pan(text),
                    "state_code": get_state_code(text),
                    "conversation_state": ConversationState.ONBOARDING_LANGUAGE,
                })
                await wa.send_text(phone, f"✅ {message}")
            else:
                await wa.send_text(phone, f"❌ {message}\n\nDobara try karein ya \"Skip\" bhejein.")
                return

        await wa.send_buttons(phone,
            "Aap kaun si language mein baat karna chahenge?",
            [
                {"id": "lang_hi", "title": "Hindi"},
                {"id": "lang_en", "title": "English"},
                {"id": "lang_gu", "title": "Gujarati"},
            ]
        )

    elif state == ConversationState.ONBOARDING_LANGUAGE:
        lang_map = {"lang_hi": "hi", "lang_en": "en", "lang_gu": "gu"}
        lang = lang_map.get(msg.button_id, "hi")
        if not msg.button_id:
            lang = "hi" if any(w in text.lower() for w in ["hindi", "हिंदी"]) else \
                   "en" if "english" in text.lower() else \
                   "gu" if any(w in text.lower() for w in ["gujarati", "ગુજરાતી"]) else "hi"
        db.update("businesses", biz_id, {"language": lang, "conversation_state": ConversationState.ONBOARDING_UPI})
        await wa.send_text(phone, "Aapka UPI ID batayein (payment track karne ke liye).\n\"Skip\" bhejein agar baad mein dena chahte hain.")

    elif state == ConversationState.ONBOARDING_UPI:
        if text.lower() != "skip":
            db.update("businesses", biz_id, {"upi_id": text})
        db.update("businesses", biz_id, {"onboarding_step": 6, "conversation_state": ConversationState.ACTIVE_IDLE})
        name = business.get("owner_name", "")
        await wa.send_text(phone,
            f"✅ Setup complete {name} ji!\n\n"
            "Aap yeh sab kar sakte hain:\n"
            "📸 Bill ka photo bhejein → AI read karega\n"
            "🎙️ Voice mein bolo → Invoice ban jayega\n"
            "💬 SMS forward karo → Transaction record\n"
            "📊 \"Report\" likho → Summary milega\n"
            "🔢 \"GST\" likho → Tax summary\n\n"
            "Kuch bhi bhejein — main samajh jaunga!"
        )


# ═══════════════════════════════════════════════════════════════
# ACTIVE STATE — FULL IMPLEMENTATION
# ═══════════════════════════════════════════════════════════════

async def _handle_active(business: dict, msg: WhatsAppMessage) -> None:
    phone = business["phone"]
    if msg.msg_type == "image":
        await _handle_image(business, msg)
    elif msg.msg_type == "audio":
        await _handle_voice(business, msg)
    elif msg.msg_type == "text":
        await _handle_text(business, msg)
    elif msg.msg_type in ("interactive", "button"):
        await _handle_confirmation(business, msg)
    else:
        await wa.send_text(phone, "Text, photo ya voice bhejein.")


# ─── TEXT MESSAGES ────────────────────────────────────────────

async def _handle_text(business: dict, msg: WhatsAppMessage) -> None:
    phone = business["phone"]
    text = msg.text.strip()

    # Check rate limit
    if check_ai_rate_limit(phone):
        await wa.send_text(phone, "Thoda slow karein! Bahut zyada messages aa rahe hain. 1 minute baad try karein.")
        return

    # Detect if this is a forwarded SMS (bank/UPI transaction)
    sms_keywords = ["credited", "debited", "received", "sent", "upi ref", "neft", "imps", "a/c"]
    if any(kw in text.lower() for kw in sms_keywords):
        await _handle_sms_forward(business, msg)
        return

    # Classify intent via AI
    intent_data = await ai_engine.classify_intent(text)
    intent = intent_data.get("intent", "unknown")
    entities = intent_data.get("entities", {})

    if intent == "greeting":
        name = business.get("owner_name", "")
        await wa.send_text(phone, f"Namaste {name} ji! 🙏 Kya karna hai aaj?")

    elif intent == "menu":
        await _send_menu(phone)

    elif intent == "help":
        await wa.send_text(phone,
            "AgentCA Help:\n\n"
            "📸 Bill ka photo → Purchase entry\n"
            "🎙️ Voice note → Sale invoice\n"
            "💬 SMS forward → Transaction record\n"
            "📊 \"Report\" → Monthly summary\n"
            "🔢 \"GST\" → Tax summary\n"
            "📋 \"Menu\" → All options\n"
            "🗑️ \"Delete [invoice no]\" → Delete entry"
        )

    elif intent == "check_gst":
        await _send_gst_summary(business)

    elif intent == "view_report":
        await _send_report(business)

    elif intent == "view_invoices":
        await _send_invoice_list(business)

    elif intent == "check_deadline":
        await _send_deadlines(business)

    elif intent == "create_invoice":
        await _handle_text_invoice(business, text, entities)

    elif intent == "record_expense":
        await _handle_text_expense(business, text, entities)

    elif intent == "record_transaction":
        await _handle_text_transaction(business, text, entities)

    else:
        response = await ai_engine.generate_response(
            text,
            language=business.get("language", "hi"),
            business_name=business.get("business_name", ""),
            owner_name=business.get("owner_name", ""),
            gstin=business.get("gstin", ""),
        )
        await wa.send_text(phone, response)


# ─── IMAGE (BILL PHOTO → OCR) ────────────────────────────────

async def _handle_image(business: dict, msg: WhatsAppMessage) -> None:
    """Photo → Gemini Vision OCR → confirm → save purchase invoice."""
    phone = business["phone"]
    biz_id = business["id"]

    await wa.send_text(phone, "📸 Bill padh raha hoon... ek minute.")

    try:
        # Download image from WhatsApp
        image_bytes = await wa.download_media(msg.media_id)

        # OCR via Gemini Vision
        ocr_data = await extract_invoice_from_image(image_bytes)

        if ocr_data.confidence < 0.3 or not ocr_data.items:
            await wa.send_text(phone,
                "Bill theek se padh nahi paaya. 😕\n"
                "Kya aap saaf photo bhej sakte hain? Ya text mein details likhein."
            )
            return

        # Build confirmation message
        items_text = ""
        for i, item in enumerate(ocr_data.items, 1):
            items_text += f"{i}. {item.description}"
            if item.hsn_code:
                items_text += f" (HSN: {item.hsn_code})"
            items_text += f" — {item.quantity} {item.unit} × {format_inr(item.rate)} = {format_inr(item.quantity * item.rate)}\n"

        total = ocr_data.total or 0
        msg_text = f"📋 Bill padh liya!\n\n"
        if ocr_data.supplier_name:
            msg_text += f"🏪 Supplier: {ocr_data.supplier_name}\n"
        if ocr_data.supplier_gstin:
            msg_text += f"📝 GSTIN: {ocr_data.supplier_gstin}\n"
        if ocr_data.invoice_number:
            msg_text += f"🧾 Bill No: {ocr_data.invoice_number}\n"
        if ocr_data.invoice_date:
            msg_text += f"📅 Date: {ocr_data.invoice_date}\n"
        msg_text += f"\n{items_text}\n"
        msg_text += f"Subtotal: {format_inr(ocr_data.subtotal or 0)}\n"
        if ocr_data.cgst:
            msg_text += f"CGST: {format_inr(ocr_data.cgst)}\n"
        if ocr_data.sgst:
            msg_text += f"SGST: {format_inr(ocr_data.sgst)}\n"
        if ocr_data.igst:
            msg_text += f"IGST: {format_inr(ocr_data.igst)}\n"
        msg_text += f"Total: {format_inr(total)}"

        if ocr_data.cgst or ocr_data.sgst or ocr_data.igst:
            itc = (ocr_data.cgst or 0) + (ocr_data.sgst or 0) + (ocr_data.igst or 0)
            msg_text += f"\n\nITC claimable: {format_inr(itc)} ✅"

        # Store pending action
        db.update("businesses", biz_id, {
            "conversation_state": ConversationState.ACTIVE_CONFIRMING_INVOICE,
            "pending_action": {
                "type": "save_purchase_invoice",
                "data": ocr_data.model_dump(),
                "source": "photo",
            },
        })

        await wa.send_buttons(phone, msg_text, [
            {"id": "confirm_invoice", "title": "✅ Sahi hai"},
            {"id": "cancel_invoice", "title": "❌ Cancel"},
        ])

    except Exception as e:
        logger.exception(f"ocr_error: {mask_phone(phone)}")
        await wa.send_text(phone, "Bill padhne mein problem aayi. 😕 Kya aap dobara try karein?")


# ─── VOICE (VOICE NOTE → TRANSCRIBE → PARSE) ────────────────

async def _handle_voice(business: dict, msg: WhatsAppMessage) -> None:
    """Voice note → Groq Whisper → parse command → confirm → execute."""
    phone = business["phone"]
    biz_id = business["id"]

    await wa.send_text(phone, "🎙️ Sun raha hoon...")

    try:
        # Download audio
        audio_bytes = await wa.download_media(msg.media_id)

        # Transcribe via Groq Whisper
        lang = business.get("language", "hi")
        transcription = await transcribe(audio_bytes, language=lang)

        if not transcription:
            await wa.send_text(phone, "Voice samajh nahi aaya. 😕 Kya aap dobara bol sakte hain?")
            return

        # Parse voice command
        parsed = await ai_engine.parse_voice_command(transcription)
        action = parsed.get("action", "query")
        data = parsed.get("data", {})
        confidence = parsed.get("confidence", 0)

        if action == "create_invoice" and confidence > 0.5:
            customer = data.get("customer_name", "Customer")
            items = data.get("items", [])
            gst_rate = data.get("gst_rate", 18)

            if not items:
                await wa.send_text(phone, f"🎙️ Suna: \"{transcription}\"\n\nLekin items samajh nahi aaye. Kya aap dobara bol sakte hain?")
                return

            # Build confirmation
            msg_text = f"🎙️ Samjha! Invoice:\n\n📄 Customer: {customer}\n"
            total_taxable = 0
            for item in items:
                amt = item.get("quantity", 1) * item.get("rate", 0)
                total_taxable += amt
                msg_text += f"• {item.get('name', 'Item')} × {item.get('quantity', 1)} @ {format_inr(item.get('rate', 0))} = {format_inr(amt)}\n"

            gst_amt = total_taxable * gst_rate / 100
            total = total_taxable + gst_amt
            msg_text += f"\nSubtotal: {format_inr(total_taxable)}\nGST ({gst_rate}%): {format_inr(gst_amt)}\nTotal: {format_inr(total)}"

            db.update("businesses", biz_id, {
                "conversation_state": ConversationState.ACTIVE_CONFIRMING_INVOICE,
                "pending_action": {
                    "type": "create_sale_invoice",
                    "data": {
                        "customer_name": customer,
                        "items": items,
                        "gst_rate": gst_rate,
                    },
                    "source": "voice",
                    "transcription": transcription,
                },
            })

            await wa.send_buttons(phone, msg_text, [
                {"id": "confirm_invoice", "title": "✅ Confirm"},
                {"id": "cancel_invoice", "title": "❌ Cancel"},
            ])

        elif action == "record_purchase" and confidence > 0.5:
            amount = data.get("amount", 0)
            supplier = data.get("supplier_name", "")
            desc = data.get("description", "Purchase")

            msg_text = f"🎙️ Suna: \"{transcription}\"\n\n"
            msg_text += f"📝 Purchase: {desc}\n"
            if supplier:
                msg_text += f"🏪 Supplier: {supplier}\n"
            msg_text += f"💰 Amount: {format_inr(amount)}"

            db.update("businesses", biz_id, {
                "conversation_state": ConversationState.ACTIVE_CONFIRMING_TRANSACTION,
                "pending_action": {
                    "type": "record_expense",
                    "data": {"amount": amount, "description": desc, "supplier": supplier, "category": "purchase"},
                    "source": "voice",
                },
            })

            await wa.send_buttons(phone, msg_text, [
                {"id": "confirm_txn", "title": "✅ Save"},
                {"id": "cancel_txn", "title": "❌ Cancel"},
            ])

        elif action == "record_expense" and confidence > 0.5:
            amount = data.get("amount", 0)
            desc = data.get("description", "Expense")

            db.update("businesses", biz_id, {
                "conversation_state": ConversationState.ACTIVE_CONFIRMING_TRANSACTION,
                "pending_action": {
                    "type": "record_expense",
                    "data": {"amount": amount, "description": desc, "category": "expense"},
                    "source": "voice",
                },
            })

            await wa.send_buttons(phone,
                f"🎙️ Suna: \"{transcription}\"\n\n💸 Expense: {desc}\n💰 Amount: {format_inr(amount)}",
                [{"id": "confirm_txn", "title": "✅ Save"}, {"id": "cancel_txn", "title": "❌ Cancel"}]
            )

        elif action == "record_payment" and confidence > 0.5:
            amount = data.get("amount", 0)
            from_name = data.get("from_name", "")

            db.update("businesses", biz_id, {
                "conversation_state": ConversationState.ACTIVE_CONFIRMING_TRANSACTION,
                "pending_action": {
                    "type": "record_payment",
                    "data": {"amount": amount, "from": from_name, "type": "credit", "category": "sale"},
                    "source": "voice",
                },
            })

            await wa.send_buttons(phone,
                f"🎙️ Suna: \"{transcription}\"\n\n💰 Payment: {format_inr(amount)}\nFrom: {from_name}",
                [{"id": "confirm_txn", "title": "✅ Save"}, {"id": "cancel_txn", "title": "❌ Cancel"}]
            )

        else:
            # Couldn't parse — treat as general query
            await wa.send_text(phone, f"🎙️ Suna: \"{transcription}\"\n\nYeh samajh nahi aaya. Kya aap dobara bol sakte hain?")

    except Exception as e:
        logger.exception(f"voice_error: {mask_phone(phone)}")
        await wa.send_text(phone, "Voice process karne mein problem aayi. Text mein try karein.")


# ─── SMS FORWARD (BANK/UPI TRANSACTION) ──────────────────────

async def _handle_sms_forward(business: dict, msg: WhatsAppMessage) -> None:
    """Parse forwarded bank/UPI SMS → confirm → record transaction."""
    phone = business["phone"]
    biz_id = business["id"]

    parsed = await ai_engine.parse_sms(msg.text)
    amount = parsed.get("amount", 0)
    txn_type = parsed.get("type", "unknown")
    counterparty = parsed.get("counterparty", "")
    ref = parsed.get("reference_id", "")
    category = parsed.get("category_suggestion", "other")

    if amount <= 0:
        await wa.send_text(phone, "SMS se amount samajh nahi aaya. Kya aap manually entry karein?")
        return

    type_text = "credited (income)" if txn_type == "credit" else "debited (expense)"
    msg_text = f"💰 Transaction detect hua!\n\n"
    msg_text += f"{format_inr(amount)} {type_text}\n"
    if counterparty:
        msg_text += f"{'From' if txn_type == 'credit' else 'To'}: {counterparty}\n"
    if ref:
        msg_text += f"Ref: {ref}\n"
    msg_text += f"Category: {category}"

    db.update("businesses", biz_id, {
        "conversation_state": ConversationState.ACTIVE_CONFIRMING_TRANSACTION,
        "pending_action": {
            "type": "record_sms_transaction",
            "data": {
                "amount": amount,
                "type": txn_type,
                "counterparty": counterparty,
                "reference_id": ref,
                "category": category,
                "raw_sms": msg.text,
            },
            "source": "sms",
        },
    })

    await wa.send_buttons(phone, msg_text, [
        {"id": "confirm_txn", "title": "✅ Save"},
        {"id": "cancel_txn", "title": "❌ Cancel"},
    ])


# ─── TEXT INVOICE CREATION ────────────────────────────────────

async def _handle_text_invoice(business: dict, text: str, entities: dict) -> None:
    """Handle text-based invoice creation from AI-extracted entities."""
    phone = business["phone"]
    biz_id = business["id"]

    customer = entities.get("customer", "")
    items = entities.get("items", [])
    gst_rate = entities.get("gst_rate", 18)

    if not items and not customer:
        await wa.send_text(phone,
            "Invoice banane ke liye batayein:\n"
            "• Customer ka naam\n"
            "• Item, quantity, rate\n"
            "• GST rate\n\n"
            "Example: \"Rajesh ko 50 pipe 500 rupay 18% GST\"\n"
            "Ya voice note bhejein!"
        )
        return

    if items:
        total_taxable = sum(i.get("qty", i.get("quantity", 1)) * i.get("rate", 0) for i in items)
        gst_amt = total_taxable * gst_rate / 100
        total = total_taxable + gst_amt

        msg_text = f"📄 Invoice:\nCustomer: {customer or 'Unknown'}\n"
        for item in items:
            qty = item.get("qty", item.get("quantity", 1))
            rate = item.get("rate", 0)
            msg_text += f"• {item.get('name', 'Item')} × {qty} @ {format_inr(rate)}\n"
        msg_text += f"\nSubtotal: {format_inr(total_taxable)}\nGST ({gst_rate}%): {format_inr(gst_amt)}\nTotal: {format_inr(total)}"

        db.update("businesses", biz_id, {
            "conversation_state": ConversationState.ACTIVE_CONFIRMING_INVOICE,
            "pending_action": {
                "type": "create_sale_invoice",
                "data": {"customer_name": customer, "items": items, "gst_rate": gst_rate},
                "source": "text",
            },
        })

        await wa.send_buttons(phone, msg_text, [
            {"id": "confirm_invoice", "title": "✅ Confirm"},
            {"id": "cancel_invoice", "title": "❌ Cancel"},
        ])
    else:
        await wa.send_text(phone, "Items samajh nahi aaye. Example: \"50 pipe 500 rupay 18% GST\"")


# ─── TEXT EXPENSE/TRANSACTION ─────────────────────────────────

async def _handle_text_expense(business: dict, text: str, entities: dict) -> None:
    phone = business["phone"]
    biz_id = business["id"]
    amount = entities.get("amount", 0)
    desc = entities.get("description", text)

    if amount <= 0:
        await wa.send_text(phone, "Amount samajh nahi aaya. Example: \"bijli bill 2500\"")
        return

    db.update("businesses", biz_id, {
        "conversation_state": ConversationState.ACTIVE_CONFIRMING_TRANSACTION,
        "pending_action": {
            "type": "record_expense",
            "data": {"amount": amount, "description": desc, "category": "expense"},
            "source": "text",
        },
    })

    await wa.send_buttons(phone,
        f"💸 Expense: {desc}\n💰 Amount: {format_inr(amount)}",
        [{"id": "confirm_txn", "title": "✅ Save"}, {"id": "cancel_txn", "title": "❌ Cancel"}]
    )


async def _handle_text_transaction(business: dict, text: str, entities: dict) -> None:
    phone = business["phone"]
    biz_id = business["id"]
    amount = entities.get("amount", 0)
    txn_type = entities.get("type", "credit")
    from_name = entities.get("from", "")

    if amount <= 0:
        await wa.send_text(phone, "Amount samajh nahi aaya. Example: \"15000 aaya Rajesh se\"")
        return

    db.update("businesses", biz_id, {
        "conversation_state": ConversationState.ACTIVE_CONFIRMING_TRANSACTION,
        "pending_action": {
            "type": "record_payment",
            "data": {"amount": amount, "type": txn_type, "from": from_name, "category": "sale" if txn_type == "credit" else "purchase"},
            "source": "text",
        },
    })

    type_label = "received" if txn_type == "credit" else "paid"
    await wa.send_buttons(phone,
        f"💰 {format_inr(amount)} {type_label}\n{'From' if txn_type == 'credit' else 'To'}: {from_name}",
        [{"id": "confirm_txn", "title": "✅ Save"}, {"id": "cancel_txn", "title": "❌ Cancel"}]
    )


# ═══════════════════════════════════════════════════════════════
# CONFIRMATION HANDLER — EXECUTES PENDING ACTIONS
# ═══════════════════════════════════════════════════════════════

async def _handle_confirmation(business: dict, msg: WhatsAppMessage) -> None:
    phone = business["phone"]
    biz_id = business["id"]
    button_id = msg.button_id or msg.text.strip().lower()
    pending = business.get("pending_action")

    # ── CONFIRM INVOICE ──
    if button_id == "confirm_invoice" and pending:
        action_type = pending.get("type", "")
        data = pending.get("data", {})
        source = pending.get("source", "manual")

        try:
            if action_type == "save_purchase_invoice":
                # Create purchase invoice from OCR data
                items = [InvoiceItemCreate(
                    description=i.get("description", "Item"),
                    hsn_code=i.get("hsn_code"),
                    quantity=i.get("quantity", 1),
                    unit=i.get("unit", "NOS"),
                    rate=i.get("rate", 0),
                    gst_rate=i.get("gst_rate", 18),
                ) for i in data.get("items", [])]

                invoice = create_invoice(InvoiceCreate(
                    business_id=biz_id,
                    invoice_type=InvoiceType.PURCHASE,
                    invoice_date=date.today(),
                    items=items,
                    source=InvoiceSource.PHOTO,
                ))

                itc = (invoice.get("cgst", 0) or 0) + (invoice.get("sgst", 0) or 0) + (invoice.get("igst", 0) or 0)
                await wa.send_text(phone,
                    f"✅ Purchase entry saved!\n\n"
                    f"🧾 {invoice.get('invoice_number', '')}\n"
                    f"💰 Total: {format_inr(invoice.get('total', 0))}\n"
                    f"📋 ITC claimable: {format_inr(itc)}"
                )

            elif action_type == "create_sale_invoice":
                customer_name = data.get("customer_name", "Customer")
                gst_rate = data.get("gst_rate", 18)

                # Find or create contact
                contact = db.select_one("contacts", {"business_id": biz_id, "name": customer_name, "type": "customer"})
                if not contact:
                    contact = db.insert("contacts", {"business_id": biz_id, "name": customer_name, "type": "customer"})

                items = [InvoiceItemCreate(
                    description=i.get("name", "Item"),
                    quantity=i.get("qty", i.get("quantity", 1)),
                    rate=i.get("rate", 0),
                    gst_rate=gst_rate,
                ) for i in data.get("items", [])]

                src = InvoiceSource.VOICE if source == "voice" else InvoiceSource.MANUAL
                invoice = create_invoice(InvoiceCreate(
                    business_id=biz_id,
                    contact_id=contact.get("id"),
                    invoice_type=InvoiceType.SALE,
                    invoice_date=date.today(),
                    items=items,
                    source=src,
                ))

                await wa.send_text(phone,
                    f"✅ Invoice created!\n\n"
                    f"🧾 {invoice.get('invoice_number', '')}\n"
                    f"👤 {customer_name}\n"
                    f"💰 Total: {format_inr(invoice.get('total', 0))}"
                )

        except Exception as e:
            logger.exception(f"confirm_invoice_error: {mask_phone(phone)}")
            await wa.send_text(phone, f"Invoice save karne mein error aaya: {str(e)[:100]}")

        db.update("businesses", biz_id, {
            "pending_action": None,
            "conversation_state": ConversationState.ACTIVE_IDLE,
        })

    # ── CONFIRM TRANSACTION ──
    elif button_id == "confirm_txn" and pending:
        data = pending.get("data", {})
        source = pending.get("source", "manual")

        try:
            txn_type = data.get("type", "debit")
            amount = data.get("amount", 0)
            desc = data.get("description", data.get("from", ""))
            category = data.get("category", "other")
            counterparty = data.get("counterparty", data.get("from", data.get("supplier", "")))

            txn = record_transaction(TransactionCreate(
                business_id=biz_id,
                amount=amount,
                type=txn_type,
                description=desc,
                category=category,
                counterparty_name=counterparty,
                source=f"{source}_auto" if source in ("sms", "voice") else "manual",
                raw_sms=data.get("raw_sms"),
                transaction_date=date.today(),
                reference_id=data.get("reference_id"),
            ))

            emoji = "💰" if txn_type == "credit" else "💸"
            await wa.send_text(phone, f"✅ Transaction saved!\n\n{emoji} {format_inr(amount)} ({category})")

        except Exception as e:
            logger.exception(f"confirm_txn_error: {mask_phone(phone)}")
            await wa.send_text(phone, "Transaction save karne mein error aaya.")

        db.update("businesses", biz_id, {
            "pending_action": None,
            "conversation_state": ConversationState.ACTIVE_IDLE,
        })

    # ── CANCEL ──
    elif button_id in ("cancel_invoice", "cancel_txn", "cancel", "no", "nahi"):
        db.update("businesses", biz_id, {
            "pending_action": None,
            "conversation_state": ConversationState.ACTIVE_IDLE,
        })
        await wa.send_text(phone, "❌ Cancel kar diya.")

    # ── MENU BUTTONS ──
    elif button_id == "menu_invoice":
        await wa.send_text(phone, "🧾 Voice note ya text mein invoice details bhejein.\nExample: \"Rajesh ko 50 pipe 500 rupay 18% GST\"")
    elif button_id == "menu_report":
        await _send_report(business)
    elif button_id == "menu_gst":
        await _send_gst_summary(business)

    else:
        db.update("businesses", biz_id, {"conversation_state": ConversationState.ACTIVE_IDLE})


# ═══════════════════════════════════════════════════════════════
# REPORTS & SUMMARIES
# ═══════════════════════════════════════════════════════════════

async def _send_gst_summary(business: dict) -> None:
    """Send GST summary for current month."""
    phone = business["phone"]
    biz_id = business["id"]
    today = date.today()
    period = get_gst_period()
    month_str = format_month_year(today.month, today.year)

    # Get this month's invoices
    all_sales = db.select("invoices", {"business_id": biz_id, "invoice_type": "sale"})
    all_purchases = db.select("invoices", {"business_id": biz_id, "invoice_type": "purchase"})

    period_start = f"{today.year}-{today.month:02d}-01"
    month_sales = [s for s in all_sales if (s.get("invoice_date") or "") >= period_start]
    month_purchases = [p for p in all_purchases if (p.get("invoice_date") or "") >= period_start]

    total_sales = sum(s.get("subtotal", 0) or 0 for s in month_sales)
    total_purchases = sum(p.get("subtotal", 0) or 0 for p in month_purchases)

    output_cgst = sum(s.get("cgst", 0) or 0 for s in month_sales)
    output_sgst = sum(s.get("sgst", 0) or 0 for s in month_sales)
    output_igst = sum(s.get("igst", 0) or 0 for s in month_sales)
    input_cgst = sum(p.get("cgst", 0) or 0 for p in month_purchases)
    input_sgst = sum(p.get("sgst", 0) or 0 for p in month_purchases)
    input_igst = sum(p.get("igst", 0) or 0 for p in month_purchases)

    liability = calculate_net_liability(output_cgst, output_sgst, output_igst, input_cgst, input_sgst, input_igst)

    gstr1_dl = get_gstr1_deadline(today.month, today.year)
    gstr3b_dl = get_gstr3b_deadline(today.month, today.year)

    msg = (
        f"📊 GST Summary — {month_str}\n\n"
        f"📈 Sales: {format_inr(total_sales)} ({len(month_sales)} invoices)\n"
        f"📉 Purchases: {format_inr(total_purchases)} ({len(month_purchases)} invoices)\n\n"
        f"Output Tax:\n"
        f"  CGST: {format_inr(output_cgst)}\n"
        f"  SGST: {format_inr(output_sgst)}\n"
    )
    if output_igst > 0:
        msg += f"  IGST: {format_inr(output_igst)}\n"
    msg += (
        f"\nInput Tax (ITC):\n"
        f"  CGST: {format_inr(input_cgst)}\n"
        f"  SGST: {format_inr(input_sgst)}\n"
    )
    if input_igst > 0:
        msg += f"  IGST: {format_inr(input_igst)}\n"
    msg += (
        f"\n━━━━━━━━━━━━━━━\n"
        f"💰 Net GST payable: {format_inr(liability['net_tax_payable'])}\n\n"
        f"📅 GSTR-1: {gstr1_dl.strftime('%d %b')} ({days_until(gstr1_dl)} days)\n"
        f"📅 GSTR-3B: {gstr3b_dl.strftime('%d %b')} ({days_until(gstr3b_dl)} days)"
    )

    await wa.send_text(phone, msg)


async def _send_report(business: dict) -> None:
    """Send monthly financial report."""
    phone = business["phone"]
    biz_id = business["id"]
    today = date.today()
    month_str = format_month_year(today.month, today.year)
    period_start = f"{today.year}-{today.month:02d}-01"

    sales = db.select("invoices", {"business_id": biz_id, "invoice_type": "sale"})
    purchases = db.select("invoices", {"business_id": biz_id, "invoice_type": "purchase"})
    txns = db.select("transactions", {"business_id": biz_id})

    month_sales = [s for s in sales if (s.get("invoice_date") or "") >= period_start]
    month_purchases = [p for p in purchases if (p.get("invoice_date") or "") >= period_start]
    month_txns = [t for t in txns if (t.get("transaction_date") or "") >= period_start]

    total_sales = sum(s.get("total", 0) or 0 for s in month_sales)
    total_purchases = sum(p.get("total", 0) or 0 for p in month_purchases)
    total_credit = sum(t.get("amount", 0) or 0 for t in month_txns if t.get("type") == "credit")
    total_debit = sum(t.get("amount", 0) or 0 for t in month_txns if t.get("type") == "debit")

    msg = (
        f"📊 Monthly Report — {month_str}\n\n"
        f"🧾 Invoices:\n"
        f"  Sales: {len(month_sales)} invoices = {format_inr(total_sales)}\n"
        f"  Purchases: {len(month_purchases)} invoices = {format_inr(total_purchases)}\n\n"
        f"💰 Transactions:\n"
        f"  Income: {format_inr(total_credit)}\n"
        f"  Expenses: {format_inr(total_debit)}\n"
        f"  Net: {format_inr(total_credit - total_debit)}\n\n"
        f"📈 Gross Profit: {format_inr(total_sales - total_purchases)}"
    )

    await wa.send_text(phone, msg)


async def _send_invoice_list(business: dict) -> None:
    """Send last 5 invoices."""
    phone = business["phone"]
    invoices = get_invoices(business["id"], limit=5)

    if not invoices:
        await wa.send_text(phone, "Abhi tak koi invoice nahi hai. Bill ka photo bhejein ya voice note se invoice banayein!")
        return

    msg = "🧾 Recent Invoices:\n\n"
    for inv in invoices:
        type_emoji = "📈" if inv.get("invoice_type") == "sale" else "📉"
        msg += f"{type_emoji} {inv.get('invoice_number', '')} | {inv.get('invoice_date', '')} | {format_inr(inv.get('total', 0))}\n"

    await wa.send_text(phone, msg)


async def _send_deadlines(business: dict) -> None:
    """Send upcoming GST deadlines."""
    phone = business["phone"]
    today = date.today()

    gstr1 = get_gstr1_deadline(today.month, today.year)
    gstr3b = get_gstr3b_deadline(today.month, today.year)

    msg = (
        f"📅 Upcoming Deadlines:\n\n"
        f"GSTR-1: {gstr1.strftime('%d %b %Y')} ({days_until(gstr1)} days)\n"
        f"GSTR-3B: {gstr3b.strftime('%d %b %Y')} ({days_until(gstr3b)} days)\n\n"
    )

    if days_until(gstr1) <= 3:
        msg += "⚠️ GSTR-1 deadline bahut paas hai!"
    elif days_until(gstr3b) <= 3:
        msg += "⚠️ GSTR-3B deadline bahut paas hai!"
    else:
        msg += "✅ Sab deadlines abhi door hain. Relax!"

    await wa.send_text(phone, msg)


async def _send_menu(phone: str) -> None:
    await wa.send_buttons(phone,
        "📋 AgentCA Menu\nKya karna hai?",
        [
            {"id": "menu_invoice", "title": "🧾 Invoice"},
            {"id": "menu_report", "title": "📊 Report"},
            {"id": "menu_gst", "title": "🔢 GST Summary"},
        ]
    )
