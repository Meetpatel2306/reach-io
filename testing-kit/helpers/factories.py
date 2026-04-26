"""Generic Python test factories — small helpers for building fixtures fast."""
from __future__ import annotations

from datetime import datetime, timedelta, timezone
from itertools import count
from typing import Callable, Iterable, TypeVar

T = TypeVar("T")

_id_counter = count(1)
FIXED_NOW = datetime(2026, 4, 25, 12, 0, 0, tzinfo=timezone.utc)


def next_id(prefix: str = "id") -> str:
    return f"{prefix}-{next(_id_counter)}"


def reset_id_counter() -> None:
    global _id_counter
    _id_counter = count(1)


def iso_offset(base: datetime, offset_seconds: float) -> str:
    return (base + timedelta(seconds=offset_seconds)).isoformat()


def build_many(n: int, build: Callable[[int], T]) -> list[T]:
    return [build(i) for i in range(n)]


def cycle(items: Iterable[T], i: int) -> T:
    arr = list(items)
    return arr[i % len(arr)]


def deep_merge(base, over):
    """Recursive merge of two plain dicts. Right-hand wins on scalars/arrays."""
    if not isinstance(base, dict) or not isinstance(over, dict):
        return over
    out = dict(base)
    for k, v in over.items():
        out[k] = deep_merge(base.get(k), v)
    return out


def snapshot_lengths(state: dict) -> dict[str, int]:
    return {k: len(v) for k, v in state.items() if isinstance(v, (list, tuple, set, dict))}
