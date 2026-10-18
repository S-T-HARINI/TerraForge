import httpx
import pytest
from sqlalchemy import text


@pytest.mark.asyncio
async def test_health_endpoint(client: httpx.AsyncClient):
    response = await client.get("/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"
    assert data["service"] == "TerraForge"


@pytest.mark.asyncio
async def test_api_versioned_health_endpoint(client: httpx.AsyncClient):
    response = await client.get("/api/v1/health")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ok"


@pytest.mark.asyncio
async def test_health_ready_success(client: httpx.AsyncClient):
    response = await client.get("/health/ready")
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "ready"
    assert data["database"] == "connected"
    assert data["redis"] == "connected"


@pytest.mark.asyncio
async def test_health_ready_redis_failure(client: httpx.AsyncClient, monkeypatch: pytest.MonkeyPatch, fake_redis):
    async def failing_ping():
        raise ConnectionError("Redis is unreachable")

    monkeypatch.setattr(fake_redis, "ping", failing_ping)

    response = await client.get("/health/ready")
    assert response.status_code == 503
    data = response.json()
    assert data["status"] == "not_ready"
    assert data["database"] == "connected"
    assert data["redis"] == "unavailable"
