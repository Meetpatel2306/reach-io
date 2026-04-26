"""Property-based test template — uses Hypothesis to generate inputs.
Install: pip install hypothesis
"""
from __future__ import annotations

import pytest

try:
    from hypothesis import given, strategies as st, settings
except ImportError:  # pragma: no cover
    pytest.skip("hypothesis not installed (pip install hypothesis)", allow_module_level=True)


def reverse(s: str) -> str:
    return s[::-1]


def add(a: int, b: int) -> int:
    return a + b


class TestReverseProperties:
    @given(st.text())
    def test_double_reverse_is_identity(self, s):
        assert reverse(reverse(s)) == s

    @given(st.text())
    def test_length_is_preserved(self, s):
        assert len(reverse(s)) == len(s)

    @given(st.text(min_size=1))
    def test_first_becomes_last(self, s):
        assert reverse(s)[-1] == s[0]


class TestAddProperties:
    @given(st.integers(), st.integers())
    def test_commutative(self, a, b):
        assert add(a, b) == add(b, a)

    @given(st.integers())
    def test_identity(self, a):
        assert add(a, 0) == a

    @given(st.integers(), st.integers(), st.integers())
    def test_associative(self, a, b, c):
        assert add(add(a, b), c) == add(a, add(b, c))


# Tighter timeouts on long-running properties:
@settings(max_examples=50, deadline=200)
@given(st.lists(st.integers(), min_size=1, max_size=100))
def test_sorted_is_idempotent(xs):
    assert sorted(sorted(xs)) == sorted(xs)
