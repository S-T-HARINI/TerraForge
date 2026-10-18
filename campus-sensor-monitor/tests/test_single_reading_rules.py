from datetime import datetime, timezone
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.alert_rule import AlertRule
from backend.app.schemas.reading import SensorReadingCreate
from backend.app.services.evaluation_service import EvaluationService
from tests.conftest import FakeRedis


@pytest.mark.asyncio
async def test_threshold_rule_triggers_alert(db_session: AsyncSession, fake_redis: FakeRedis):
    rule = AlertRule(
        name="High Temp Warning",
        reading_type="temperature",
        rule_type="threshold",
        operator=">",
        threshold=30.0,
        enabled=True,
    )
    db_session.add(rule)
    await db_session.commit()

    evaluation = EvaluationService(db_session)
    reading = SensorReadingCreate(
        sensorId="sensor-lib-01",
        type="temperature",
        value=32.5,
        timestamp=datetime.now(timezone.utc),
    )

    alerts = await evaluation.evaluate_reading(reading)
    assert len(alerts) == 1
    assert alerts[0].rule_id == rule.id
    assert alerts[0].observed_value == 32.5
    assert alerts[0].sensor_id == "sensor-lib-01"
    assert alerts[0].status == "open"


@pytest.mark.asyncio
async def test_threshold_rule_below_threshold_no_alert(db_session: AsyncSession, fake_redis: FakeRedis):
    rule = AlertRule(
        name="High Temp Warning",
        reading_type="temperature",
        rule_type="threshold",
        operator=">",
        threshold=30.0,
        enabled=True,
    )
    db_session.add(rule)
    await db_session.commit()

    evaluation = EvaluationService(db_session)
    reading = SensorReadingCreate(
        sensorId="sensor-lib-01",
        type="temperature",
        value=28.0,
        timestamp=datetime.now(timezone.utc),
    )

    alerts = await evaluation.evaluate_reading(reading)
    assert len(alerts) == 0


@pytest.mark.asyncio
async def test_threshold_rule_deduplication(db_session: AsyncSession, fake_redis: FakeRedis):
    rule = AlertRule(
        name="Noise Spike Alert",
        reading_type="noise",
        rule_type="threshold",
        operator=">=",
        threshold=80.0,
        enabled=True,
    )
    db_session.add(rule)
    await db_session.commit()

    evaluation = EvaluationService(db_session)
    now = datetime.now(timezone.utc)

    reading1 = SensorReadingCreate(
        sensorId="sensor-hall-01",
        type="noise",
        value=85.0,
        timestamp=now,
    )

    # First alert generated
    alerts1 = await evaluation.evaluate_reading(reading1)
    assert len(alerts1) == 1

    # Second reading for same sensor and rule is deduplicated
    reading2 = SensorReadingCreate(
        sensorId="sensor-hall-01",
        type="noise",
        value=87.0,
        timestamp=now,
    )
    alerts2 = await evaluation.evaluate_reading(reading2)
    assert len(alerts2) == 0

    # Different sensor triggers alert
    reading3 = SensorReadingCreate(
        sensorId="sensor-hall-02",
        type="noise",
        value=90.0,
        timestamp=now,
    )
    alerts3 = await evaluation.evaluate_reading(reading3)
    assert len(alerts3) == 1


@pytest.mark.asyncio
async def test_disabled_rule_ignored(db_session: AsyncSession, fake_redis: FakeRedis):
    rule = AlertRule(
        name="Disabled Humidity Rule",
        reading_type="humidity",
        rule_type="threshold",
        operator=">",
        threshold=50.0,
        enabled=False,
    )
    db_session.add(rule)
    await db_session.commit()

    evaluation = EvaluationService(db_session)
    reading = SensorReadingCreate(
        sensorId="sensor-dorm-01",
        type="humidity",
        value=75.0,
        timestamp=datetime.now(timezone.utc),
    )

    alerts = await evaluation.evaluate_reading(reading)
    assert len(alerts) == 0


@pytest.mark.asyncio
async def test_sensor_specific_rule_filtering(db_session: AsyncSession, fake_redis: FakeRedis):
    rule = AlertRule(
        name="Server Room Only Temp",
        sensor_id="sensor-server-room",
        reading_type="temperature",
        rule_type="threshold",
        operator=">",
        threshold=25.0,
        enabled=True,
    )
    db_session.add(rule)
    await db_session.commit()

    evaluation = EvaluationService(db_session)

    # Different sensor - does not match
    reading_other = SensorReadingCreate(
        sensorId="sensor-cafeteria",
        type="temperature",
        value=30.0,
        timestamp=datetime.now(timezone.utc),
    )
    assert len(await evaluation.evaluate_reading(reading_other)) == 0

    # Target sensor - matches
    reading_target = SensorReadingCreate(
        sensorId="sensor-server-room",
        type="temperature",
        value=28.0,
        timestamp=datetime.now(timezone.utc),
    )
    alerts = await evaluation.evaluate_reading(reading_target)
    assert len(alerts) == 1
    assert alerts[0].sensor_id == "sensor-server-room"
