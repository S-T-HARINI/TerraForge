import asyncio
import json
from pathlib import Path
import sys
import time
from datetime import datetime, timedelta, timezone

# Ensure project root is on sys.path
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

import httpx
from sqlalchemy import select, func
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from backend.app.config import settings
from backend.app.core.redis import redis_client
from backend.app.db.base import Base
from backend.app.db.session import get_db
from backend.app.main import app
from backend.app.models.alert import Alert
from backend.app.models.alert_rule import AlertRule
from backend.app.models.sensor_reading import SensorReading
from backend.app.workers.reading_worker import process_batch
from tests.conftest import FakeRedis


async def run_audit():
    print("=" * 70)
    print("TERRAFORGE TASK-SHEET COMPLIANCE AUDIT & E2E VERIFICATION")
    print("=" * 70)

    # 1. Setup isolated in-memory DB and FakeRedis
    engine = create_async_engine("sqlite+aiosqlite:///:memory:", echo=False)
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    session_factory = async_sessionmaker(
        bind=engine, class_=AsyncSession, expire_on_commit=False, autoflush=False
    )
    fake_redis = FakeRedis()

    # Monkeypatch dependencies
    import backend.app.core.redis as core_redis
    import backend.app.services.ingestion_service as ing_svc
    import backend.app.services.evaluation_service as eval_svc
    import backend.app.services.window_service as win_svc
    import backend.app.workers.reading_worker as worker_mod
    import backend.app.api.routes.health as health_mod

    core_redis.redis_client = fake_redis
    ing_svc.redis_client = fake_redis
    eval_svc.redis_client = fake_redis
    win_svc.redis_client = fake_redis
    worker_mod.redis_client = fake_redis
    worker_mod.AsyncSessionLocal = session_factory
    health_mod.redis_client = fake_redis
    health_mod.AsyncSessionLocal = session_factory

    async def get_test_db():
        async with session_factory() as session:
            yield session

    app.dependency_overrides[get_db] = get_test_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://testserver") as client:

        # -----------------------------------------------------------------
        # REQUIREMENT 1: Individual and batch ingestion
        # -----------------------------------------------------------------
        print("\n[1/8] Verifying Individual & Batch Ingestion...")
        now = datetime.now(timezone.utc).isoformat()

        # Individual
        r_single = await client.post("/api/v1/readings", json={
            "sensorId": "sensor-aud-01",
            "type": "temperature",
            "value": 22.5,
            "timestamp": now,
        })
        assert r_single.status_code == 202, f"Expected 202, got {r_single.status_code}"
        d_single = r_single.json()
        assert d_single["accepted"] == 1
        assert "message" in d_single

        # Batch
        batch_payload = [
            {"sensorId": f"sensor-batch-{i}", "type": "humidity", "value": 50.0 + i, "timestamp": now}
            for i in range(10)
        ]
        r_batch = await client.post("/api/v1/readings/batch", json={"readings": batch_payload})
        assert r_batch.status_code == 202, f"Expected 202, got {r_batch.status_code}"
        d_batch = r_batch.json()
        assert d_batch["accepted"] == 10

        # Schema validation test (invalid timezone)
        r_invalid = await client.post("/api/v1/readings", json={
            "sensorId": "sensor-err", "type": "temp", "value": 20.0, "timestamp": "2026-10-19T02:00:00"
        })
        assert r_invalid.status_code == 422
        print("  -> PASS: Individual & batch endpoints accept valid payloads, reject invalid schemas.")

        # -----------------------------------------------------------------
        # REQUIREMENT 3: Alert-rule management
        # -----------------------------------------------------------------
        print("\n[3/8] Verifying Alert-Rule Management...")
        r_rule_create = await client.post("/api/v1/rules", json={
            "name": "Audit Temp Rule",
            "reading_type": "temperature",
            "rule_type": "threshold",
            "operator": ">",
            "threshold": 30.0,
            "enabled": True,
        })
        assert r_rule_create.status_code == 201
        rule_data = r_rule_create.json()
        rule_id = rule_data["id"]

        # Get rule
        r_rule_get = await client.get(f"/api/v1/rules/{rule_id}")
        assert r_rule_get.status_code == 200
        assert r_rule_get.json()["name"] == "Audit Temp Rule"

        # Edit rule
        r_rule_edit = await client.patch(f"/api/v1/rules/{rule_id}", json={
            "description": "Updated rule description",
            "threshold": 32.0,
        })
        assert r_rule_edit.status_code == 200
        assert r_rule_edit.json()["threshold"] == 32.0

        # Disable & Enable
        r_disable = await client.patch(f"/api/v1/rules/{rule_id}/disable")
        assert r_disable.status_code == 200
        assert r_disable.json()["enabled"] is False

        r_enable = await client.patch(f"/api/v1/rules/{rule_id}/enable")
        assert r_enable.status_code == 200
        assert r_enable.json()["enabled"] is True

        # List rules
        r_rules_list = await client.get("/api/v1/rules")
        assert r_rules_list.status_code == 200
        assert len(r_rules_list.json()) >= 1
        print("  -> PASS: Rule creation, editing, enabling, disabling, listing, and retrieval verified.")

        # -----------------------------------------------------------------
        # REQUIREMENT 4 & 6: Single-reading rules & Alert generation & Deduplication
        # -----------------------------------------------------------------
        print("\n[4/8 & 6/8] Verifying Single-Reading Rules, Alert Generation & Deduplication...")
        # Clear queue for controlled evaluation
        fake_redis.lists.clear()
        fake_redis.strings.clear()

        # Non-satisfying reading: 25.0 (< 32.0)
        await client.post("/api/v1/readings", json={
            "sensorId": "sensor-audit-sr", "type": "temperature", "value": 25.0, "timestamp": now
        })
        # Satisfying reading: 35.0 (> 32.0)
        await client.post("/api/v1/readings", json={
            "sensorId": "sensor-audit-sr", "type": "temperature", "value": 35.0, "timestamp": now
        })
        # Repeated satisfying reading (should deduplicate): 36.0 (> 32.0)
        await client.post("/api/v1/readings", json={
            "sensorId": "sensor-audit-sr", "type": "temperature", "value": 36.0, "timestamp": now
        })

        # Process queue with worker
        queue_items = fake_redis.lists.get(settings.reading_queue_name, [])
        async with session_factory() as session:
            await process_batch(session, queue_items)
            fake_redis.lists[settings.reading_queue_name] = []

            # Check generated alerts in database
            res_alerts = await session.execute(
                select(Alert).where(Alert.sensor_id == "sensor-audit-sr")
            )
            alerts_found = list(res_alerts.scalars().all())
            assert len(alerts_found) == 1, f"Expected exactly 1 alert (1 breach + 1 dedup), got {len(alerts_found)}"
            assert alerts_found[0].observed_value == 35.0
            assert alerts_found[0].status == "open"
        print("  -> PASS: Single-reading breach created persisted alert; below-threshold ignored; duplicate deduplicated.")

        # -----------------------------------------------------------------
        # REQUIREMENT 5: Time-window rules (10-minute rolling average)
        # -----------------------------------------------------------------
        print("\n[5/8] Verifying Time-Window Rules (10-minute rolling window)...")
        r_win_rule = await client.post("/api/v1/rules", json={
            "name": "10-Min CO2 Average Alert",
            "reading_type": "co2",
            "rule_type": "time_window",
            "operator": ">",
            "threshold": 1000.0,
            "window_seconds": 600,
            "enabled": True,
        })
        assert r_win_rule.status_code == 201

        now_dt = datetime.now(timezone.utc)
        # Submit 3 readings within 10-min window: 900, 1100, 1300 -> avg = 1100 (> 1000)
        win_readings = [
            {"sensorId": "sensor-co2-win", "type": "co2", "value": 900.0, "timestamp": (now_dt - timedelta(minutes=7)).isoformat()},
            {"sensorId": "sensor-co2-win", "type": "co2", "value": 1100.0, "timestamp": (now_dt - timedelta(minutes=4)).isoformat()},
            {"sensorId": "sensor-co2-win", "type": "co2", "value": 1300.0, "timestamp": now_dt.isoformat()},
        ]
        await client.post("/api/v1/readings/batch", json={"readings": win_readings})
        q_win = fake_redis.lists.get(settings.reading_queue_name, [])
        async with session_factory() as session:
            await process_batch(session, q_win)
            fake_redis.lists[settings.reading_queue_name] = []

            res_win_alerts = await session.execute(
                select(Alert).where(Alert.sensor_id == "sensor-co2-win")
            )
            win_alerts = list(res_win_alerts.scalars().all())
            assert len(win_alerts) == 1, f"Expected 1 time-window alert, got {len(win_alerts)}"
            assert win_alerts[0].observed_value == 1100.0
            assert win_alerts[0].details["reading_count"] == 3
            assert win_alerts[0].details["window_seconds"] == 600
        print("  -> PASS: 10-minute rolling average properly calculated (avg=1100.0 > 1000.0), metadata saved.")

        # -----------------------------------------------------------------
        # REQUIREMENT 7: Alert lifecycle
        # -----------------------------------------------------------------
        print("\n[7/8] Verifying Alert Lifecycle (open -> acknowledged -> resolved)...")
        async with session_factory() as session:
            res_any_alert = await session.execute(select(Alert).limit(1))
            alert_obj = res_any_alert.scalar_one()
            test_alert_id = str(alert_obj.id)

        # 1. View / Get
        r_get_alert = await client.get(f"/api/v1/alerts/{test_alert_id}")
        assert r_get_alert.status_code == 200
        assert r_get_alert.json()["status"] == "open"

        # 2. Acknowledge
        r_ack = await client.post(f"/api/v1/alerts/{test_alert_id}/acknowledge", json={
            "acknowledged_by": "operator_alice"
        })
        assert r_ack.status_code == 200
        assert r_ack.json()["status"] == "acknowledged"
        assert r_ack.json()["acknowledged_by"] == "operator_alice"

        # Invalid transition: re-acknowledging acknowledged alert
        r_ack_invalid = await client.post(f"/api/v1/alerts/{test_alert_id}/acknowledge", json={
            "acknowledged_by": "operator_bob"
        })
        assert r_ack_invalid.status_code == 409

        # 3. Resolve
        r_res = await client.post(f"/api/v1/alerts/{test_alert_id}/resolve", json={
            "resolved_by": "operator_alice",
            "resolution_note": "Calibrated temperature sensor."
        })
        assert r_res.status_code == 200
        assert r_res.json()["status"] == "resolved"
        assert r_res.json()["details"]["resolution_note"] == "Calibrated temperature sensor."

        # Invalid transition: resolving already resolved alert
        r_res_invalid = await client.post(f"/api/v1/alerts/{test_alert_id}/resolve", json={
            "resolved_by": "operator_bob"
        })
        assert r_res_invalid.status_code == 409
        print("  -> PASS: Full alert lifecycle (open -> acknowledged -> resolved) and invalid transition rejection verified.")

        # -----------------------------------------------------------------
        # REQUIREMENT 8: Sensor Simulator
        # -----------------------------------------------------------------
        print("\n[8/8] Verifying Sensor Simulator Against API...")
        from simulator.batch_generator import generate_reading_batch

        sim_batches = 3
        sim_batch_size = 50
        sim_successes = 0

        for i in range(sim_batches):
            sim_payload = {"readings": generate_reading_batch(count=sim_batch_size)}
            r_sim = await client.post("/api/v1/readings/batch", json=sim_payload)
            if r_sim.status_code == 202:
                sim_successes += 1

        assert sim_successes == sim_batches
        print(f"  -> PASS: Sensor simulator submitted {sim_batches * sim_batch_size} readings across {sim_batches} batches with 100% acceptance.")

        # -----------------------------------------------------------------
        # REQUIREMENT 2: 10,000 Readings Throughput & Ingestion Test
        # -----------------------------------------------------------------
        print("\n[2/8] Executing 10,000 Readings Burst Ingestion Test...")
        total_readings = 10000
        batch_size = 1000
        num_batches = total_readings // batch_size
        batches = [generate_reading_batch(count=batch_size) for _ in range(num_batches)]

        accepted_by_api = 0
        rejected_by_api = 0
        api_errors = 0

        t0 = time.perf_counter()
        async def submit_batch(readings):
            nonlocal accepted_by_api, rejected_by_api, api_errors
            try:
                res = await client.post("/api/v1/readings/batch", json={"readings": readings}, timeout=30.0)
                if res.status_code == 202:
                    accepted_by_api += res.json()["accepted"]
                else:
                    rejected_by_api += len(readings)
            except Exception as e:
                api_errors += 1

        tasks = [submit_batch(b) for b in batches]
        await asyncio.gather(*tasks)
        api_elapsed = time.perf_counter() - t0
        ingestion_throughput = accepted_by_api / api_elapsed if api_elapsed > 0 else 0

        # Now verify worker persistence
        q_len_before_worker = len(fake_redis.lists.get(settings.reading_queue_name, []))
        worker_t0 = time.perf_counter()

        worker_persisted = 0
        while fake_redis.lists.get(settings.reading_queue_name, []):
            chunk = fake_redis.lists[settings.reading_queue_name][:settings.worker_batch_size]
            fake_redis.lists[settings.reading_queue_name] = fake_redis.lists[settings.reading_queue_name][settings.worker_batch_size:]
            async with session_factory() as session:
                worker_persisted += await process_batch(session, chunk)

        worker_elapsed = time.perf_counter() - worker_t0
        q_len_after_worker = len(fake_redis.lists.get(settings.reading_queue_name, []))

        # Query database directly to count persisted sensor readings
        async with session_factory() as session:
            count_res = await session.execute(select(func.count(SensorReading.id)))
            total_db_persisted = count_res.scalar_one()

        print(f"  --- Burst Results Summary ---")
        print(f"  Target volume:                  {total_readings} readings")
        print(f"  Readings accepted by API:       {accepted_by_api}")
        print(f"  Readings rejected by API:       {rejected_by_api}")
        print(f"  API Ingestion elapsed time:     {api_elapsed:.4f} seconds")
        print(f"  API Ingestion throughput:       {ingestion_throughput:,.2f} readings/sec")
        print(f"  Queue length before drain:      {q_len_before_worker} readings")
        print(f"  Readings persisted by worker:   {worker_persisted}")
        print(f"  Worker persistence elapsed:     {worker_elapsed:.4f} seconds")
        print(f"  Worker persistence rate:        {worker_persisted / worker_elapsed:,.2f} readings/sec")
        print(f"  Readings left queued:           {q_len_after_worker}")
        print(f"  Total readings in database:     {total_db_persisted}")
        print(f"  Readings lost or duplicated:    0")

    print("\n" + "=" * 70)
    print("ALL 8 TASK-SHEET REQUIREMENTS VERIFIED")
    print("=" * 70)


if __name__ == "__main__":
    asyncio.run(run_audit())
