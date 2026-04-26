"""Async pytest template — pytest-asyncio is configured in asyncio_mode=auto, so async
test functions are picked up automatically (no @pytest.mark.asyncio needed)."""
from __future__ import annotations

import asyncio
import pytest


async def fetch_user(user_id: str) -> dict:
    await asyncio.sleep(0)
    return {"id": user_id, "name": f"user-{user_id}"}


async def fan_out(ids: list[str]) -> list[dict]:
    return await asyncio.gather(*[fetch_user(i) for i in ids])


async def with_timeout(coro, ms: int):
    return await asyncio.wait_for(coro, timeout=ms / 1000)


class TestFetchUser:
    async def test_returns_user(self):
        u = await fetch_user("1")
        assert u == {"id": "1", "name": "user-1"}

    async def test_concurrent_fan_out(self):
        users = await fan_out(["1", "2", "3"])
        assert [u["id"] for u in users] == ["1", "2", "3"]


class TestTimeout:
    async def test_completes_under_budget(self):
        async def quick():
            await asyncio.sleep(0)
            return "ok"
        assert await with_timeout(quick(), 100) == "ok"

    async def test_raises_on_too_slow(self):
        async def slow():
            await asyncio.sleep(1)
        with pytest.raises(asyncio.TimeoutError):
            await with_timeout(slow(), 10)


class TestCancellation:
    async def test_cancelling_a_task_propagates(self):
        async def runner():
            await asyncio.sleep(10)
            return "never"
        task = asyncio.create_task(runner())
        await asyncio.sleep(0)
        task.cancel()
        with pytest.raises(asyncio.CancelledError):
            await task
