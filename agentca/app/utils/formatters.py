"""Indian currency and number formatting."""


def format_inr(amount: float) -> str:
    """Format in Indian Rupee style: 1234567.89 → Rs.12,34,567.89"""
    if amount < 0:
        return f"-{format_inr(abs(amount))}"

    integer_part = int(amount)
    decimal_part = round(amount - integer_part, 2)

    s = str(integer_part)
    if len(s) <= 3:
        formatted = s
    else:
        last_three = s[-3:]
        remaining = s[:-3]
        groups = []
        while len(remaining) > 2:
            groups.append(remaining[-2:])
            remaining = remaining[:-2]
        if remaining:
            groups.append(remaining)
        groups.reverse()
        formatted = ",".join(groups) + "," + last_three

    if decimal_part > 0:
        return f"Rs.{formatted}{f'{decimal_part:.2f}'[1:]}"
    return f"Rs.{formatted}"


def format_compact_inr(amount: float) -> str:
    """Compact: 150000 → Rs.1.5L, 10000000 → Rs.1Cr"""
    if amount >= 1_00_00_000:
        return f"Rs.{amount / 1_00_00_000:.1f}Cr"
    if amount >= 1_00_000:
        return f"Rs.{amount / 1_00_000:.1f}L"
    if amount >= 1_000:
        return f"Rs.{amount / 1_000:.1f}K"
    return format_inr(amount)


def format_phone(phone: str) -> str:
    """Normalize to 91XXXXXXXXXX."""
    phone = phone.strip().replace(" ", "").replace("-", "").replace("+", "")
    if len(phone) == 10:
        return f"91{phone}"
    if len(phone) == 12 and phone.startswith("91"):
        return phone
    return phone


def truncate(text: str, max_len: int = 280) -> str:
    if len(text) <= max_len:
        return text
    return text[:max_len - 3] + "..."
