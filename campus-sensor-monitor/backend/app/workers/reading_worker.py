
import asyncio
import json
import logging

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.core.redis import redis_client
from backend.app.db.session import AsyncSessionLocal
from backend.app.schemas.reading import SensorReadingCreate
from backend.app.services.evaluation_service import EvaluationService
from backend.app.services.ingestion_service import IngestionService
from backend.app.services.window_service import WindowService

logger = logging.getLogger(__name__)


async def process_batch(
    session: AsyncSession,
    payloads: list[str],
) -> int:
    readings = [
        SensorReadingCreate.model_validate_json(payload)
        for payload in payloads
    ]

    ingestion = IngestionService(session)
    evaluation = EvaluationService(session)
    window_service = WindowService(session)

    try:
        accepted = await ingestion.reading_repository.create_many(readings)

        for reading in readings:
            await evaluation.evaluate_reading(reading)
            await window_service.evaluate_reading(reading)

        await session.commit()
        return accepted
    except Exception:
        await session.rollback()
        raise


async def run_worker() -> None:
    queue_name = settings.reading_queue_name
    batch_size = settings.worker_batch_size

    logger.info("TerraForge reading worker started")

    while True:
        first_item = await redis_client.blpop(
            queue_name,
            timeout=settings.worker_block_ms // 1000,
        )

        if first_item is None:
            continue

        payloads = [first_item[1]]

        while len(payloads) < batch_size:
            item = await redis_client.lpop(queue_name)
            if item is None:
                break
            payloads.append(item)

        try:
            async with AsyncSessionLocal() as session:
                await process_batch(session, payloads)
            logger.info("Processed %s sensor readings", len(payloads))
        except Exception:
            logger.exception(
                "Failed to process a batch of %s readings",
                len(payloads),
            )
            # Requeue failed items rather than silently discarding them.
            await redis_client.rpush(queue_name, *payloads)
            await asyncio.sleep(1)


async def main() -> None:
    logging.basicConfig(level=settings.log_level)
    try:
        await run_worker()
    finally:
        await redis_client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
