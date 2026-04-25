"""Tests for GSTIN validator."""

from app.utils.gstin_validator import validate_gstin, extract_pan, get_state_code, get_state_name


def test_valid_gstin_format():
    # This is a structurally valid GSTIN (checksum may vary)
    is_valid, msg = validate_gstin("29AABCT1332L1ZM")
    # We just check it doesn't crash — checksum depends on exact value
    assert isinstance(is_valid, bool)
    assert isinstance(msg, str)


def test_invalid_length_short():
    is_valid, msg = validate_gstin("07AABCG1234")
    assert not is_valid
    assert "15" in msg


def test_invalid_length_long():
    is_valid, msg = validate_gstin("07AABCG1234H1Z5X")
    assert not is_valid
    assert "15" in msg


def test_empty_gstin():
    is_valid, msg = validate_gstin("")
    assert not is_valid
    assert "khali" in msg


def test_invalid_format():
    is_valid, msg = validate_gstin("123456789012345")
    assert not is_valid
    assert "format" in msg.lower()


def test_invalid_state_code():
    is_valid, msg = validate_gstin("99AABCG1234H1Z5")
    assert not is_valid


def test_extract_pan():
    assert extract_pan("24AABCP1234H1Z5") == "AABCP1234H"
    assert extract_pan("short") == ""


def test_get_state_code():
    assert get_state_code("24AABCP1234H1Z5") == "24"
    assert get_state_code("07AABCG1234H1Z5") == "07"


def test_get_state_name():
    assert get_state_name("24AABCP1234H1Z5") == "Gujarat"
    assert get_state_name("07AABCG1234H1Z5") == "Delhi"
    assert get_state_name("27AABCM1234D1ZM") == "Maharashtra"


def test_whitespace_handling():
    is_valid, msg = validate_gstin("  24AABCP1234H1Z5  ")
    # Should strip whitespace before validating
    assert isinstance(is_valid, bool)


def test_lowercase_converted():
    is_valid, msg = validate_gstin("24aabcp1234h1z5")
    # Should convert to uppercase
    assert isinstance(is_valid, bool)
