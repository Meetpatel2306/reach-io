"""Flask test template — uses test_client for in-process HTTP tests."""
from __future__ import annotations

import pytest

# from app import create_app

try:
    from flask import Flask, jsonify, request
except ImportError:  # pragma: no cover
    pytest.skip("flask not installed", allow_module_level=True)


def make_app() -> Flask:
    app = Flask(__name__)
    app.config["TESTING"] = True

    @app.get("/health")
    def health():
        return jsonify(ok=True)

    @app.post("/echo")
    def echo():
        return jsonify(request.get_json() or {})

    @app.get("/items/<int:id>")
    def item(id: int):
        if id == 0:
            return jsonify(error="not found"), 404
        return jsonify(id=id, name=f"item-{id}")

    return app


@pytest.fixture
def client():
    app = make_app()
    with app.test_client() as c:
        yield c


class TestHealth:
    def test_returns_ok(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        assert r.get_json() == {"ok": True}


class TestEcho:
    def test_echoes_posted_json(self, client):
        r = client.post("/echo", json={"a": 1, "b": "x"})
        assert r.status_code == 200
        assert r.get_json() == {"a": 1, "b": "x"}

    def test_empty_body_returns_empty_json(self, client):
        r = client.post("/echo", json={})
        assert r.get_json() == {}


class TestItems:
    @pytest.mark.parametrize("id_", [1, 5, 99])
    def test_returns_item(self, client, id_):
        r = client.get(f"/items/{id_}")
        assert r.status_code == 200
        assert r.get_json() == {"id": id_, "name": f"item-{id_}"}

    def test_returns_404_when_missing(self, client):
        r = client.get("/items/0")
        assert r.status_code == 404
        assert "not found" in r.get_json()["error"]
