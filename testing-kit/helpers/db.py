"""DB test helpers — sqlite scratch DBs and SQL setup/teardown for fast tests."""
from __future__ import annotations

import sqlite3
from contextlib import contextmanager
from typing import Iterable


@contextmanager
def sqlite_memory(schema_sql: str | Iterable[str] | None = None):
    """Yield a fresh in-memory sqlite connection. Auto-closes on exit."""
    conn = sqlite3.connect(":memory:")
    try:
        if schema_sql:
            stmts = [schema_sql] if isinstance(schema_sql, str) else list(schema_sql)
            for s in stmts:
                conn.executescript(s)
            conn.commit()
        yield conn
    finally:
        conn.close()


def seed(conn: sqlite3.Connection, table: str, rows: list[dict]) -> None:
    """Insert a list of dicts into `table`. All rows must share the same keys."""
    if not rows:
        return
    cols = list(rows[0].keys())
    placeholders = ",".join(["?"] * len(cols))
    sql = f"INSERT INTO {table} ({','.join(cols)}) VALUES ({placeholders})"
    conn.executemany(sql, [tuple(r[c] for c in cols) for r in rows])
    conn.commit()


def count(conn: sqlite3.Connection, table: str, where: str | None = None, params: tuple = ()) -> int:
    sql = f"SELECT COUNT(*) FROM {table}"
    if where:
        sql += f" WHERE {where}"
    return conn.execute(sql, params).fetchone()[0]


def fetch_all(conn: sqlite3.Connection, sql: str, params: tuple = ()) -> list[dict]:
    cur = conn.execute(sql, params)
    cols = [d[0] for d in cur.description]
    return [dict(zip(cols, row)) for row in cur.fetchall()]
