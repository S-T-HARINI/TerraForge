
import json
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
            json.dumps({
                "sensorId": reading.sensor_id,
                "type": reading.reading_type,
                "value": reading.value,
                "timestamp": reading.timestamp.isoformat(),
            })
            for reading in readings
        ]
        await redis_client.rpush(settings.reading_queue_name, *payloads)
        return len(payloads)
