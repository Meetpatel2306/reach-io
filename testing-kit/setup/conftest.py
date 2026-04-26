"""Shared pytest setup — reset env, freeze time, common fixtures.

Drop this in your project's tests/ folder (the bootstrap script copies it for you).
Anything you add here applies to every test in the project.
"""
from __future__ import annotations

import os
import sys
from pathlib import Path
from datetime import datetime, timezone

import pytest

PROJECT_ROOT = Path(__file__).resolve().parent.parent
if str(PROJECT_ROOT) not in sys.path:
    sys.path.insert(0, str(PROJECT_ROOT))

FIXED_NOW = datetime(2026, 4, 25, 12, 0, 0, tzinfo=timezone.utc)


@pytest.fixture(autouse=True)
def _isolate_env(monkeypatch):
    """Run every test against a clean copy of os.environ and a fixed temp dir."""
    monkeypatch.setenv("ENV", "test")
    monkeypatch.setenv("TZ", "UTC")
    yield


@pytest.fixture
def fixed_now() -> datetime:
    """A stable timestamp tests can pin against."""
    return FIXED_NOW


@pytest.fixture
def project_root() -> Path:
    return PROJECT_ROOT


@pytest.fixture
def tmp_workdir(tmp_path, monkeypatch) -> Path:
    """A temp working directory that is auto-cd'd-into for the test."""
    monkeypatch.chdir(tmp_path)
    return tmp_path
