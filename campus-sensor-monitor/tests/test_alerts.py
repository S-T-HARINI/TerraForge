from datetime import datetime, timezone
from uuid import uuid4
import httpx
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.alert import Alert
from backend.app.models.alert_rule import AlertRule


async def create_sample_alert(session: AsyncSession, status: str = "open", sensor_id: str = "sensor-lib-01") -> Alert:
    rule = AlertRule(
        name="Test Alert Rule",
        reading_type="temperature",
        rule_type="threshold",
        operator=">",
        threshold=30.0,
        enabled=True,
    )
    session.add(rule)
    await session.flush()

    alert = Alert(
        rule_id=rule.id,
        sensor_id=sensor_id,
        reading_type="temperature",
        message="Temperature exceeds 30C",
        observed_value=32.5,
        status=status,
        triggered_at=datetime.now(timezone.utc),
    )
    session.add(alert)
    await session.commit()
    await session.refresh(alert)
    return alert


@pytest.mark.asyncio
async def test_list_and_filter_alerts(client: httpx.AsyncClient, db_session: AsyncSession):
    alert1 = await create_sample_alert(db_session, status="open", sensor_id="sensor-a")
    alert2 = await create_sample_alert(db_session, status="acknowledged", sensor_id="sensor-b")

    # List all
    res = await client.get("/api/v1/alerts")
    assert res.status_code == 200
    alerts = res.json()
    assert len(alerts) >= 2

    # Filter by status
    res_status = await client.get("/api/v1/alerts?status=open")
    assert res_status.status_code == 200
    assert all(a["status"] == "open" for a in res_status.json())

    # Filter by sensor_id
    res_sensor = await client.get("/api/v1/alerts?sensor_id=sensor-a")
    assert res_sensor.status_code == 200
    assert all(a["sensor_id"] == "sensor-a" for a in res_sensor.json())


@pytest.mark.asyncio
async def test_get_alert_by_id(client: httpx.AsyncClient, db_session: AsyncSession):
    alert = await create_sample_alert(db_session)
    res = await client.get(f"/api/v1/alerts/{alert.id}")
    assert res.status_code == 200
    data = res.json()
    assert data["id"] == str(alert.id)
    assert data["observed_value"] == 32.5

    # Non-existent returns 404
    non_existent = str(uuid4())
    assert (await client.get(f"/api/v1/alerts/{non_existent}")).status_code == 404


@pytest.mark.asyncio
async def test_acknowledge_alert_lifecycle(client: httpx.AsyncClient, db_session: AsyncSession):
    alert = await create_sample_alert(db_session, status="open")

    # Acknowledge
    ack_res = await client.post(
        f"/api/v1/alerts/{alert.id}/acknowledge",
        json={"acknowledged_by": "operator_jane"},
    )
    assert ack_res.status_code == 200
    data = ack_res.json()
    assert data["status"] == "acknowledged"
    assert data["acknowledged_by"] == "operator_jane"
    assert data["acknowledged_at"] is not None

    # Re-acknowledging already acknowledged alert returns 409 Conflict
    conflict_res = await client.post(
        f"/api/v1/alerts/{alert.id}/acknowledge",
        json={"acknowledged_by": "operator_john"},
    )
    assert conflict_res.status_code == 409


@pytest.mark.asyncio
async def test_resolve_alert_lifecycle(client: httpx.AsyncClient, db_session: AsyncSession):
    alert = await create_sample_alert(db_session, status="open")

    # Resolve with note
    res = await client.post(
        f"/api/v1/alerts/{alert.id}/resolve",
        json={
            "resolved_by": "operator_jane",
            "resolution_note": "Replaced faulty HVAC cooling unit.",
        },
    )
    assert res.status_code == 200
    data = res.json()
    assert data["status"] == "resolved"
    assert data["resolved_by"] == "operator_jane"
    assert data["resolved_at"] is not None
    assert data["details"]["resolution_note"] == "Replaced faulty HVAC cooling unit."

    # Resolving already resolved alert returns 409 Conflict
    conflict_res = await client.post(
        f"/api/v1/alerts/{alert.id}/resolve",
        json={"resolved_by": "operator_john"},
    )
    assert conflict_res.status_code == 409


@pytest.mark.asyncio
async def test_acknowledge_and_resolve_non_existent(client: httpx.AsyncClient):
    non_existent = str(uuid4())
    ack_res = await client.post(
        f"/api/v1/alerts/{non_existent}/acknowledge",
        json={"acknowledged_by": "operator_jane"},
    )
    assert ack_res.status_code == 404

    res_res = await client.post(
        f"/api/v1/alerts/{non_existent}/resolve",
        json={"resolved_by": "operator_jane"},
    )
    assert res_res.status_code == 404
