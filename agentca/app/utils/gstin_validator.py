"""GSTIN validator with checksum verification."""

import re

VALID_STATE_CODES = {
    "01", "02", "03", "04", "05", "06", "07", "08", "09", "10",
    "11", "12", "13", "14", "15", "16", "17", "18", "19", "20",
    "21", "22", "23", "24", "25", "26", "27", "28", "29", "30",
    "31", "32", "33", "34", "35", "36", "37", "38", "97",
}

STATE_NAMES = {
    "01": "Jammu & Kashmir", "02": "Himachal Pradesh", "03": "Punjab",
    "04": "Chandigarh", "05": "Uttarakhand", "06": "Haryana",
    "07": "Delhi", "08": "Rajasthan", "09": "Uttar Pradesh",
    "10": "Bihar", "11": "Sikkim", "12": "Arunachal Pradesh",
    "13": "Nagaland", "14": "Manipur", "15": "Mizoram",
    "16": "Tripura", "17": "Meghalaya", "18": "Assam",
    "19": "West Bengal", "20": "Jharkhand", "21": "Odisha",
    "22": "Chhattisgarh", "23": "Madhya Pradesh", "24": "Gujarat",
    "25": "Daman & Diu", "26": "Dadra & Nagar Haveli",
    "27": "Maharashtra", "28": "Andhra Pradesh (Old)",
    "29": "Karnataka", "30": "Goa", "31": "Lakshadweep",
    "32": "Kerala", "33": "Tamil Nadu", "34": "Puducherry",
    "35": "Andaman & Nicobar", "36": "Telangana",
    "37": "Andhra Pradesh", "38": "Ladakh", "97": "Other Territory",
}

GSTIN_PATTERN = re.compile(r"^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$")
CHECKSUM_CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ"


def _compute_checksum(gstin_14: str) -> str:
    total = 0
    for i, char in enumerate(gstin_14):
        val = CHECKSUM_CHARS.index(char)
        if i % 2 != 0:
            val *= 2
        quotient, remainder = divmod(val, 36)
        total += quotient + remainder
    check_val = (36 - (total % 36)) % 36
    return CHECKSUM_CHARS[check_val]


def validate_gstin(gstin: str) -> tuple[bool, str]:
    """Validate GSTIN. Returns (is_valid, message)."""
    if not gstin:
        return False, "GSTIN khali hai"

    gstin = gstin.strip().upper()

    if len(gstin) != 15:
        return False, f"GSTIN 15 characters ka hona chahiye, aapka {len(gstin)} hai"

    if not GSTIN_PATTERN.match(gstin):
        return False, "GSTIN format galat hai. Example: 24AABCP1234H1Z5"

    state_code = gstin[:2]
    if state_code not in VALID_STATE_CODES:
        return False, f"State code '{state_code}' valid nahi hai"

    expected = _compute_checksum(gstin[:14])
    if gstin[14] != expected:
        return False, "GSTIN checksum match nahi karta"

    return True, f"Valid GSTIN — {STATE_NAMES.get(state_code, 'Unknown')}"


def extract_pan(gstin: str) -> str:
    return gstin[2:12] if len(gstin) == 15 else ""


def get_state_code(gstin: str) -> str:
    return gstin[:2] if len(gstin) >= 2 else ""


def get_state_name(gstin: str) -> str:
    return STATE_NAMES.get(get_state_code(gstin), "Unknown")
