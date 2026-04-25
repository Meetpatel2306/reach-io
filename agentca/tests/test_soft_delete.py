"""Tests for soft delete behavior (logic tests, no DB needed)."""

from app.production.pii import mask_phone, mask_gstin, mask_upi


def test_mask_phone():
    assert mask_phone("919876543210") == "9198XXXX3210"
    assert mask_phone("short") == "MASKED"


def test_mask_gstin():
    assert mask_gstin("24AABCP1234H1Z5") == "24XXXXX1234XXXXX"
    assert mask_gstin("short") == "MASKED"


def test_mask_upi():
    assert mask_upi("ramesh@upi") == "r***@upi"
    assert mask_upi("nope") == "MASKED"


def test_mask_phone_with_plus():
    assert mask_phone("+919876543210") == "+919XXXX3210"
