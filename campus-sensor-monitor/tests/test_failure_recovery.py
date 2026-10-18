from datetime import datetime, timezone
import json
import pytest
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.models.alert import Alert
from backend.app.models.alert_rule import AlertRule
from backend.app.repositories.alert_repository import AlertRepository
from backend.app.workers.reading_worker import process_batch
from tests.conftest import FakeRedis


@pytest.mark.asyncio
async def test_transaction_failure_releases_dedup_keys(
    db_session: AsyncSession,
    fake_redis: FakeRedis,
    monkeypatch: pytest.MonkeyPatch,
):
    """
    Verify that if a database transaction fails and rolls back,
    any deduplication keys reserved during that batch are deleted,
    preventing silent alert suppression upon batch retry.
    """
    rule = AlertRule(
        name="Critical Temp Alert",
        reading_type="temperature",
        rule_type="threshold",
        operator=">",
        threshold=40.0,
        enabled=True,
    )
    db_session.add(rule)
    await db_session.commit()

    now = datetime.now(timezone.utc).isoformat()
    valid_payload = json.dumps({
        "sensorId": "sensor-boiler-01",
        "type": "temperature",
        "value": 45.0,
        "timestamp": now,
    })

    # Simulate database commit failure on first attempt
    original_commit = db_session.commit
    async def failing_commit():
        raise RuntimeError("Database connection lost during commit")

    monkeypatch.setattr(db_session, "commit", failing_commit)

    dedup_key = f"terraforge:alert:dedup:{rule.id}:sensor-boiler-01"

    # Attempt 1: Expect exception due to commit failure
    with pytest.raises(RuntimeError, match="Database connection lost"):
        await process_batch(db_session, [valid_payload])

    # Assert deduplication key was NOT left behind in Redis
    assert await fake_redis.get(dedup_key) is None

    # Attempt 2: Restore normal commit (retry)
    monkeypatch.setattr(db_session, "commit", original_commit)
    accepted = await process_batch(db_session, [valid_payload])
    assert accepted == 1

    # Verify alert was successfully persisted and not silently suppressed!
    alert_repo = AlertRepository(db_session)
    alerts = await alert_repo.list_alerts(sensor_id="sensor-boiler-01")
    assert len(alerts) == 1
    assert alerts[0].observed_value == 45.0
    assert alerts[0].status == "open"


@pytest.mark.asyncio
async def test_dead_letter_queue_for_malformed_payload(
    db_session: AsyncSession,
    fake_redis: FakeRedis,
):
    """
    Verify that malformed JSON payloads are routed to the DLQ
    while valid payloads in the same batch are successfully accepted.
    """
    now = datetime.now(timezone.utc).isoformat()
    valid_payload = json.dumps({
        "sensorId": "sensor-good-01",
        "type": "humidity",
        "value": 55.0,
        "timestamp": now,
    })
    malformed_payload = "NOT_A_VALID_JSON_STRING{{{{"

    batch = [valid_payload, malformed_payload]
    accepted = await process_batch(db_session, batch)

    assert accepted == 1

    # Verify dead letter queue contains the malformed payload
    dlq_name = f"{settings.reading_queue_name}:dead_letter"
    dlq_items = fake_redis.lists.get(dlq_name, [])
    assert len(dlq_items) == 1
    assert dlq_items[0] == malformed_payload
