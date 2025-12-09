# ============================================
#         email_sender.py (Refactored)
# ============================================

import time
import random
import logging
import smtplib
import ssl
from email.message import EmailMessage
import os

os.makedirs("logs", exist_ok=True)

logging.basicConfig(
    filename="logs/app.log",
    level=logging.DEBUG,
    format="%(asctime)s | %(levelname)s | %(message)s",
)


# --------------------------------------------------------
# Send ONE email
# --------------------------------------------------------
def send_one_email(config, to_email, subject, body, attachments):
    try:
        msg = EmailMessage()
        msg["From"] = config["user"]
        msg["To"] = to_email
        msg["Subject"] = subject
        msg.set_content(body)

        # Attach files
        if attachments:
            for f in attachments:
                try:
                    msg.add_attachment(
                        f.getvalue(),
                        maintype="application",
                        subtype="octet-stream",
                        filename=f.name,
                    )
                except Exception as e:
                    logging.error(f"Attachment error for {to_email}: {e}")

        # SMTP connection
        if config.get("use_ssl"):
            server = smtplib.SMTP_SSL(config["host"], config["port"])
        else:
            server = smtplib.SMTP(config["host"], config["port"])
            if config.get("use_starttls"):
                server.starttls(context=ssl.create_default_context())

        server.login(config["user"], config["pass"])
        server.send_message(msg)
        server.quit()

        logging.info(f"Sent → {to_email}")
        return True, f"Sent → {to_email}"

    except Exception as e:
        logging.error(f"ERROR sending to {to_email}: {e}")
        return False, f"ERROR → {to_email}: {e}"


# --------------------------------------------------------
# Bulk sending engine (with variant rotation)
# --------------------------------------------------------
def send_bulk_emails(
    contacts,
    subject,
    body,
    attachments,
    config,
    personalize_fn,
    max_to_send,
    min_delay,
    max_delay,
    subject_variants,
    body_variants,
    on_progress,
):
    """
    - subject_variants: list[str] (optional)
    - body_variants: list[str] (optional)
    - rotate randomly if lists exist
    """

    total = min(len(contacts), max_to_send)
    sent = 0
    failed = 0

    # Safety guard: if min_delay > max_delay
    if max_delay < min_delay:
        max_delay = min_delay

    for i, c in enumerate(contacts[:total]):
        email = c["email"]
        name = c.get("name", "")

        # -----------------------
        # Variant rotation
        # -----------------------
        chosen_subject = (
            random.choice(subject_variants)
            if subject_variants
            else subject
        )

        chosen_body = (
            random.choice(body_variants)
            if body_variants
            else body
        )

        # Personalize
        final_body = personalize_fn(chosen_body, name, email)

        # Send email
        ok, msg = send_one_email(
            config=config,
            to_email=email,
            subject=chosen_subject,
            body=final_body,
            attachments=attachments,
        )

        if ok:
            sent += 1
        else:
            failed += 1

        # Progress callback
        if on_progress:
            try:
                on_progress(i + 1, total, email, ok, msg)
            except Exception as e:
                logging.error(f"Progress callback error: {e}")

        # Delay to stay safe
        if i < total - 1:
            time.sleep(random.uniform(min_delay, max_delay))

    return sent, failed
