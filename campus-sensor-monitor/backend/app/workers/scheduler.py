
import asyncio
import logging

from backend.app.config import settings
from backend.app.core.redis import redis_client

logger = logging.getLogger(__name__)

DEDUPLICATION_PREFIX = "terraforge:alert:dedup:"


async def cleanup_expired_keys() -> int:
    """Count remaining deduplication keys; Redis expires them automatically."""
    count = 0
    cursor = 0

    while True:
        cursor, keys = await redis_client.scan(
            cursor=cursor,
            match=f"{DEDUPLICATION_PREFIX}*",
            count=500,
        )
        count += len(keys)
        if cursor == 0:
            break

    return count


async def run_scheduler() -> None:
    interval = max(settings.alert_deduplication_seconds, 60)

    logger.info("TerraForge scheduler started; interval=%s seconds", interval)

    while True:
        try:
            count = await cleanup_expired_keys()
            logger.debug("Found %s alert deduplication keys", count)
        except Exception:
            logger.exception("Scheduler maintenance failed")

        await asyncio.sleep(interval)


async def main() -> None:
    logging.basicConfig(level=settings.log_level)
    try:
        await run_scheduler()
    finally:
        await redis_client.aclose()


if __name__ == "__main__":
    asyncio.run(main())
