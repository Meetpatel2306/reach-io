# ============================================
#            email_ai.py (Refactored)
# ============================================

import json
import re
import logging
import google.generativeai as genai

logging.debug("email_ai.py loaded.")


# ------------------------------------------------------
# Configure Gemini
# ------------------------------------------------------
def configure(api_key: str):
    if not api_key:
        raise ValueError("Missing Gemini API Key.")
    genai.configure(api_key=api_key)


# ------------------------------------------------------
# List Models
# ------------------------------------------------------
def list_gemini_models(api_key: str):
    configure(api_key)
    models = []
    try:
        for m in genai.list_models():
            if "generateContent" in getattr(m, "supported_generation_methods", []):
                models.append(m.name)
    except Exception as e:
        logging.error(f"Error listing models: {e}")
        models = ["models/gemini-2.5-flash"]
    return sorted(models)


# ------------------------------------------------------
# Robust JSON Cleaner
# ------------------------------------------------------
def extract_json(text: str):
    """
    Cleans Gemini output and extracts the first JSON object found.
    Handles:
    - ```json fences
    - extra explanation around JSON
    """
    if not text:
        raise ValueError("Empty model output.")

    cleaned = text.strip()
    cleaned = cleaned.replace("```json", "").replace("```", "").strip()

    match = re.search(r"\{[\s\S]*\}", cleaned)
    if not match:
        raise ValueError(f"No JSON object found in model output. Raw: {cleaned[:200]}")

    json_str = match.group(0)
    try:
        return json.loads(json_str)
    except json.JSONDecodeError as e:
        logging.error(f"JSON decode error: {e} | Raw: {json_str}")
        raise ValueError("Invalid JSON returned by Gemini.") from e


# ------------------------------------------------------
# Generic model call
# ------------------------------------------------------
def _call(
    api_key: str,
    model_name: str,
    system_instruction: str,
    user_prompt: str,
    temperature: float = 0.4,
):
    """
    Wraps a Gemini call and guarantees a JSON dict return
    using extract_json().
    """
    configure(api_key)
    model = genai.GenerativeModel(model_name)

    try:
        response = model.generate_content(
            [system_instruction, user_prompt],
            generation_config={"temperature": temperature}
        )

        # Safer extraction of text
        raw = getattr(response, "text", None)
        if not raw:
            # Fallback: manual candidate parsing
            if hasattr(response, "candidates") and response.candidates:
                parts = response.candidates[0].content.parts
                raw = "".join(getattr(p, "text", "") for p in parts)
            else:
                raise ValueError("Gemini returned empty response.")

        return extract_json(raw)

    except Exception as e:
        logging.error(f"Gemini call failed: {e}")
        raise


# ------------------------------------------------------
# Generate full email
# ------------------------------------------------------
def ai_generate_email(api_key, model_name, tone, goal, language, persona, subject_hint, context):
    sys = 'You are an email writer. Return ONLY valid JSON: {"subject":"","body":""}'
    prompt = f"""
Write an email.
Tone: {tone}
Goal: {goal}
Language: {language}
Persona: {persona}
Subject hint: {subject_hint}
Context: {context}
"""
    return _call(api_key, model_name, sys, prompt)


# ------------------------------------------------------
# Subject variants
# ------------------------------------------------------
def generate_subject_variants(api_key, model_name, tone, goal, language, subject_hint, count):
    sys = 'Return ONLY JSON: {"subjects":["..."]} with an array of strings.'
    prompt = f"""
Generate {count} different subject lines for an email.
Tone: {tone}
Goal: {goal}
Language: {language}
Hint: {subject_hint}
Avoid numbering; just pure subject lines.
"""
    return _call(api_key, model_name, sys, prompt)


# ------------------------------------------------------
# Body variants
# ------------------------------------------------------
def generate_body_variants(api_key, model_name, tone, goal, language, persona, subject, context, count):
    sys = 'Return ONLY JSON: {"bodies":["..."]} with an array of email body strings.'
    prompt = f"""
Generate {count} different email bodies.
Tone: {tone}
Goal: {goal}
Language: {language}
Persona: {persona}
Subject: {subject}
Context: {context}
Each body should be ready to send (no placeholders like SUBJECT:).
"""
    return _call(api_key, model_name, sys, prompt)


# ------------------------------------------------------
# Rewrite body
# ------------------------------------------------------
def rewrite_body(api_key, model_name, body, rewrite_style, tone, language):
    sys = 'Return ONLY JSON: {"body":""} with the full rewritten email body.'
    prompt = f"""
Rewrite the email body.
Style: {rewrite_style}
Tone: {tone}
Language: {language}
Original: {body}
Don't add explanations, only return the rewritten email body.
"""
    return _call(api_key, model_name, sys, prompt)


# ------------------------------------------------------
# Spam analysis
# ------------------------------------------------------
def analyze_spam_risk(api_key, model_name, subject, body, language):
    sys = 'Return ONLY JSON: {"score":0,"label":"","reasons":""}'
    prompt = f"""
Analyze the spam risk of this email.
Subject: {subject}
Body: {body}
Language: {language}

- score: integer from 0 (no risk) to 100 (very high risk)
- label: "low", "medium", or "high"
- reasons: short explanation in plain text
"""
    return _call(api_key, model_name, sys, prompt, temperature=0.2)
