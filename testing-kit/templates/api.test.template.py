"""FastAPI endpoint test template — uses httpx via TestClient.

Run: pytest tests/test_api_starter.py
"""
import pytest

# from fastapi.testclient import TestClient
# from app.main import app
#
# client = TestClient(app)


@pytest.mark.skip(reason="wire up `from app.main import app` then remove this marker")
class TestHealthEndpoint:
    def test_health_returns_200(self):
        # response = client.get("/health")
        # assert response.status_code == 200
        # assert response.json() == {"status": "ok"}
        pass

    def test_unknown_route_returns_404(self):
        # response = client.get("/this-does-not-exist")
        # assert response.status_code == 404
        pass


@pytest.mark.asyncio
@pytest.mark.skip(reason="example async pattern — adapt to your async client")
async def test_async_endpoint():
    # async with httpx.AsyncClient(app=app, base_url="http://test") as ac:
    #     r = await ac.get("/health")
    # assert r.status_code == 200
    pass
