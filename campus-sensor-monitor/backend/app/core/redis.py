import asyncio
import logging
from typing import Any

import redis.asyncio as redis

from backend.app.config import settings

logger = logging.getLogger(__name__)


class RedisProxy:
    """Async Redis client proxy that stays bound to the current running event loop."""

    def __init__(self) -> None:
        self._client: redis.Redis | None = None
        self._loop: asyncio.AbstractEventLoop | None = None

    def get_client(self) -> redis.Redis:
        try:
            current_loop = asyncio.get_running_loop()
        except RuntimeError:
            current_loop = None

        if self._client is None or (
            current_loop is not None and self._loop != current_loop
        ):
            self._client = redis.from_url(
                settings.redis_url,
                decode_responses=True,
            )
            self._loop = current_loop
        return self._client

    def __getattr__(self, name: str) -> Any:
        return getattr(self.get_client(), name)

    async def aclose(self) -> None:
        if self._client is not None:
            try:
                await self._client.aclose()
            except Exception as exc:
                logger.warning("Error while closing Redis client: %s", exc)
            finally:
                self._client = None
                self._loop = None


redis_client = RedisProxy()


async def get_redis_client() -> redis.Redis:
    return redis_client.get_client()


async def close_redis() -> None:
    await redis_client.aclose()
