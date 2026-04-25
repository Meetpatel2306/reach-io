"""Tests for GST calculator — CRITICAL: tax math must be exact."""

from app.services.gst_calculator import (
    calculate_item_tax,
    calculate_invoice_totals,
    calculate_net_liability,
    is_intra_state,
)


def test_intra_state_same_code():
    assert is_intra_state("24", "24") is True


def test_inter_state_different_codes():
    assert is_intra_state("24", "27") is False


def test_intra_state_empty_defaults_true():
    assert is_intra_state("", "") is True


def test_item_tax_intra_state_18():
    result = calculate_item_tax(10000, 18, intra_state=True)
    assert result["taxable_amount"] == 10000
    assert result["cgst"] == 900
    assert result["sgst"] == 900
    assert result["igst"] == 0
    assert result["total"] == 11800


def test_item_tax_inter_state_18():
    result = calculate_item_tax(10000, 18, intra_state=False)
    assert result["cgst"] == 0
    assert result["sgst"] == 0
    assert result["igst"] == 1800
    assert result["total"] == 11800


def test_item_tax_5_percent():
    result = calculate_item_tax(20000, 5, intra_state=True)
    assert result["cgst"] == 500
    assert result["sgst"] == 500
    assert result["total"] == 21000


def test_item_tax_zero_gst():
    result = calculate_item_tax(5000, 0, intra_state=True)
    assert result["cgst"] == 0
    assert result["sgst"] == 0
    assert result["igst"] == 0
    assert result["total"] == 5000


def test_item_tax_28_percent():
    result = calculate_item_tax(10000, 28, intra_state=True)
    assert result["cgst"] == 1400
    assert result["sgst"] == 1400
    assert result["total"] == 12800


def test_invoice_totals_single_item():
    items = [{"quantity": 50, "rate": 500, "gst_rate": 18}]
    result = calculate_invoice_totals(items, intra_state=True)
    assert result["subtotal"] == 25000
    assert result["cgst"] == 2250
    assert result["sgst"] == 2250
    assert result["total"] == 29500


def test_invoice_totals_multiple_items():
    items = [
        {"quantity": 100, "rate": 65, "gst_rate": 18},
        {"quantity": 50, "rate": 72, "gst_rate": 18},
    ]
    result = calculate_invoice_totals(items, intra_state=True)
    assert result["subtotal"] == 10100  # 6500 + 3600
    assert result["cgst"] == 909  # (6500*9% + 3600*9%) = 585 + 324 = 909
    assert result["sgst"] == 909


def test_invoice_totals_with_discount():
    items = [{"quantity": 10, "rate": 1000, "gst_rate": 18, "discount_percent": 10}]
    result = calculate_invoice_totals(items, intra_state=True)
    assert result["subtotal"] == 9000  # 10*1000 - 10% = 9000
    assert result["cgst"] == 810  # 9000 * 9%
    assert result["sgst"] == 810


def test_net_liability_basic():
    result = calculate_net_liability(
        output_cgst=5000, output_sgst=5000, output_igst=0,
        input_cgst=2000, input_sgst=2000, input_igst=0,
    )
    assert result["cgst_payable"] == 3000
    assert result["sgst_payable"] == 3000
    assert result["net_tax_payable"] == 6000


def test_net_liability_with_igst_credit():
    result = calculate_net_liability(
        output_cgst=5000, output_sgst=5000, output_igst=2000,
        input_cgst=1000, input_sgst=1000, input_igst=4000,
    )
    # IGST credit (4000) first against IGST output (2000) = 2000 remaining
    # Remaining 2000 split: 1000 to CGST, 1000 to SGST
    # CGST payable = 5000 - 1000 (input) - 1000 (IGST) = 3000
    # SGST payable = 5000 - 1000 (input) - 1000 (IGST) = 3000
    assert result["igst_payable"] == 0
    assert result["net_tax_payable"] == 6000


def test_net_liability_zero():
    result = calculate_net_liability(
        output_cgst=1000, output_sgst=1000, output_igst=0,
        input_cgst=2000, input_sgst=2000, input_igst=0,
    )
    assert result["cgst_payable"] == 0
    assert result["sgst_payable"] == 0
    assert result["net_tax_payable"] == 0
