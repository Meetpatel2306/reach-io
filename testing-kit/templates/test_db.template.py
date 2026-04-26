"""DB test template — sqlite in-memory by default; the patterns work for sqlalchemy, asyncpg, etc.

Run: pytest tests/test_db_starter.py
"""
from __future__ import annotations

import sqlite3
import pytest


@pytest.fixture
def db():
    """Fresh in-memory sqlite per test — no leakage between tests."""
    conn = sqlite3.connect(":memory:")
    conn.execute("""
        CREATE TABLE users (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            email TEXT UNIQUE NOT NULL,
            name TEXT NOT NULL
        )
    """)
    conn.commit()
    yield conn
    conn.close()


@pytest.fixture
def db_with_seed(db):
    db.executemany(
        "INSERT INTO users (email, name) VALUES (?, ?)",
        [("a@b.com", "Alice"), ("c@d.com", "Carol")],
    )
    db.commit()
    return db


class TestUserCRUD:
    def test_insert_and_read(self, db):
        db.execute("INSERT INTO users (email, name) VALUES (?, ?)", ("x@y.com", "Xy"))
        db.commit()
        rows = db.execute("SELECT email, name FROM users").fetchall()
        assert rows == [("x@y.com", "Xy")]

    def test_unique_constraint_raises(self, db_with_seed):
        with pytest.raises(sqlite3.IntegrityError):
            db_with_seed.execute(
                "INSERT INTO users (email, name) VALUES (?, ?)",
                ("a@b.com", "duplicate"),
            )

    def test_update_one_row(self, db_with_seed):
        db_with_seed.execute("UPDATE users SET name = ? WHERE email = ?", ("Alicia", "a@b.com"))
        db_with_seed.commit()
        name = db_with_seed.execute(
            "SELECT name FROM users WHERE email = ?", ("a@b.com",)
        ).fetchone()[0]
        assert name == "Alicia"

    def test_delete_then_count(self, db_with_seed):
        db_with_seed.execute("DELETE FROM users WHERE email = ?", ("a@b.com",))
        db_with_seed.commit()
        count = db_with_seed.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        assert count == 1


class TestTransactionRollback:
    def test_rollback_undoes_inserts(self, db):
        try:
            db.execute("INSERT INTO users (email, name) VALUES (?, ?)", ("x@y.com", "Xy"))
            raise RuntimeError("simulated failure")
        except RuntimeError:
            db.rollback()
        count = db.execute("SELECT COUNT(*) FROM users").fetchone()[0]
        assert count == 0
