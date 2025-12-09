# dashboard_app.py
#used mail file and dashboard_dynamic.py for send resume and take its data and send mail to hr 
import io
import csv
import os
from dotenv import load_dotenv
load_dotenv()
import re
import json
import pdfplumber
from typing import List

import streamlit as st

from mail import (
    EmailConfig,
    EmailSender,
    Contact,
    run_campaign,
    render_template,
)

# ---------------------------------------------
# 🔥 GEMINI AI CLIENT
# ---------------------------------------------
import google.generativeai as genai

GEMINI_API_KEY = os.getenv("GEMINI_API_KEY")

if not GEMINI_API_KEY:
    st.error("❌ Error: GEMINI_API_KEY missing in .env file!")
else:
    genai.configure(api_key=GEMINI_API_KEY)

# Use the actual supported model from your list
model = genai.GenerativeModel("models/gemini-2.5-flash")


# ---------------------------------------------
# CLEANING PDF TEXT (CRITICAL FOR ACCURACY)
# ---------------------------------------------

def clean_resume_text(text: str) -> str:
    """Clean up broken PDF text for better AI accuracy."""
    text = text.replace("\t", " ").replace("•", " ")
    text = re.sub(r"\s{2,}", " ", text)
    text = re.sub(r"\n{2,}", "\n", text)
    lines = [line.strip() for line in text.split("\n")]
    text = "\n".join(lines)
    return text


# ---------------------------------------------
# PDF EXTRACTION
# ---------------------------------------------

def extract_text_from_pdf(uploaded_pdf):
    """High-accuracy PDF text extraction using pdfplumber."""
    text = ""
    with pdfplumber.open(uploaded_pdf) as pdf:
        for page in pdf.pages:
            t = page.extract_text()
            if t:
                text += t + "\n"
    return clean_resume_text(text)


# ---------------------------------------------
# GEMINI AI PARSER (SUPER ACCURATE)
# ---------------------------------------------

def parse_resume_with_ai(text: str):
    """Uses Gemini LLM to parse resume into structured JSON with strict rules."""

    prompt = f"""
You are an expert ATS resume parser. 
Your job is to convert the following unstructured resume text into PERFECT, STRICT JSON.

RULES:
- Return ONLY valid JSON. No comments. No extra text.
- If a field is missing, return an empty string "".
- Skills must be a comma-separated string.
- Experience must ALWAYS be a list of objects.
- Education must ALWAYS be a list of objects.
- NEVER return Markdown formatting.
- NEVER guess company names if not explicitly present.

EXPECTED JSON FORMAT:
{{
  "full_name": "",
  "email": "",
  "phone": "",
  "linkedin": "",
  "github": "",
  "summary": "",
  "skills": "",
  "total_experience_years": "",
  "education": [
    {{
      "degree": "",
      "school": "",
      "year": ""
    }}
  ],
  "job_experience": [
    {{
      "company": "",
      "role": "",
      "duration": "",
      "description": ""
    }}
  ],
  "projects": [
    {{
      "name": "",
      "description": ""
    }}
  ]
}}

EXAMPLE INPUT:
John Doe
Python Developer
Skills: Python, FastAPI, SQL
Company: ABC Corp
Role: Backend Engineer
2021-2023

EXAMPLE OUTPUT JSON:
{{
  "full_name": "John Doe",
  "email": "",
  "phone": "",
  "linkedin": "",
  "github": "",
  "summary": "Python Developer with experience in APIs",
  "skills": "Python, FastAPI, SQL",
  "total_experience_years": "2",
  "education": [],
  "job_experience": [
    {{
      "company": "ABC Corp",
      "role": "Backend Engineer",
      "duration": "2021-2023",
      "description": ""
    }}
  ],
  "projects": []
}}

NOW PARSE THE ACTUAL RESUME BELOW:

RESUME TEXT:
{text}
"""

    response = model.generate_content(prompt)

    try:
        return json.loads(response.text)
    except:
        return {}


# ---------------------------------------------
# STREAMLIT UI
# ---------------------------------------------

st.set_page_config(page_title="AI Job Application Bot (Gemini 2.5)", layout="wide")
st.title("📨 AI-Powered Job Application Bot (Gemini 2.5 Flash)")
st.write("Automatically extracts resume details using **Google Gemini AI** and generates personalized cold emails.")


# ---------------------------------------------
# 1. UPLOAD RESUME
# ---------------------------------------------

st.header("1. Upload Resume (PDF)")
resume_file = st.file_uploader("Upload Resume", type=["pdf"])

parsed_resume = {}

if resume_file:
    st.info("Extracting text from PDF…")
    raw_text = extract_text_from_pdf(resume_file)

    st.subheader("Cleaned Extracted Text:")
    st.code(raw_text)

    st.info("Sending to Gemini AI for structured parsing…")
    parsed_resume = parse_resume_with_ai(raw_text)

    st.success("Resume parsed successfully ✓")

    st.subheader("AI Extracted Resume Data:")
    st.json(parsed_resume)


# ---------------------------------------------
# 2. AUTO-FILLED PERSONAL DETAILS
# ---------------------------------------------

st.header("2. Personal Details (Editable)")

def ui_field(label, key):
    return st.text_input(label, value=parsed_resume.get(key, ""))

your_name = ui_field("Your Name", "full_name")
your_email = ui_field("Email", "email")
your_phone = ui_field("Phone", "phone")
linkedin = ui_field("LinkedIn", "linkedin")
github = ui_field("GitHub", "github")

skills = st.text_area("Skills", value=parsed_resume.get("skills", ""))
summary = st.text_area("Summary", value=parsed_resume.get("summary", ""))

experience_years = parsed_resume.get("total_experience_years", "1")


# ---------------------------------------------
# 3. HR CONTACT INPUT
# ---------------------------------------------

st.header("3. HR Contacts")

contacts_file = st.file_uploader("Upload HR CSV", type=["csv"])

manual_input = st.text_area(
    "Or Add HR Manually",
    placeholder="Example:\nRohan Sharma <hr@company.com>"
)

def parse_manual(text):
    pattern = r"(.*?)[<\[]\s*([\w\.-]+@[\w\.-]+\.\w+)\s*[>\]]"
    contacts = []
    for line in text.split("\n"):
        m = re.search(pattern, line)
        if m:
            contacts.append(Contact(name=m.group(1).strip(), email=m.group(2).strip()))
    return contacts

manual_contacts = parse_manual(manual_input) if manual_input else []


def parse_csv(file):
    reader = csv.DictReader(io.StringIO(file.read().decode("utf-8")))
    contacts = []
    for row in reader:
        contacts.append(
            Contact(
                name=row.get("name", "Hiring Manager"),
                email=row["email"],
                company=row.get("company", "")
            )
        )
    return contacts


# ---------------------------------------------
# 4. EMAIL TEMPLATE
# ---------------------------------------------

st.header("4. Cold Email Template")

job_title = st.text_input("Job Title", "Backend Developer")

subject_template = "Application for {job_title} Position"

body_template = f"""
Dear {{hr_name}},

I hope you are doing well. I am writing to express my interest in the {{job_title}} role at {{company}}.

Based on my background, I bring {experience_years}+ years of experience in:
{skills}

Summary:
{summary}

I have attached my resume for your review. I would be glad to discuss how I can contribute to your team.

Best regards,
{your_name}
{your_phone}
{your_email}
LinkedIn: {linkedin}
GitHub: {github}
"""

st.text_area("Preview Email", value=body_template, height=300)


# ---------------------------------------------
# 5. SMTP SETTINGS
# ---------------------------------------------

st.header("5. SMTP Settings")

smtp_host = st.text_input("SMTP Host", "smtp.gmail.com")
smtp_port = st.number_input("Port", value=587)
smtp_tls = st.checkbox("Use TLS", value=True)
smtp_user = st.text_input("Email Username")
smtp_pass = st.text_input("App Password", type="password")

delay_seconds = st.number_input("Delay (seconds)", value=60)
max_emails = st.number_input("Max emails (0 = unlimited)", value=10)


# ---------------------------------------------
# 6. SEND EMAILS
# ---------------------------------------------

st.header("6. Send Emails")

def send_ai_emails(contacts):
    resume_path = "./_resume_temp.pdf"
    with open(resume_path, "wb") as f:
        f.write(resume_file.getbuffer())

    config = EmailConfig(
        smtp_host=smtp_host,
        smtp_port=smtp_port,
        username=smtp_user,
        password=smtp_pass,
        use_tls=smtp_tls,
        from_name=your_name,
    )

    sender = EmailSender(config)

    result = run_campaign(
        sender=sender,
        contacts=contacts,
        job_title=job_title,
        subject_template=subject_template,
        body_template_html=body_template.replace("\n", "<br>"),
        body_template_text=body_template,
        resume_path=resume_path,
        delay_seconds=delay_seconds,
        max_emails=max_emails if max_emails > 0 else None,
    )

    st.success(f"Emails Sent: {result.sent} / Failed: {result.failed}")


if st.button("🚀 Send Applications"):
    if not resume_file:
        st.error("Upload resume first!")
    elif not (contacts_file or manual_contacts):
        st.error("Add HR contacts!")
    else:
        contacts = parse_csv(contacts_file) if contacts_file else manual_contacts
        send_ai_emails(contacts)
