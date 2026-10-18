from datetime import datetime, timezone
import httpx
import pytest

from backend.app.config import settings
from tests.conftest import FakeRedis


@pytest.mark.asyncio
async def test_ingest_single_reading_camel_case(client: httpx.AsyncClient, fake_redis: FakeRedis):
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "sensorId": "sensor-temp-101",
        "type": "temperature",
        "value": 24.5,
        "timestamp": now,
    }

    response = await client.post("/api/v1/readings", json=payload)
    assert response.status_code == 202
    data = response.json()
    assert data["accepted"] == 1
    assert "queued successfully" in data["message"]

    # Verify enqueued in fake_redis
    queue_items = fake_redis.lists.get(settings.reading_queue_name, [])
    assert len(queue_items) == 1
    assert "sensor-temp-101" in queue_items[0]


@pytest.mark.asyncio
async def test_ingest_single_reading_snake_case(client: httpx.AsyncClient, fake_redis: FakeRedis):
    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "sensor_id": "sensor-humidity-202",
        "reading_type": "humidity",
        "value": 45.0,
        "timestamp": now,
    }

    response = await client.post("/api/v1/readings", json=payload)
    assert response.status_code == 202
    data = response.json()
    assert data["accepted"] == 1


@pytest.mark.asyncio
async def test_ingest_reading_without_timezone_fails(client: httpx.AsyncClient):
    payload = {
        "sensorId": "sensor-temp-101",
        "type": "temperature",
        "value": 24.5,
        "timestamp": "2026-10-19T02:00:00",  # Missing timezone offset
    }

    response = await client.post("/api/v1/readings", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_ingest_batch_readings(client: httpx.AsyncClient, fake_redis: FakeRedis):
    now = datetime.now(timezone.utc).isoformat()
    readings = [
        {
            "sensorId": f"sensor-{i}",
            "type": "co2",
            "value": 400.0 + i * 10,
            "timestamp": now,
        }
        for i in range(5)
    ]

    response = await client.post("/api/v1/readings/batch", json={"readings": readings})
    assert response.status_code == 202
    data = response.json()
    assert data["accepted"] == 5

    queue_items = fake_redis.lists.get(settings.reading_queue_name, [])
    assert len(queue_items) == 5


@pytest.mark.asyncio
async def test_ingest_batch_empty_fails(client: httpx.AsyncClient):
    response = await client.post("/api/v1/readings/batch", json={"readings": []})
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_ingest_reading_queue_unavailable(client: httpx.AsyncClient, fake_redis: FakeRedis, monkeypatch: pytest.MonkeyPatch):
    async def failing_rpush(*args, **kwargs):
        raise ConnectionError("Redis is down")

    monkeypatch.setattr(fake_redis, "rpush", failing_rpush)

    now = datetime.now(timezone.utc).isoformat()
    payload = {
        "sensorId": "sensor-temp-101",
        "type": "temperature",
        "value": 24.5,
        "timestamp": now,
    }

    response = await client.post("/api/v1/readings", json=payload)
    assert response.status_code == 503
    assert "Unable to queue" in response.json()["detail"]
