"""Indian fiscal year and GST deadline helpers."""

from datetime import date


def get_fiscal_year(d: date | None = None) -> tuple[date, date]:
    d = d or date.today()
    if d.month >= 4:
        return date(d.year, 4, 1), date(d.year + 1, 3, 31)
    return date(d.year - 1, 4, 1), date(d.year, 3, 31)


def get_fiscal_year_label(d: date | None = None) -> str:
    start, end = get_fiscal_year(d)
    return f"{start.year}-{str(end.year)[2:]}"


def get_gst_period(d: date | None = None) -> str:
    """MMYYYY format for GST period."""
    d = d or date.today()
    return f"{d.month:02d}{d.year}"


def get_gstr1_deadline(month: int, year: int) -> date:
    """GSTR-1 due: 11th of next month."""
    if month == 12:
        return date(year + 1, 1, 11)
    return date(year, month + 1, 11)


def get_gstr3b_deadline(month: int, year: int) -> date:
    """GSTR-3B due: 20th of next month."""
    if month == 12:
        return date(year + 1, 1, 20)
    return date(year, month + 1, 20)


def days_until(deadline: date) -> int:
    return (deadline - date.today()).days


def format_indian_date(d: date) -> str:
    return d.strftime("%d/%m/%Y")


MONTHS_HINDI = {
    1: "January", 2: "February", 3: "March", 4: "April",
    5: "May", 6: "June", 7: "July", 8: "August",
    9: "September", 10: "October", 11: "November", 12: "December",
}


def format_month_year(month: int, year: int) -> str:
    return f"{MONTHS_HINDI[month]} {year}"
