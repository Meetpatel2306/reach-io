"""Tests for Indian number formatting."""

from app.utils.formatters import format_inr, format_compact_inr, format_phone
from app.utils.number_to_words import number_to_words, amount_in_words


def test_format_inr_small():
    assert format_inr(50) == "Rs.50"
    assert format_inr(999) == "Rs.999"


def test_format_inr_thousands():
    assert format_inr(1000) == "Rs.1,000"
    assert format_inr(99999) == "Rs.99,999"


def test_format_inr_lakhs():
    assert format_inr(100000) == "Rs.1,00,000"
    assert format_inr(1234567) == "Rs.12,34,567"


def test_format_inr_crores():
    assert format_inr(10000000) == "Rs.1,00,00,000"


def test_format_inr_with_decimal():
    assert format_inr(1234567.89) == "Rs.12,34,567.89"


def test_format_inr_negative():
    assert format_inr(-5000) == "-Rs.5,000"


def test_format_compact_lakhs():
    assert format_compact_inr(150000) == "Rs.1.5L"


def test_format_compact_crores():
    assert format_compact_inr(10000000) == "Rs.1.0Cr"


def test_format_phone_10_digit():
    assert format_phone("9876543210") == "919876543210"


def test_format_phone_with_91():
    assert format_phone("919876543210") == "919876543210"


def test_format_phone_with_plus():
    assert format_phone("+919876543210") == "919876543210"


def test_number_to_words_basic():
    assert number_to_words(0) == "Zero"
    assert number_to_words(1) == "One"
    assert number_to_words(100) == "One Hundred"
    assert number_to_words(1000) == "One Thousand"


def test_number_to_words_lakh():
    assert "Lakh" in number_to_words(100000)


def test_number_to_words_crore():
    assert "Crore" in number_to_words(10000000)


def test_number_to_words_complex():
    result = number_to_words(106200)
    assert "One Lakh" in result
    assert "Six Thousand" in result
    assert "Two Hundred" in result


def test_amount_in_words():
    result = amount_in_words(106200)
    assert result.startswith("Rupees")
    assert result.endswith("Only")
