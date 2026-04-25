"""HSN/SAC code lookup and classification."""

from __future__ import annotations
from app import database as db


def suggest_hsn(description: str) -> tuple[str | None, float]:
    """Suggest HSN code from product description. Returns (code, confidence)."""
    if not description:
        return None, 0.0

    # Search in HSN codes table
    desc_lower = description.lower()
    codes = db.select("hsn_codes", limit=1000)

    best_match = None
    best_score = 0.0

    for code in codes:
        keywords = (code.get("search_keywords", "") + " " + code.get("description", "")).lower()
        words = desc_lower.split()
        matches = sum(1 for w in words if w in keywords)
        score = matches / max(len(words), 1)

        if score > best_score:
            best_score = score
            best_match = code

    if best_match and best_score > 0.3:
        return best_match["code"], best_score

    return None, 0.0


def get_gst_rate_for_hsn(hsn_code: str) -> float | None:
    """Get default GST rate for an HSN code."""
    code = db.select_one("hsn_codes", {"code": hsn_code})
    if code:
        return code.get("gst_rate")
    return None
