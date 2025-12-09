# ============================================
#             utils.py (FINAL REFACTORED)
# ============================================

import io
import csv
import logging

try:
    import PyPDF2
except Exception:
    PyPDF2 = None

try:
    import docx
except Exception:
    docx = None


# --------------------------------------------------------
# Extract text from uploaded file
# --------------------------------------------------------
def extract_text(uploaded_file):
    name = uploaded_file.name.lower()
    data = uploaded_file.getvalue()

    # TXT
    if name.endswith(".txt"):
        try:
            return data.decode("utf-8", errors="ignore")
        except Exception:
            return ""

    # CSV
    if name.endswith(".csv"):
        try:
            return data.decode("utf-8", errors="ignore")
        except Exception:
            return ""

    # PDF
    if name.endswith(".pdf") and PyPDF2:
        try:
            reader = PyPDF2.PdfReader(io.BytesIO(data))
            pages = []
            for p in reader.pages[:5]:
                pages.append(p.extract_text() or "")
            return "\n".join(pages)
        except Exception as e:
            logging.error(f"PDF extract error: {e}")
            return ""

    # DOCX
    if name.endswith(".docx") and docx:
        try:
            doc = docx.Document(io.BytesIO(data))
            return "\n".join(p.text for p in doc.paragraphs)
        except Exception as e:
            logging.error(f"DOCX extract error: {e}")
            return ""

    # Unknown file types return blank
    return ""


# --------------------------------------------------------
# Parse manual emails
# --------------------------------------------------------
def parse_manual(text):
    """
    Very simple parser:
    - one email per line
    - ignores lines without "@"
    """
    contacts = []
    for line in text.split("\n"):
        line = line.strip()
        if "@" in line:
            # In case user writes: Name <email>
            if "<" in line and ">" in line:
                try:
                    name_part, email_part = line.split("<", 1)
                    email = email_part.split(">", 1)[0].strip()
                    name = name_part.strip()
                except Exception:
                    name = ""
                    email = line
            else:
                name = ""
                email = line

            contacts.append({"name": name, "email": email})
    return contacts


# --------------------------------------------------------
# Parse CSV with 2 format choices
# --------------------------------------------------------
def parse_csv(uploaded_csv, format_type):
    contacts = []
    try:
        data = uploaded_csv.getvalue().decode("utf-8", errors="ignore")
        reader = csv.DictReader(io.StringIO(data))

        for row in reader:
            if format_type == "My Format (name,email)":
                name = str(row.get("name", "")).strip()
                email = str(row.get("email", "")).strip()
            else:  # OTHER FORMAT (email, name)
                email = (
                    row.get("email") or
                    row.get("Email") or
                    row.get("email_address") or ""
                )
                name = (
                    row.get("name") or
                    row.get("Name") or
                    row.get("full_name") or ""
                )
                email = str(email).strip()
                name = str(name).strip()

            if email:
                contacts.append({"name": name, "email": email})

    except Exception as e:
        logging.error(f"CSV parse error: {e}")

    return contacts


# --------------------------------------------------------
# Personalization
# --------------------------------------------------------
def personalize(body, name, email):
    try:
        return body.format(name=name or "", email=email or "")
    except Exception:
        return body


# --------------------------------------------------------
# Read log file
# --------------------------------------------------------
def read_logs(path, max_lines=500):
    try:
        with open(path, "r", encoding="utf-8", errors="ignore") as f:
            lines = f.readlines()
        return "".join(lines[-max_lines:])
    except Exception:
        return "Log file missing."
