import streamlit as st
import csv
import io
import os
import ssl
import smtplib
import mimetypes
import json
from collections import defaultdict
from email.message import EmailMessage

# Optional: these libraries are only needed for text extraction from PDFs/DOCX
try:
    import PyPDF2
except ImportError:
    PyPDF2 = None

try:
    import docx  # python-docx
except ImportError:
    docx = None

import google.generativeai as genai

# -------------------------------
# CONFIG & CONSTANTS
# -------------------------------
st.set_page_config(page_title="AI Email Blaster Bot", layout="wide")
st.title("📨 AI-Powered Email Sender Bot")
st.write(
    "Send personalized emails to one or many recipients. "
    "Upload CSV or enter manually, attach files, and let Gemini suggest subjects and email bodies."
)

# Gemini API key (env first, then optional UI override)
DEFAULT_GEMINI_API_KEY = os.getenv("GEMINI_API_KEY", "")

with st.sidebar:
    st.header("🧠 AI Settings (Gemini)")
    gemini_key_input = st.text_input(
        "GEMINI_API_KEY (optional override)",
        type="password",
        value=DEFAULT_GEMINI_API_KEY if DEFAULT_GEMINI_API_KEY else "",
        help="If left empty, we'll use the GEMINI_API_KEY from environment variables.",
    )

    GEMINI_API_KEY = gemini_key_input or DEFAULT_GEMINI_API_KEY
    tone = st.selectbox(
        "Email tone",
        ["Neutral", "Professional", "Friendly", "Formal", "Casual", "Apologetic", "Salesy"],
        index=1,
    )
    email_goal = st.selectbox(
        "Email goal",
        [
            "General",
            "Job application",
            "Follow-up",
            "Cold outreach",
            "Invitation",
            "Announcement",
            "Reminder",
        ],
    )
    target_language = st.text_input("Language (e.g., English, Spanish)", value="English")
    st.caption("AI will try to follow these preferences when drafting emails.")

# -------------------------------
# SESSION STATE SETUP
# -------------------------------
if "subject_input" not in st.session_state:
    st.session_state.subject_input = ""
if "body_input" not in st.session_state:
    st.session_state.body_input = ""
if "ai_last_error" not in st.session_state:
    st.session_state.ai_last_error = ""


# -------------------------------
# GEMINI HELPERS
# -------------------------------
def get_gemini_model():
    if not GEMINI_API_KEY:
        raise ValueError("GEMINI_API_KEY is not set.")
    genai.configure(api_key=GEMINI_API_KEY)
    model = genai.GenerativeModel("models/gemini-2.5-flash")
    return model


def clean_json_from_text(text: str) -> str:
    """Extract JSON from possible ```json ... ``` fenced text."""
    text = text.strip()
    if text.startswith("```"):
        # remove first ```... and last ```
        parts = text.split("```")
        # expecting something like ['', 'json', '{...}', '']
        # find the chunk that looks like JSON (contains { or [)
        for part in parts:
            if "{" in part or "[" in part:
                return part.strip()
    return text


def call_gemini_for_email(prompt: str) -> dict:
    """
    Ask Gemini to generate a subject and body.
    Returns dict with keys: subject, body.
    """
    system_instruction = (
        "You are an assistant that writes concise, clear, and well-structured email drafts. "
        "Always respond ONLY with valid JSON using the structure: "
        '{"subject": "...", "body": "..."}'
    )

    model = get_gemini_model()
    response = model.generate_content(
        f"{system_instruction}\n\nUser request:\n{prompt}"
    )
    raw_text = response.text or ""
    cleaned = clean_json_from_text(raw_text)
    data = json.loads(cleaned)
    if not isinstance(data, dict):
        raise ValueError("Gemini output is not a JSON object.")
    if "subject" not in data or "body" not in data:
        raise ValueError("Gemini JSON is missing 'subject' or 'body'.")
    return data


def extract_text_from_uploaded_file(file) -> str:
    """
    Try to extract text from uploaded file to give Gemini some context.
    Supports txt, csv, pdf (if PyPDF2 available), docx (if python-docx available).
    """
    name = file.name.lower()
    content = file.getvalue()

    # Simple text-based types
    if name.endswith(".txt"):
        try:
            return content.decode("utf-8", errors="ignore")
        except Exception:
            return content.decode(errors="ignore")

    if name.endswith(".csv"):
        try:
            return content.decode("utf-8", errors="ignore")
        except Exception:
            return content.decode(errors="ignore")

    if name.endswith(".pdf") and PyPDF2 is not None:
        text_chunks = []
        try:
            reader = PyPDF2.PdfReader(io.BytesIO(content))
            # Only use first few pages to keep prompt smaller
            for page in reader.pages[:5]:
                text_chunks.append(page.extract_text() or "")
            return "\n".join(text_chunks)
        except Exception:
            return ""

    if name.endswith(".docx") and docx is not None:
        try:
            doc = docx.Document(io.BytesIO(content))
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception:
            return ""

    # Fallback: nothing extracted
    return ""


# -------------------------------
# 1. ATTACHMENTS
# -------------------------------
st.header("1. Attachments (Optional)")

uploaded_files = st.file_uploader(
    "Upload files (PDF, images, docs, txt) – can also be used as AI context",
    type=["pdf", "jpg", "png", "docx", "txt", "csv"],
    accept_multiple_files=True,
)

if uploaded_files:
    st.caption("AI can use the first file's text (if readable) to draft an email.")


# -------------------------------
# 2. RECIPIENT INPUT
# -------------------------------
st.header("2. Recipients")

# Manual typing
manual_emails_text = st.text_area(
    "Enter emails manually (one per line):",
    placeholder="john@example.com\nhr@company.com",
)

# CSV upload
csv_file = st.file_uploader(
    "OR Upload CSV with 'name' and 'email' columns", type=["csv"], key="csv_recipients"
)


def parse_csv(file):
    contacts_local = []
    reader = csv.DictReader(io.StringIO(file.read().decode("utf-8")))
    for row in reader:
        email = row.get("email", "").strip()
        if email:
            contacts_local.append(
                {
                    "name": row.get("name", "").strip(),
                    "email": email,
                }
            )
    return contacts_local


def parse_manual(text):
    contacts_local = []
    for line in text.split("\n"):
        line = line.strip()
        if "@" in line:
            contacts_local.append({"name": "", "email": line})
    return contacts_local


contacts = []
if manual_emails_text:
    contacts.extend(parse_manual(manual_emails_text))
csv_format = st.selectbox(
    "CSV Format Type",
    [
        "My Format (name, email)",
        "Other Format (email, name)",
    ]
)
if csv_file:
    contacts.extend(parse_csv(csv_file, csv_format))

st.write(f"📌 Found **{len(contacts)}** recipient(s).")

if contacts:
    st.dataframe(contacts, use_container_width=True)
    st.caption(
        "Tip: Use `{name}` and `{email}` placeholders in the body to personalize each email."
    )

# -------------------------------
# 3. EMAIL CONTENT (with AI tools)
# -------------------------------
st.header("3. Email Content")

subject = st.text_input("Subject", key="subject_input")

body = st.text_area(
    "Message Body",
    key="body_input",
    height=200,
    placeholder=(
        "Write your email here, or use the AI buttons below to generate content.\n\n"
        "You can use placeholders like {name} and {email} which will be filled per recipient."
    ),
)

col_ai1, col_ai2, col_ai3 = st.columns(3)

with col_ai1:
    btn_from_subject = st.button("✨ Draft / Improve from Subject", use_container_width=True)
with col_ai2:
    btn_from_file = st.button("📎 Draft from First Attachment", use_container_width=True)
with col_ai3:
    btn_rewrite_body = st.button("🪄 Rewrite Current Body", use_container_width=True)


def ensure_gemini_ready() -> bool:
    if not GEMINI_API_KEY:
        st.error(
            "GEMINI_API_KEY is not set. Please set the environment variable or enter it in the sidebar."
        )
        return False
    return True


# Handle AI actions
if btn_from_subject:
    if not subject:
        st.error("Please enter a subject first.")
    elif ensure_gemini_ready():
        try:
            prompt = (
                f"Tone: {tone}\n"
                f"Goal: {email_goal}\n"
                f"Language: {target_language}\n\n"
                f"Subject: {subject}\n\n"
                "Generate a suitable email body for this subject and optionally improve the subject."
            )
            data = call_gemini_for_email(prompt)
            st.session_state.subject_input = data.get("subject", subject)
            st.session_state.body_input = data.get("body", body)
            st.success("AI draft generated from subject.")
            st.rerun()
        except Exception as e:
            st.error(f"AI error: {e}")

if btn_from_file:
    if not uploaded_files:
        st.error("Please upload at least one file to use as AI context.")
    elif ensure_gemini_ready():
        context_text = extract_text_from_uploaded_file(uploaded_files[0])
        if not context_text:
            st.warning(
                "Could not extract text from the first file (or library missing). "
                "Make sure it's a text/PDF/DOCX/CSV file and required libraries are installed."
            )
        try:
            snippet = context_text[:4000] if context_text else ""
            prompt = (
                f"Tone: {tone}\n"
                f"Goal: {email_goal}\n"
                f"Language: {target_language}\n\n"
                "You are given the following document content. "
                "Create a clear and concise email that summarizes or communicates its key points. "
                "If no subject is provided, create one.\n\n"
                f"Document content:\n{snippet}\n\n"
                "Return JSON with a 'subject' and 'body'."
            )
            data = call_gemini_for_email(prompt)
            st.session_state.subject_input = data.get("subject", subject)
            st.session_state.body_input = data.get("body", body)
            st.success("AI draft generated from file content.")
            st.rerun()
        except Exception as e:
            st.error(f"AI error: {e}")

if btn_rewrite_body:
    if not body:
        st.error("Please provide some body text to rewrite.")
    elif ensure_gemini_ready():
        try:
            prompt = (
                f"Tone: {tone}\n"
                f"Goal: {email_goal}\n"
                f"Language: {target_language}\n\n"
                f"Subject (optional): {subject}\n\n"
                "Rewrite the following email body. Make it clearer, more polished, and aligned with the tone and goal. "
                "Preserve placeholders like {name} and {email}.\n\n"
                f"Original body:\n{body}"
            )
            data = call_gemini_for_email(prompt)
            # In this mode we mostly care about body; allow subject to change optionally.
            st.session_state.body_input = data.get("body", body)
            if data.get("subject"):
                st.session_state.subject_input = data["subject"]
            st.success("AI rewrite complete.")
            st.rerun()
        except Exception as e:
            st.error(f"AI error: {e}")


# -------------------------------
# 4. SMTP SETTINGS
# -------------------------------
st.header("4. SMTP Settings")

smtp_col1, smtp_col2 = st.columns(2)
with smtp_col1:
    smtp_host = st.text_input("SMTP Host", "smtp.gmail.com")
    smtp_user = st.text_input("Email Username (From address)")
with smtp_col2:
    smtp_port = st.number_input("SMTP Port", value=587)
    smtp_password = st.text_input("Email App Password", type="password")

security_mode = st.radio(
    "Connection security",
    ["STARTTLS (recommended)", "SSL/TLS", "None"],
    index=0,
    horizontal=True,
)

use_starttls = security_mode == "STARTTLS (recommended)"
use_ssl = security_mode == "SSL/TLS"

st.caption(
    "For Gmail: use host `smtp.gmail.com`, port 587 with STARTTLS or port 465 with SSL/TLS, "
    "and use an App Password (not your normal password)."
)

# -------------------------------
# EMAIL SENDER FUNCTION
# -------------------------------
def send_email(to_email, subject_line, body_text, attachments):
    try:
        msg = EmailMessage()
        msg["From"] = smtp_user
        msg["To"] = to_email
        msg["Subject"] = subject_line
        msg.set_content(body_text)

        # Attach files
        for file in attachments or []:
            file_content = file.getvalue()
            mime_type, _ = mimetypes.guess_type(file.name)
            if mime_type is None:
                maintype, subtype = "application", "octet-stream"
            else:
                maintype, subtype = mime_type.split("/", 1)

            msg.add_attachment(
                file_content,
                maintype=maintype,
                subtype=subtype,
                filename=file.name,
            )

        context = ssl.create_default_context()

        if use_ssl:
            with smtplib.SMTP_SSL(smtp_host, smtp_port, context=context) as server:
                if smtp_user and smtp_password:
                    server.login(smtp_user, smtp_password)
                server.send_message(msg)
        else:
            with smtplib.SMTP(smtp_host, smtp_port) as server:
                if use_starttls:
                    server.starttls(context=context)
                if smtp_user and smtp_password:
                    server.login(smtp_user, smtp_password)
                server.send_message(msg)

        return True

    except Exception as e:
        return str(e)


# -------------------------------
# 5. SEND EMAILS
# -------------------------------
st.header("5. Send Emails")

st.write(
    "Use `{name}` and `{email}` in the body to personalize each message per recipient. "
    "Example: `Hi {name}, just following up on ...`"
)

if st.button("🚀 Send Now", type="primary", use_container_width=True):
    subject = st.session_state.subject_input
    body = st.session_state.body_input

    if not contacts:
        st.error("No recipients found!")
    elif not subject:
        st.error("Subject cannot be empty!")
    elif not body:
        st.error("Email body cannot be empty!")
    elif not smtp_user or not smtp_password:
        st.error("SMTP login required!")
    else:
        progress = st.progress(0)
        log_box = st.empty()

        total = len(contacts)
        success = 0
        failed = 0

        for i, c in enumerate(contacts):
            email = c["email"]
            name = c.get("name", "")

            # Personalize body with {name} and {email}
            template_vars = defaultdict(str, name=name, email=email)
            try:
                personalized_body = body.format_map(template_vars)
            except Exception:
                # If formatting fails, fall back to original body
                personalized_body = body

            result = send_email(email, subject, personalized_body, uploaded_files)

            if result is True:
                success += 1
                log_box.write(f"✅ Sent to {email}")
            else:
                failed += 1
                log_box.write(f"❌ Failed to send to {email}: {result}")

            progress.progress((i + 1) / total)

        st.success(f"Done! ✅ Sent: {success}, ❌ Failed: {failed}")


#mail patelmeet4384@gmail.com passkey =mqre dyks phvp mpvh