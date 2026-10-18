from uuid import uuid4
import httpx
import pytest


@pytest.mark.asyncio
async def test_create_threshold_rule(client: httpx.AsyncClient):
    payload = {
        "name": "High Temperature Warning",
        "description": "Alert when library temperature exceeds 30C",
        "sensor_id": "sensor-lib-01",
        "reading_type": "temperature",
        "rule_type": "threshold",
        "operator": ">",
        "threshold": 30.0,
        "enabled": True,
    }

    response = await client.post("/api/v1/rules", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["name"] == payload["name"]
    assert data["rule_type"] == "threshold"
    assert data["threshold"] == 30.0
    assert data["enabled"] is True
    assert "id" in data


@pytest.mark.asyncio
async def test_create_time_window_rule(client: httpx.AsyncClient):
    payload = {
        "name": "Sustained High CO2",
        "reading_type": "co2",
        "rule_type": "time_window",
        "operator": ">=",
        "threshold": 1000.0,
        "window_seconds": 600,
        "enabled": True,
    }

    response = await client.post("/api/v1/rules", json=payload)
    assert response.status_code == 201
    data = response.json()
    assert data["rule_type"] == "time_window"
    assert data["window_seconds"] == 600


@pytest.mark.asyncio
async def test_time_window_rule_requires_window_seconds(client: httpx.AsyncClient):
    payload = {
        "name": "Invalid Time Window Rule",
        "reading_type": "co2",
        "rule_type": "time_window",
        "operator": ">",
        "threshold": 1000.0,
        # Missing window_seconds
    }

    response = await client.post("/api/v1/rules", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_threshold_rule_forbids_window_seconds(client: httpx.AsyncClient):
    payload = {
        "name": "Invalid Threshold Rule",
        "reading_type": "temperature",
        "rule_type": "threshold",
        "operator": ">",
        "threshold": 35.0,
        "window_seconds": 300,  # Not allowed for threshold rule
    }

    response = await client.post("/api/v1/rules", json=payload)
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_list_and_filter_rules(client: httpx.AsyncClient):
    # Create an enabled rule
    await client.post("/api/v1/rules", json={
        "name": "Active Rule",
        "reading_type": "humidity",
        "rule_type": "threshold",
        "operator": ">",
        "threshold": 70.0,
        "enabled": True,
    })

    # Create a disabled rule
    await client.post("/api/v1/rules", json={
        "name": "Inactive Rule",
        "reading_type": "humidity",
        "rule_type": "threshold",
        "operator": "<",
        "threshold": 20.0,
        "enabled": False,
    })

    # List all
    all_res = await client.get("/api/v1/rules")
    assert all_res.status_code == 200
    all_rules = all_res.json()
    assert len(all_rules) >= 2

    # List enabled only
    enabled_res = await client.get("/api/v1/rules?enabled_only=true")
    assert enabled_res.status_code == 200
    enabled_rules = enabled_res.json()
    assert all(r["enabled"] is True for r in enabled_rules)


@pytest.mark.asyncio
async def test_get_and_update_rule(client: httpx.AsyncClient):
    create_res = await client.post("/api/v1/rules", json={
        "name": "Original Rule",
        "reading_type": "noise",
        "rule_type": "threshold",
        "operator": ">",
        "threshold": 80.0,
    })
    rule_id = create_res.json()["id"]

    # Get rule
    get_res = await client.get(f"/api/v1/rules/{rule_id}")
    assert get_res.status_code == 200
    assert get_res.json()["name"] == "Original Rule"

    # Update rule
    update_res = await client.patch(f"/api/v1/rules/{rule_id}", json={
        "name": "Updated Rule Name",
        "threshold": 85.0,
    })
    assert update_res.status_code == 200
    assert update_res.json()["name"] == "Updated Rule Name"
    assert update_res.json()["threshold"] == 85.0

    # Non-existent rule returns 404
    non_existent = str(uuid4())
    assert (await client.get(f"/api/v1/rules/{non_existent}")).status_code == 404


@pytest.mark.asyncio
async def test_enable_disable_rule(client: httpx.AsyncClient):
    create_res = await client.post("/api/v1/rules", json={
        "name": "Toggle Rule",
        "reading_type": "power",
        "rule_type": "threshold",
        "operator": ">",
        "threshold": 500.0,
        "enabled": True,
    })
    rule_id = create_res.json()["id"]

    # Disable
    dis_res = await client.patch(f"/api/v1/rules/{rule_id}/disable")
    assert dis_res.status_code == 200
    assert dis_res.json()["enabled"] is False

    # Enable
    en_res = await client.patch(f"/api/v1/rules/{rule_id}/enable")
    assert en_res.status_code == 200
    assert en_res.json()["enabled"] is True
