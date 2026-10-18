from backend.app.config import settings
from backend.app.core.redis import redis_client
from backend.app.schemas.reading import SensorReadingCreate


class IngestionService:
    async def ingest(self, reading: SensorReadingCreate) -> int:
        return await self.ingest_batch([reading])

    async def ingest_batch(self, readings: list[SensorReadingCreate]) -> int:
        if not readings:
            return 0
        payloads = [
            reading.model_dump_json(by_alias=True)
            for reading in readings
        ]
        await redis_client.rpush(settings.reading_queue_name, *payloads)
        return len(payloads)
