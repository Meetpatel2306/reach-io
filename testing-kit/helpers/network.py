"""Python network mocking helpers — wraps unittest.mock + httpx for common patterns."""
from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Callable, Iterable
from unittest.mock import patch, MagicMock


def json_response(body: Any, status: int = 200) -> MagicMock:
    """Build a MagicMock that mimics the bits of a `requests`/`httpx` response."""
    r = MagicMock()
    r.status_code = status
    r.ok = 200 <= status < 300
    r.json.return_value = body
    r.text = str(body)
    r.headers = {"content-type": "application/json"}
    return r


@contextmanager
def patched_requests(target: str, responses: Iterable[Any]):
    """Patch `target` (dotted path to a `requests.get` etc.) with a sequence of canned responses."""
    iterator = iter(responses)
    with patch(target) as mock:
        mock.side_effect = lambda *a, **kw: next(iterator)
        yield mock


@contextmanager
def fail_on(target: str, exc: Exception):
    """Force `target` to raise `exc` for the duration of the block."""
    with patch(target, side_effect=exc) as mock:
        yield mock


def make_async_mock(return_value: Any = None, side_effect: Any = None) -> MagicMock:
    """Create a MagicMock whose call returns an awaitable resolving to `return_value`."""
    mock = MagicMock()

    async def _impl(*args, **kwargs):
        if side_effect:
            if isinstance(side_effect, Exception):
                raise side_effect
            if callable(side_effect):
                result = side_effect(*args, **kwargs)
                if hasattr(result, "__await__"):
                    return await result
                return result
        return return_value

    mock.side_effect = _impl
    return mock


def call_arg(mock: MagicMock, position: int = 0, *, call_index: int = 0) -> Any:
    """Pull positional arg `position` from call `call_index` of a MagicMock."""
    return mock.call_args_list[call_index].args[position]


def call_kwarg(mock: MagicMock, name: str, *, call_index: int = 0) -> Any:
    return mock.call_args_list[call_index].kwargs[name]
