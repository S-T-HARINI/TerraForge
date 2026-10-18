import asyncio
import fnmatch
import os
import sys
from pathlib import Path
from typing import Any, AsyncGenerator

import httpx
import pytest
import pytest_asyncio
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

# Ensure campus-sensor-monitor is in sys.path
project_root = Path(__file__).resolve().parent.parent
if str(project_root) not in sys.path:
    sys.path.insert(0, str(project_root))

from backend.app.core.redis import redis_client
from backend.app.db.base import Base
from backend.app.db.session import get_db
from backend.app.main import app
import backend.app.models  # Register models


class FakeRedis:
    """In-memory Redis mock for unit and integration testing."""

    def __init__(self) -> None:
        self.lists: dict[str, list[str]] = {}
        self.strings: dict[str, str] = {}

    async def rpush(self, name: str, *values: str) -> int:
        if name not in self.lists:
            self.lists[name] = []
        self.lists[name].extend(values)
        return len(self.lists[name])

    async def lpop(self, name: str, count: int | None = None) -> Any:
        items = self.lists.get(name, [])
        if not items:
            return None
        if count is None:
            return items.pop(0)
        popped = items[:count]
        self.lists[name] = items[count:]
        return popped

    async def blpop(self, name: str, timeout: int | None = None) -> tuple[str, str] | None:
        items = self.lists.get(name, [])
        if items:
            return (name, items.pop(0))
        return None

    async def set(
        self,
        name: str,
        value: str,
        ex: int | None = None,
        nx: bool = False,
    ) -> bool:
        if nx and name in self.strings:
            return False
        self.strings[name] = str(value)
        return True

    async def get(self, name: str) -> str | None:
        return self.strings.get(name)

    async def delete(self, *names: str) -> int:
        count = 0
        for name in names:
            if name in self.strings:
                del self.strings[name]
                count += 1
            if name in self.lists:
                del self.lists[name]
                count += 1
        return count

    async def scan(
        self,
        cursor: int = 0,
        match: str | None = None,
        count: int = 10,
    ) -> tuple[int, list[str]]:
        keys = list(self.strings.keys()) + list(self.lists.keys())
        if match:
            keys = [k for k in keys if fnmatch.fnmatch(k, match)]
        return (0, keys)

    async def ping(self) -> bool:
        return True

    async def aclose(self) -> None:
        pass


@pytest.fixture
def fake_redis(monkeypatch: pytest.MonkeyPatch) -> FakeRedis:
    fake = FakeRedis()
    monkeypatch.setattr("backend.app.core.redis.redis_client", fake)
    monkeypatch.setattr("backend.app.services.ingestion_service.redis_client", fake)
    monkeypatch.setattr("backend.app.services.evaluation_service.redis_client", fake)
    monkeypatch.setattr("backend.app.services.window_service.redis_client", fake)
    monkeypatch.setattr("backend.app.workers.reading_worker.redis_client", fake)
    monkeypatch.setattr("backend.app.workers.scheduler.redis_client", fake)
    monkeypatch.setattr("backend.app.api.routes.health.redis_client", fake)
    return fake


@pytest_asyncio.fixture
async def test_db_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///:memory:",
        echo=False,
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)

    yield engine
    await engine.dispose()


@pytest_asyncio.fixture
async def session_factory(test_db_engine):
    return async_sessionmaker(
        bind=test_db_engine,
        class_=AsyncSession,
        expire_on_commit=False,
        autoflush=False,
    )


@pytest_asyncio.fixture
async def db_session(session_factory, monkeypatch: pytest.MonkeyPatch) -> AsyncGenerator[AsyncSession, None]:
    async with session_factory() as session:
        monkeypatch.setattr("backend.app.workers.reading_worker.AsyncSessionLocal", session_factory)
        monkeypatch.setattr("backend.app.api.routes.health.AsyncSessionLocal", session_factory)
        yield session


@pytest_asyncio.fixture
async def client(db_session: AsyncSession, fake_redis: FakeRedis) -> AsyncGenerator[httpx.AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db

    transport = httpx.ASGITransport(app=app)
    async with httpx.AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac

    app.dependency_overrides.clear()
