"""PII protection — mask sensitive data before logging."""


def mask_phone(phone: str) -> str:
    """91XXXXXXXXXX → 91XXXX5678"""
    if len(phone) >= 10:
        return phone[:4] + "XXXX" + phone[-4:]
    return "MASKED"


def mask_gstin(gstin: str) -> str:
    """24AABCP1234H1Z5 → 24XXXXX1234XXXXX"""
    if len(gstin) == 15:
        return gstin[:2] + "XXXXX" + gstin[7:11] + "XXXXX"
    return "MASKED"


def mask_upi(upi_id: str) -> str:
    """name@bank → n***@bank"""
    if "@" in upi_id:
        local, domain = upi_id.split("@", 1)
        return local[0] + "***@" + domain
    return "MASKED"


def mask_email(email: str) -> str:
    """user@example.com → u***@example.com"""
    if "@" in email:
        local, domain = email.split("@", 1)
        return local[0] + "***@" + domain
    return "MASKED"
