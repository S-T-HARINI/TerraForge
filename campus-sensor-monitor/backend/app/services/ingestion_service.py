
from collections.abc import Sequence

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.repositories.reading_repository import ReadingRepository
from backend.app.schemas.reading import SensorReadingCreate


class IngestionService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.reading_repository = ReadingRepository(session)

    async def ingest_reading(self, reading: SensorReadingCreate) -> int:
        return await self.ingest_batch([reading])

    async def ingest_batch(
        self,
        readings: Sequence[SensorReadingCreate],
    ) -> int:
        if not readings:
            return 0

        try:
            accepted = await self.reading_repository.create_many(readings)
            await self.session.commit()
            return accepted
        except Exception:
            await self.session.rollback()
            raise
