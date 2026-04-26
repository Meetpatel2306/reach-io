"""Parametrized pytest template — table-driven tests with @pytest.mark.parametrize."""
from __future__ import annotations

import re
import pytest


def slugify(s: str) -> str:
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", s.strip().lower())).strip("-")


def parse_duration(s: str) -> int | None:
    m = re.fullmatch(r"(\d+)\s*(s|m|h|d)", s)
    if not m:
        return None
    num, unit = m.group(1), m.group(2)
    return int(num) * {"s": 1, "m": 60, "h": 3600, "d": 86400}[unit] * 1000


@pytest.mark.parametrize(
    "raw,expected",
    [
        ("Hello World", "hello-world"),
        ("  spaced  ", "spaced"),
        ("UPPER-CASE", "upper-case"),
        ("multi    spaces", "multi-spaces"),
        ("emoji 🎉 in title", "emoji-in-title"),
        ("", ""),
        ("---a---b---", "a-b"),
    ],
    ids=["basic", "trim", "case", "multi-space", "emoji", "empty", "dashes"],
)
def test_slugify(raw, expected):
    assert slugify(raw) == expected


@pytest.mark.parametrize("good", ["30s", "5m", "1h", "1d", "120s"])
def test_parse_duration_valid(good):
    assert parse_duration(good) is not None


@pytest.mark.parametrize("bad", ["", "abc", "5x", "5", "m5", "5m extra", "-1s"])
def test_parse_duration_invalid(bad):
    assert parse_duration(bad) is None


@pytest.mark.parametrize("a,b,expected", [(1, 1, 2), (2, 3, 5), (-1, 1, 0), (0, 0, 0)])
def test_addition_table(a, b, expected):
    assert a + b == expected


# ---- fixture parametrization (run a single test against many fixtures) ----

@pytest.fixture(params=["sqlite", "postgres", "mysql"])
def db_kind(request):
    return request.param


def test_runs_against_each_db(db_kind):
    # Same assertion runs for every db_kind value; pytest reports each as a separate test.
    assert db_kind in {"sqlite", "postgres", "mysql"}
