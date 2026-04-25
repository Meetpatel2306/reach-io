"""GST calculation engine — DETERMINISTIC, RULE-BASED (never AI).

This is the most critical module. Tax calculations MUST be exact.
Every function is pure and testable.
"""

from __future__ import annotations


def is_intra_state(seller_state: str, buyer_state: str) -> bool:
    """Determine if transaction is intra-state (CGST+SGST) or inter-state (IGST)."""
    if not seller_state or not buyer_state:
        return True  # Default to intra-state if states unknown
    return seller_state == buyer_state


def calculate_item_tax(
    taxable_amount: float,
    gst_rate: float,
    intra_state: bool = True,
) -> dict:
    """
    Calculate GST for a single item.

    Returns:
        {"taxable_amount", "cgst", "sgst", "igst", "total", "gst_rate"}
    """
    taxable_amount = round(taxable_amount, 2)

    if intra_state:
        half_rate = gst_rate / 2
        cgst = round(taxable_amount * half_rate / 100, 2)
        sgst = round(taxable_amount * half_rate / 100, 2)
        igst = 0.0
    else:
        cgst = 0.0
        sgst = 0.0
        igst = round(taxable_amount * gst_rate / 100, 2)

    total = round(taxable_amount + cgst + sgst + igst, 2)

    return {
        "taxable_amount": taxable_amount,
        "cgst": cgst,
        "sgst": sgst,
        "igst": igst,
        "total": total,
        "gst_rate": gst_rate,
    }


def calculate_invoice_totals(
    items: list[dict],
    intra_state: bool = True,
) -> dict:
    """
    Calculate invoice totals from line items.
    Each item needs: quantity, rate, gst_rate, discount_percent (optional).
    """
    subtotal = 0.0
    total_cgst = 0.0
    total_sgst = 0.0
    total_igst = 0.0

    for item in items:
        qty = item.get("quantity", 1)
        rate = item.get("rate", 0)
        discount = item.get("discount_percent", 0)
        gst_rate = item.get("gst_rate", 0)

        taxable = round(qty * rate * (1 - discount / 100), 2)
        tax = calculate_item_tax(taxable, gst_rate, intra_state)

        subtotal += tax["taxable_amount"]
        total_cgst += tax["cgst"]
        total_sgst += tax["sgst"]
        total_igst += tax["igst"]

    grand_total = subtotal + total_cgst + total_sgst + total_igst
    round_off = round(grand_total) - grand_total

    return {
        "subtotal": round(subtotal, 2),
        "cgst": round(total_cgst, 2),
        "sgst": round(total_sgst, 2),
        "igst": round(total_igst, 2),
        "round_off": round(round_off, 2),
        "total": round(grand_total + round_off, 2),
    }


def calculate_net_liability(
    output_cgst: float, output_sgst: float, output_igst: float,
    input_cgst: float, input_sgst: float, input_igst: float,
) -> dict:
    """
    Calculate net GST payable after ITC utilization.
    Follows GST ITC utilization order as per law.
    """
    # Step 1: IGST credit against IGST liability
    igst_remaining = input_igst
    igst_payable = max(0, output_igst - igst_remaining)
    igst_remaining = max(0, igst_remaining - output_igst)

    # Step 2: Remaining IGST credit → split between CGST and SGST
    igst_to_cgst = min(igst_remaining / 2, max(0, output_cgst - input_cgst))
    igst_to_sgst = min(igst_remaining - igst_to_cgst, max(0, output_sgst - input_sgst))

    # Step 3: CGST credit against CGST
    cgst_payable = max(0, output_cgst - input_cgst - igst_to_cgst)

    # Step 4: SGST credit against SGST
    sgst_payable = max(0, output_sgst - input_sgst - igst_to_sgst)

    net = round(igst_payable + cgst_payable + sgst_payable, 2)

    return {
        "igst_payable": round(igst_payable, 2),
        "cgst_payable": round(cgst_payable, 2),
        "sgst_payable": round(sgst_payable, 2),
        "net_tax_payable": net,
    }
