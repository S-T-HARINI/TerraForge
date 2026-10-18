import asyncio
import json
import logging
from typing import Sequence

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.core.redis import redis_client
from backend.app.db.session import AsyncSessionLocal
from backend.app.repositories.reading_repository import ReadingRepository
from backend.app.repositories.rule_repository import RuleRepository
from backend.app.schemas.reading import SensorReadingCreate
from backend.app.services.evaluation_service import EvaluationService
from backend.app.services.window_service import WindowService

logger = logging.getLogger(__name__)


async def process_batch(session: AsyncSession, payloads: Sequence[str]) -> int:
    valid_readings: list[SensorReadingCreate] = []
    dead_letter_payloads: list[str] = []

    for payload in payloads:
        try:
            reading = SensorReadingCreate.model_validate_json(payload)
            valid_readings.append(reading)
        except (ValidationError, json.JSONDecodeError) as exc:
            logger.error("Malformed sensor reading payload discarded: %s; error: %s", payload, exc)
            dead_letter_payloads.append(payload)

    if dead_letter_payloads:
        try:
            dlq_name = f"{settings.reading_queue_name}:dead_letter"
            await redis_client.rpush(dlq_name, *dead_letter_payloads)
        except Exception as dlq_exc:
            logger.warning("Failed to store dead letter payloads: %s", dlq_exc)

    if not valid_readings:
        return 0

    evaluation = EvaluationService(session)
    window_service = WindowService(session)
    rule_repository = RuleRepository(session)
    acquired_dedup_keys: list[str] = []

    try:
        repository = ReadingRepository(session)
        accepted = await repository.create_many(valid_readings)

        # Preload active rules once per batch for high throughput
        active_rules = await rule_repository.list_all(enabled_only=True, limit=10000)

        for reading in valid_readings:
            await evaluation.evaluate_reading(
                reading,
                acquired_dedup_keys=acquired_dedup_keys,
                rules=active_rules,
            )
            await window_service.evaluate_reading(
                reading,
                acquired_dedup_keys=acquired_dedup_keys,
                rules=active_rules,
            )

        await session.commit()
        return accepted
    except Exception:
        await session.rollback()
        if acquired_dedup_keys:
            try:
                await redis_client.delete(*acquired_dedup_keys)
            except Exception as cleanup_exc:
                logger.warning(
                    "Failed to release deduplication keys after transaction rollback: %s",
                    cleanup_exc,
                )
        raise


async def run_worker(stop_event: asyncio.Event | None = None) -> None:
    queue_name = settings.reading_queue_name
    batch_size = settings.worker_batch_size
    timeout = max(1, settings.worker_block_ms // 1000)

    logger.info("TerraForge reading worker started; listening on %s", queue_name)

    while stop_event is None or not stop_event.is_set():
        try:
            item = await redis_client.blpop(queue_name, timeout=timeout)
        except asyncio.CancelledError:
            break
        except Exception as exc:
            logger.warning("Error waiting for readings from Redis queue: %s", exc)
            await asyncio.sleep(1)
            continue

        if item is None:
            continue

        payloads = [item[1]]

        try:
            remaining = batch_size - 1
            if remaining > 0:
                additional = await redis_client.lpop(queue_name, remaining)
                if additional:
                    if isinstance(additional, list):
                        payloads.extend(additional)
                    else:
                        payloads.append(additional)
        except Exception as exc:
            logger.warning("Error fetching batch from Redis queue: %s", exc)

        try:
            async with AsyncSessionLocal() as session:
                accepted = await process_batch(session, payloads)
            logger.info("Processed %s sensor readings (%s accepted)", len(payloads), accepted)
        except asyncio.CancelledError:
            await redis_client.rpush(queue_name, *payloads)
            raise
        except Exception:
            logger.exception("Failed to process a batch of %s readings; re-enqueuing", len(payloads))
            try:
                await redis_client.rpush(queue_name, *payloads)
            except Exception as re_enqueue_exc:
                logger.error("Failed to re-enqueue batch to Redis: %s", re_enqueue_exc)
            await asyncio.sleep(1)


async def main() -> None:
    from backend.app.core.logging import setup_logging
    setup_logging()
    try:
        await run_worker()
    finally:
        await redis_client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
