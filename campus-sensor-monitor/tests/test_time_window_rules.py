from datetime import datetime, timedelta, timezone
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.alert_rule import AlertRule
from backend.app.repositories.reading_repository import ReadingRepository
from backend.app.schemas.reading import SensorReadingCreate
from backend.app.services.window_service import WindowService
from tests.conftest import FakeRedis


@pytest.mark.asyncio
async def test_time_window_rolling_average_breach(db_session: AsyncSession, fake_redis: FakeRedis):
    rule = AlertRule(
        name="10-Minute Average CO2 High",
        reading_type="co2",
        rule_type="time_window",
        operator=">",
        threshold=1000.0,
        window_seconds=600,
        enabled=True,
    )
    db_session.add(rule)
    await db_session.commit()

    now = datetime.now(timezone.utc)
    repository = ReadingRepository(db_session)

    # Insert 3 historical readings: 1100, 1200, 1300 -> avg = 1200
    readings = [
        SensorReadingCreate(
            sensorId="sensor-lab-01",
            type="co2",
            value=1100.0,
            timestamp=now - timedelta(minutes=5),
        ),
        SensorReadingCreate(
            sensorId="sensor-lab-01",
            type="co2",
            value=1200.0,
            timestamp=now - timedelta(minutes=3),
        ),
        SensorReadingCreate(
            sensorId="sensor-lab-01",
            type="co2",
            value=1300.0,
            timestamp=now,
        ),
    ]
    await repository.create_many(readings)

    window_service = WindowService(db_session)
    alerts = await window_service.evaluate_reading(readings[-1])

    assert len(alerts) == 1
    alert = alerts[0]
    assert alert.rule_id == rule.id
    assert alert.observed_value == 1200.0
    assert alert.details["reading_count"] == 3
    assert alert.details["rule_type"] == "time_window"
    assert alert.details["threshold"] == 1000.0


@pytest.mark.asyncio
async def test_time_window_average_below_threshold(db_session: AsyncSession, fake_redis: FakeRedis):
    rule = AlertRule(
        name="10-Minute Average CO2 High",
        reading_type="co2",
        rule_type="time_window",
        operator=">",
        threshold=1000.0,
        window_seconds=600,
        enabled=True,
    )
    db_session.add(rule)
    await db_session.commit()

    now = datetime.now(timezone.utc)
    repository = ReadingRepository(db_session)

    # Insert readings with average 600 (< 1000)
    readings = [
        SensorReadingCreate(
            sensorId="sensor-lab-01",
            type="co2",
            value=500.0,
            timestamp=now - timedelta(minutes=4),
        ),
        SensorReadingCreate(
            sensorId="sensor-lab-01",
            type="co2",
            value=700.0,
            timestamp=now,
        ),
    ]
    await repository.create_many(readings)

    window_service = WindowService(db_session)
    alerts = await window_service.evaluate_reading(readings[-1])
    assert len(alerts) == 0


@pytest.mark.asyncio
async def test_time_window_deduplication(db_session: AsyncSession, fake_redis: FakeRedis):
    rule = AlertRule(
        name="5-Minute High Temperature Window",
        reading_type="temperature",
        rule_type="time_window",
        operator=">=",
        threshold=30.0,
        window_seconds=300,
        enabled=True,
    )
    db_session.add(rule)
    await db_session.commit()

    now = datetime.now(timezone.utc)
    repository = ReadingRepository(db_session)

    r1 = SensorReadingCreate(
        sensorId="sensor-hvac-01",
        type="temperature",
        value=32.0,
        timestamp=now - timedelta(minutes=2),
    )
    r2 = SensorReadingCreate(
        sensorId="sensor-hvac-01",
        type="temperature",
        value=34.0,
        timestamp=now,
    )
    await repository.create_many([r1, r2])

    window_service = WindowService(db_session)
    alerts1 = await window_service.evaluate_reading(r2)
    assert len(alerts1) == 1

    # Next reading in same window should be deduplicated
    r3 = SensorReadingCreate(
        sensorId="sensor-hvac-01",
        type="temperature",
        value=35.0,
        timestamp=now + timedelta(seconds=10),
    )
    await repository.create_many([r3])
    alerts2 = await window_service.evaluate_reading(r3)
    assert len(alerts2) == 0
