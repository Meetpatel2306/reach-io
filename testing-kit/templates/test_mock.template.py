"""Mocking template — patching external modules, monkeypatching env, fake httpx."""
from __future__ import annotations

import os
import pytest
from unittest.mock import MagicMock, patch


# ---- monkeypatch (preferred for env / attrs) -----------------------------

class TestEnvMonkeypatch:
    def test_overrides_env_for_one_test(self, monkeypatch):
        monkeypatch.setenv("FEATURE_X", "on")
        assert os.environ["FEATURE_X"] == "on"

    def test_env_reverts_after_test(self):
        # FEATURE_X from the previous test should not leak.
        assert os.environ.get("FEATURE_X") != "on"


# ---- patching a function inside a module --------------------------------

def get_user_remote(user_id: str) -> dict:
    raise RuntimeError("real network would happen here")


def get_user(user_id: str) -> dict:
    raw = get_user_remote(user_id)
    return {"id": raw["id"], "display": raw["name"].upper()}


class TestPatchFunction:
    def test_patch_with_with_block(self):
        with patch(__name__ + ".get_user_remote") as fake:
            fake.return_value = {"id": "u-1", "name": "alice"}
            assert get_user("u-1") == {"id": "u-1", "display": "ALICE"}
            fake.assert_called_once_with("u-1")

    def test_patch_with_decorator(self):
        with patch(__name__ + ".get_user_remote", return_value={"id": "x", "name": "bob"}):
            assert get_user("x")["display"] == "BOB"


# ---- side_effect for sequential / dynamic responses ----------------------

class TestSideEffect:
    def test_side_effect_list(self):
        m = MagicMock(side_effect=[1, 2, 3])
        assert [m(), m(), m()] == [1, 2, 3]

    def test_side_effect_callable(self):
        m = MagicMock(side_effect=lambda x: x * 10)
        assert m(2) == 20
        assert m(5) == 50

    def test_side_effect_exception(self):
        m = MagicMock(side_effect=ValueError("boom"))
        with pytest.raises(ValueError):
            m()


# ---- spying on real implementation ---------------------------------------

class TestSpy:
    def test_spy_with_wraps(self):
        real = lambda x: x + 1
        spy = MagicMock(wraps=real)
        assert spy(2) == 3
        spy.assert_called_once_with(2)
