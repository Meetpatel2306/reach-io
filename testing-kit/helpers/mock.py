"""Pytest mocking helpers — sugar on top of unittest.mock for common patterns."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Callable
from unittest.mock import patch, MagicMock


@contextmanager
def patch_many(targets: dict[str, Any]):
    """Patch many targets at once. `targets` maps dotted-path → return_value."""
    patches = [patch(name, return_value=value) for name, value in targets.items()]
    started = [p.start() for p in patches]
    try:
        yield dict(zip(targets.keys(), started))
    finally:
        for p in patches:
            p.stop()


@contextmanager
def freeze_attr(obj, name: str, value: Any):
    """Temporarily set `obj.name = value` and restore the previous value on exit."""
    sentinel = object()
    prev = getattr(obj, name, sentinel)
    setattr(obj, name, value)
    try:
        yield
    finally:
        if prev is sentinel:
            delattr(obj, name)
        else:
            setattr(obj, name, prev)


def call_log(mock: MagicMock) -> list[dict]:
    """Return a list of `{args, kwargs}` for each call — easier to assert on than `call_args_list`."""
    return [{"args": call.args, "kwargs": call.kwargs} for call in mock.call_args_list]


def assert_called_with_subset(mock: MagicMock, **expected) -> None:
    """Assert mock was called with kwargs containing at least `expected` (extras are OK)."""
    actual = mock.call_args.kwargs if mock.call_args else {}
    for k, v in expected.items():
        assert actual.get(k) == v, f"expected kwarg {k}={v!r}, got {actual.get(k)!r}"
