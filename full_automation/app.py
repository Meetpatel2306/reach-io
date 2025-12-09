# ============================================
#     AI Email Blaster Pro — PREMIUM UI
# ============================================

import os
import time
import random
import streamlit as st

from utils import (
    extract_text,
    parse_manual,
    parse_csv,
    personalize,
    read_logs,
)
from email_ai import (
    list_gemini_models,
    ai_generate_email,
    generate_subject_variants,
    generate_body_variants,
    rewrite_body,
    analyze_spam_risk,
)
from email_sender import send_bulk_emails


# ----------------------------------------------------------
# APP BASE CONFIG
# ----------------------------------------------------------
st.set_page_config(
    page_title="AI Email Blaster Pro",
    page_icon="📨",
    layout="wide",
)


# ----------------------------------------------------------
# LOAD PREMIUM UI CSS
# ----------------------------------------------------------
st.markdown(
    """
<style>

* { font-family: 'Inter', sans-serif !important; }

/* Background gradient */
.stApp {
    background: radial-gradient(circle at top, #1e293b, #0f172a);
}

/* Glassmorphism cards */
.glass-card {
    background: rgba(255,255,255,0.06);
    border: 1px solid rgba(255,255,255,0.1);
    backdrop-filter: blur(14px);
    border-radius: 16px;
    padding: 22px;
    margin-bottom: 20px;
}

/* Buttons: gradient + hover + elevation */
.stButton>button {
    background: linear-gradient(90deg, #6366F1 0%, #8B5CF6 100%);
    color: white;
    border: none;
    padding: 0.7rem 1.4rem;
    border-radius: 12px;
    font-size: 1rem;
    font-weight: 600;
    transition: all 0.2s ease-in-out;
}

.stButton>button:hover {
    transform: translateY(-3px) scale(1.02);
    box-shadow: 0 8px 20px rgba(99,102,241,0.35);
}

/* Section Title (Gradient Text) */
.section-title {
    font-size: 1.8rem !important;
    font-weight: 700 !important;
    background: linear-gradient(90deg,#818CF8,#A78BFA,#C084FC);
    -webkit-background-clip: text;
    -webkit-text-fill-color: transparent;
    margin-top: 20px;
}

/* Step Navigation */
.step-nav {
    display:flex;
    gap:20px;
    align-items:center;
    margin-bottom:30px;
}

.step {
    width:28px;height:28px;
    border-radius:50%;
    background:#334155;
    color:#f1f5f9;
    display:flex;justify-content:center;align-items:center;
    font-weight:700;
}

.step.active {
    background:#6366F1;
}

/* Sticky Preview */
.sticky-preview {
    position: sticky;
    top: 20px;
}

/* Code-like preview box */
.email-preview-box {
    background: rgba(0,0,0,0.6);
    border:1px solid rgba(255,255,255,0.1);
    border-radius:12px;
    padding:16px;
    color:#e2e8f0;
    font-family: monospace;
    white-space: pre-wrap;
}

/* Logs */
.log-container {
    background:#0f172a;
    color:#94a3b8;
    padding:15px;
    border-radius:12px;
    border:1px solid #1e293b;
    height:380px;
    overflow-y:auto;
    font-size:0.85rem;
}

</style>
""",
    unsafe_allow_html=True,
)

# ----------------------------------------------------------
# HEADER / HERO SECTION
# ----------------------------------------------------------
st.markdown(
    """
<h1 style="font-size:3rem; font-weight:800; text-align:center; color:white; margin-bottom:0;">
    🚀 AI Email Blaster Pro
</h1>
<p style="text-align:center; font-size:1.2rem; color:#cbd5e1;">
AI-powered cold outreach system with personalization, throttling & variants rotation.
</p>
""",
    unsafe_allow_html=True,
)

# Step indicator
st.markdown(
    """
<div class="step-nav" style="justify-content:center;">
    <span class="step active">1</span> Upload
    <span class="step">2</span> Recipients
    <span class="step">3</span> AI Copy
    <span class="step">4</span> Send
</div>
""",
    unsafe_allow_html=True,
)

# ----------------------------------------------------------
# SIDEBAR
# ----------------------------------------------------------
with st.sidebar:
    st.image("https://i.imgur.com/6M1K9jS.png", caption="", use_container_width=True)

    st.header("⚙️ AI Settings")
    api_key = st.text_input("Gemini API Key", type="password")

    # You could dynamically list models:
    # models = list_gemini_models(api_key) if api_key else ["models/gemini-2.5-flash"]
    # model_name = st.selectbox("Model", models)
    model_name = st.selectbox("Model", ["models/gemini-2.5-flash"])

    tone = st.selectbox("Tone", ["Neutral", "Professional", "Friendly", "Formal"])
    goal = st.selectbox("Goal", ["Cold Outreach", "Follow-up", "Sales", "General"])
    language = st.text_input("Language", "English")
    persona = st.selectbox("Persona", ["Default", "Sales Rep", "Founder", "Recruiter"])

    st.header("🚦 Sending Strategy")

    raw_min_delay = st.number_input("Min Delay (sec)", min_value=0.0, max_value=60.0, value=2.0, step=1.0)
    raw_max_delay = st.number_input("Max Delay (sec)", min_value=0.0, max_value=120.0, value=5.0, step=1.0)

    if raw_min_delay > raw_max_delay:
        st.warning("Min delay cannot be greater than max delay — auto corrected.")
        min_delay = raw_min_delay
        max_delay = raw_min_delay
    else:
        min_delay = raw_min_delay
        max_delay = raw_max_delay

    max_to_send = st.number_input("Max emails", min_value=1, max_value=5000, value=200, step=1)

    st.header("📟 Logs")
    refresh_logs = st.checkbox("Auto-refresh logs")
    max_lines = st.slider("Max log lines", 50, 2000, 400)


# ----------------------------------------------------------
# MAIN LAYOUT
# ----------------------------------------------------------
left, right = st.columns([2, 1])

# =================== LEFT SIDE ===================
with left:

    # -------------------
    # FILE UPLOADS
    # -------------------
    st.markdown('<div class="section-title">1. Attachments</div>', unsafe_allow_html=True)
    st.markdown('<div class="glass-card">', unsafe_allow_html=True)

    uploaded_files = st.file_uploader("Upload files (any type supported)", accept_multiple_files=True)

    st.markdown('</div>', unsafe_allow_html=True)

    context_text = ""
    if uploaded_files:
        try:
            context_text = extract_text(uploaded_files[0])[:800]
        except Exception:
            context_text = ""

    # -------------------
    # RECIPIENTS
    # -------------------
    st.markdown('<div class="section-title">2. Recipients</div>', unsafe_allow_html=True)
    st.markdown('<div class="glass-card">', unsafe_allow_html=True)

    manual = st.text_area("Enter emails manually (one per line):")
    contacts = []

    if manual:
        contacts.extend(parse_manual(manual))

    csv_format = st.selectbox("CSV Format", ["My Format (name,email)", "Other Format (email,name)"])
    csv_file = st.file_uploader("Upload CSV", type=["csv"])

    if csv_file:
        contacts.extend(parse_csv(csv_file, csv_format))

    st.info(f"📌 Loaded {len(contacts)} recipients.")
    st.markdown('</div>', unsafe_allow_html=True)

    # -------------------
    # EMAIL CONTENT & AI
    # -------------------
    st.markdown('<div class="section-title">3. Email Content</div>', unsafe_allow_html=True)
    st.markdown('<div class="glass-card">', unsafe_allow_html=True)

    # Session state init
    if "subject" not in st.session_state:
        st.session_state.subject = ""
    if "body" not in st.session_state:
        st.session_state.body = ""
    if "subject_variants" not in st.session_state:
        st.session_state.subject_variants = []
    if "body_variants" not in st.session_state:
        st.session_state.body_variants = []

    # Subject (clear variants when user edits manually)
    prev_subject = st.session_state.subject
    subject = st.text_input("Subject", prev_subject)
    if subject != prev_subject:
        # If user changes subject manually, discard old variants
        st.session_state.subject_variants = []
    st.session_state.subject = subject

    # Body (clear variants when user edits manually)
    prev_body = st.session_state.body
    body = st.text_area("Email Body ({name}, {email} supported)", prev_body, height=180)
    if body != prev_body:
        st.session_state.body_variants = []
    st.session_state.body = body

    col_ai1, col_ai2, col_ai3 = st.columns(3)

    # Auto-generate email
    if col_ai1.button("✨ Auto-Generate"):
        if not api_key:
            st.error("Missing API Key")
        else:
            try:
                res = ai_generate_email(api_key, model_name, tone, goal, language, persona, subject, context_text)
                st.session_state.subject = res["subject"]
                st.session_state.body = res["body"]
                # Clear variants since we got a fresh email
                st.session_state.subject_variants = []
                st.session_state.body_variants = []
                st.rerun()
            except Exception as e:
                st.error(f"Generation failed: {e}")

    # Subject variants
    if col_ai2.button("🧪 Subject Variants"):
        if not api_key:
            st.error("Missing API Key")
        else:
            try:
                res = generate_subject_variants(api_key, model_name, tone, goal, language, subject, 10)
                st.session_state.subject_variants = res.get("subjects", [])
                if st.session_state.subject_variants:
                    st.success(f"Generated {len(st.session_state.subject_variants)} subject variants.")
                else:
                    st.warning("No variants generated.")
            except Exception as e:
                st.error(f"Variant generation failed: {e}")

    # Body variants
    if col_ai3.button("📄 Body Variants"):
        if not api_key:
            st.error("Missing API Key")
        else:
            try:
                res = generate_body_variants(api_key, model_name, tone, goal, language, persona, subject, context_text, 3)
                st.session_state.body_variants = res.get("bodies", [])
                if st.session_state.body_variants:
                    st.success(f"Generated {len(st.session_state.body_variants)} body variants.")
                else:
                    st.warning("No body variants generated.")
            except Exception as e:
                st.error(f"Body variant error: {e}")

    # Rewrite
    rewrite_style = st.selectbox("Rewrite body", ["More Professional", "More Friendly", "Shorter", "Longer"])
    if st.button("🔁 Rewrite"):
        if not api_key:
            st.error("Missing API Key")
        else:
            try:
                res = rewrite_body(api_key, model_name, body, rewrite_style, tone, language)
                st.session_state.body = res["body"]
                # After rewrite, discard body variants
                st.session_state.body_variants = []
                st.rerun()
            except Exception as e:
                st.error(f"Rewrite failed: {e}")

    st.markdown('</div>', unsafe_allow_html=True)

    # -------------------
    # SPAM ANALYSIS
    # -------------------
    st.markdown('<div class="section-title">Spam Check</div>', unsafe_allow_html=True)
    st.markdown('<div class="glass-card">', unsafe_allow_html=True)

    if st.button("🚨 Analyze Spam"):
        if not api_key:
            st.error("Missing API Key")
        else:
            try:
                st.session_state.spam = analyze_spam_risk(api_key, model_name, subject, body, language)
            except Exception as e:
                st.error(f"Spam analysis failed: {e}")

    if "spam" in st.session_state:
        spam = st.session_state.spam
        st.write(f"📊 Score: {spam['score']}/100 — **{spam['label'].upper()}**")
        st.write("Reasons:", spam["reasons"])

    st.markdown('</div>', unsafe_allow_html=True)


# =================== RIGHT SIDE (PREVIEW) ===================
with right:
    st.markdown('<div class="sticky-preview">', unsafe_allow_html=True)

    st.markdown('<div class="section-title">Preview</div>', unsafe_allow_html=True)
    st.markdown('<div class="glass-card">', unsafe_allow_html=True)

    preview_html = f"""
    <div class="email-preview-box">
    <strong>To:</strong> {{name}} &lt;{{email}}&gt;<br>
    <strong>Subject:</strong> {st.session_state.subject}

    <br><br>{st.session_state.body}
    </div>
    """

    st.markdown(preview_html, unsafe_allow_html=True)

    st.markdown('</div>', unsafe_allow_html=True)
    st.markdown('</div>', unsafe_allow_html=True)

# ----------------------------------------------------------
# SENDING
# ----------------------------------------------------------
st.markdown('<div class="section-title">4. Send Emails</div>', unsafe_allow_html=True)
st.markdown('<div class="glass-card">', unsafe_allow_html=True)

smtp_host = st.text_input("SMTP Host", "smtp.gmail.com")
smtp_port = st.number_input("Port", min_value=1, max_value=9999, value=587)
smtp_user = st.text_input("SMTP Username")
smtp_pass = st.text_input("SMTP App Password", type="password")
security = st.radio("Security", ["STARTTLS", "SSL"], horizontal=True)

smtp_config = {
    "host": smtp_host,
    "port": int(smtp_port),
    "user": smtp_user,
    "pass": smtp_pass,
    "use_starttls": security == "STARTTLS",
    "use_ssl": security == "SSL",
}

attach_files = st.checkbox("Attach uploaded files?", True)

# 🔁 NEW: toggle variant usage so subject doesn't change every time unless you want it
use_variants = st.checkbox("Use subject/body variants (rotate per email)?", False)

if st.button("🚀 Send Now"):
    if not contacts:
        st.error("No contacts found.")
    elif not st.session_state.subject:
        st.error("Subject missing.")
    elif not st.session_state.body:
        st.error("Body missing.")
    else:
        progress = st.progress(0)
        msg_box = st.empty()

        def update(done, total, email, ok, msg):
            progress.progress(done / total)
            msg_box.write(msg)

        sent, failed = send_bulk_emails(
            contacts=contacts,
            subject=st.session_state.subject,
            body=st.session_state.body,
            attachments=uploaded_files if attach_files else None,
            config=smtp_config,
            personalize_fn=personalize,
            max_to_send=max_to_send,
            min_delay=min_delay,
            max_delay=max_delay,
            subject_variants=st.session_state.subject_variants if use_variants else [],
            body_variants=st.session_state.body_variants if use_variants else [],
            on_progress=update,
        )

        st.success(f"Task completed — Sent: {sent}, Failed: {failed}")

st.markdown('</div>', unsafe_allow_html=True)

# ----------------------------------------------------------
# LOG VIEWER
# ----------------------------------------------------------
st.markdown('<div class="section-title">Logs</div>', unsafe_allow_html=True)
st.markdown('<div class="glass-card">', unsafe_allow_html=True)

log_path = "logs/app.log"

if os.path.exists(log_path):
    logs = read_logs(log_path, max_lines)
    st.markdown(f'<div class="log-container">{logs}</div>', unsafe_allow_html=True)
else:
    st.info("No logs yet.")

if refresh_logs:
    time.sleep(2)
    st.rerun()

st.markdown('</div>', unsafe_allow_html=True)
