import asyncio
import logging

from backend.app.config import settings
from backend.app.core.redis import redis_client

logger = logging.getLogger(__name__)

DEDUPLICATION_PREFIX = "terraforge:alert:dedup:"


async def count_deduplication_keys() -> int:
    """Count active deduplication keys; Redis expires them automatically via TTL."""
    count = 0
    cursor = 0

    while True:
        try:
            cursor, keys = await redis_client.scan(
                cursor=cursor,
                match=f"{DEDUPLICATION_PREFIX}*",
                count=500,
            )
            count += len(keys)
            if cursor == 0:
                break
        except Exception as exc:
            logger.warning("Redis scan error in scheduler: %s", exc)
            break

    return count


async def run_scheduler(stop_event: asyncio.Event | None = None) -> None:
    interval = max(settings.alert_deduplication_seconds, 60)
    logger.info("TerraForge scheduler started; interval=%s seconds", interval)

    while stop_event is None or not stop_event.is_set():
        try:
            count = await count_deduplication_keys()
            logger.debug("Found %s alert deduplication keys in Redis", count)
        except Exception:
            logger.exception("Scheduler maintenance failed")

        try:
            if stop_event is not None:
                try:
                    await asyncio.wait_for(stop_event.wait(), timeout=interval)
                    break
                except asyncio.TimeoutError:
                    pass
            else:
                await asyncio.sleep(interval)
        except asyncio.CancelledError:
            break


async def main() -> None:
    from backend.app.core.logging import setup_logging
    setup_logging()
    try:
        await run_scheduler()
    finally:
        await redis_client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
