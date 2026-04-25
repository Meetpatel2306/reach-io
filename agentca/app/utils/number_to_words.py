"""Convert number to Indian English words: 106200 → 'One Lakh Six Thousand Two Hundred'."""

_ONES = [
    "", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine",
    "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen",
    "Seventeen", "Eighteen", "Nineteen",
]
_TENS = [
    "", "", "Twenty", "Thirty", "Forty", "Fifty", "Sixty", "Seventy", "Eighty", "Ninety",
]


def _two_digits(n: int) -> str:
    if n < 20:
        return _ONES[n]
    return (_TENS[n // 10] + " " + _ONES[n % 10]).strip()


def _three_digits(n: int) -> str:
    if n == 0:
        return ""
    if n < 100:
        return _two_digits(n)
    return f"{_ONES[n // 100]} Hundred {_two_digits(n % 100)}".strip()


def number_to_words(n: int) -> str:
    """Convert integer to Indian English words (Lakh/Crore system)."""
    if n == 0:
        return "Zero"
    if n < 0:
        return f"Minus {number_to_words(abs(n))}"

    parts = []

    # Crore (1,00,00,000)
    if n >= 1_00_00_000:
        crore = n // 1_00_00_000
        parts.append(f"{_two_digits(crore)} Crore")
        n %= 1_00_00_000

    # Lakh (1,00,000)
    if n >= 1_00_000:
        lakh = n // 1_00_000
        parts.append(f"{_two_digits(lakh)} Lakh")
        n %= 1_00_000

    # Thousand (1,000)
    if n >= 1_000:
        thousand = n // 1_000
        parts.append(f"{_two_digits(thousand)} Thousand")
        n %= 1_000

    # Hundred + remainder
    if n > 0:
        parts.append(_three_digits(n))

    return " ".join(parts).strip()


def amount_in_words(amount: float) -> str:
    """Rs.1,06,200.50 → 'Rupees One Lakh Six Thousand Two Hundred and Fifty Paise Only'."""
    rupees = int(amount)
    paise = round((amount - rupees) * 100)

    result = f"Rupees {number_to_words(rupees)}"
    if paise > 0:
        result += f" and {number_to_words(paise)} Paise"
    result += " Only"
    return result
