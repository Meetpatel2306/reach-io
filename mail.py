# email_system.py

from dataclasses import dataclass
from email.message import EmailMessage
from typing import List, Dict, Optional
import smtplib
import ssl
import time
import traceback
import os


@dataclass
class EmailConfig:
    smtp_host: str
    smtp_port: int
    username: str
    password: str
    use_tls: bool = True
    from_name: Optional[str] = None

    @property
    def from_address(self) -> str:
        return self.username  # usually same for Gmail/Outlook


@dataclass
class Contact:
    name: str
    email: str
    company: Optional[str] = None
    title: Optional[str] = None  # HR title, not job you're applying for


@dataclass
class CampaignResult:
    sent: int
    failed: int
    errors: List[str]


class EmailSender:
    def __init__(self, config: EmailConfig):
        self.config = config

    def _connect(self):
        if self.config.use_tls:
            context = ssl.create_default_context()
            server = smtplib.SMTP(self.config.smtp_host, self.config.smtp_port)
            server.starttls(context=context)
        else:
            server = smtplib.SMTP_SSL(self.config.smtp_host, self.config.smtp_port)

        server.login(self.config.username, self.config.password)
        return server

    def send_email(
        self,
        to_email: str,
        subject: str,
        html_body: str,
        plain_body: Optional[str] = None,
        attachments: Optional[List[str]] = None,
    ):
        msg = EmailMessage()
        from_display = (
            f"{self.config.from_name} <{self.config.from_address}>"
            if self.config.from_name
            else self.config.from_address
        )
        msg["From"] = from_display
        msg["To"] = to_email
        msg["Subject"] = subject

        if plain_body:
            msg.set_content(plain_body)
            msg.add_alternative(html_body, subtype="html")
        else:
            msg.set_content(html_body, subtype="html")

        # Attach files
        if attachments:
            for path in attachments:
                if not path or not os.path.exists(path):
                    continue
                with open(path, "rb") as f:
                    data = f.read()
                filename = os.path.basename(path)
                msg.add_attachment(
                    data,
                    maintype="application",
                    subtype="octet-stream",
                    filename=filename,
                )

        server = self._connect()
        try:
            server.send_message(msg)
        finally:
            server.quit()


def render_template(template: str, context: Dict[str, str]) -> str:
    """
    Simple .format-based templating.
    Any placeholder missing in context will be replaced with empty string instead of crashing.
    """
    safe_context = {k: (v or "") for k, v in context.items()}

    # Replace keys that may not exist with empty string
    class SafeDict(dict):
        def __missing__(self, key):
            return ""

    return template.format_map(SafeDict(safe_context))


def run_campaign(
    sender: EmailSender,
    contacts: List[Contact],
    *,
    job_title: str,
    subject_template: str,
    body_template_html: str,
    body_template_text: Optional[str] = None,
    resume_path: Optional[str] = None,
    delay_seconds: int = 60,
    max_emails: Optional[int] = None,
    progress_callback=None,
) -> CampaignResult:
    """
    Sends personalized emails to a list of contacts with delay and optional limit.
    progress_callback(index, total, status_msg) is called after each email (for UI updates).
    """
    sent = 0
    failed = 0
    errors: List[str] = []

    total = len(contacts)
    to_send = total if max_emails is None else min(total, max_emails)

    for idx, contact in enumerate(contacts[:to_send], start=1):
        ctx = {
            "hr_name": contact.name,
            "hr_title": contact.title or "",
            "company": contact.company or "",
            "job_title": job_title,
            "your_name": "",  # fill from UI
        }

        subject = render_template(subject_template, ctx)
        html_body = render_template(body_template_html, ctx)
        plain_body = (
            render_template(body_template_text, ctx) if body_template_text else None
        )

        try:
            sender.send_email(
                to_email=contact.email,
                subject=subject,
                html_body=html_body,
                plain_body=plain_body,
                attachments=[resume_path] if resume_path else None,
            )
            sent += 1
            status = f"✅ Sent to {contact.email}"
        except Exception as e:
            failed += 1
            error_msg = f"❌ Failed for {contact.email}: {e}"
            errors.append(error_msg + "\n" + traceback.format_exc())
            status = error_msg

        if progress_callback:
            progress_callback(idx, to_send, status)

        # Respect delay between emails
        if idx < to_send:
            time.sleep(delay_seconds)

    return CampaignResult(sent=sent, failed=failed, errors=errors)
