
from datetime import datetime
from typing import Sequence

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.sensor_reading import SensorReading
from backend.app.schemas.reading import SensorReadingCreate


class ReadingRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create_many(
        self,
        readings: Sequence[SensorReadingCreate],
    ) -> int:
        if not readings:
            return 0

        records = [
            SensorReading(
                sensor_id=reading.sensor_id,
                reading_type=reading.reading_type,
                value=reading.value,
                timestamp=reading.timestamp,
            )
            for reading in readings
        ]

        self.session.add_all(records)
        await self.session.flush()

        return len(records)

    async def get_latest(
        self,
        sensor_id: str,
        reading_type: str | None = None,
    ) -> SensorReading | None:
        statement = select(SensorReading).where(
            SensorReading.sensor_id == sensor_id
        )

        if reading_type is not None:
            statement = statement.where(
                SensorReading.reading_type == reading_type
            )

        statement = statement.order_by(
            SensorReading.timestamp.desc()
        ).limit(1)

        result = await self.session.execute(statement)
        return result.scalar_one_or_none()

    async def get_window(
        self,
        sensor_id: str,
        reading_type: str,
        start_time: datetime,
        end_time: datetime,
    ) -> list[SensorReading]:
        statement = (
            select(SensorReading)
            .where(
                SensorReading.sensor_id == sensor_id,
                SensorReading.reading_type == reading_type,
                SensorReading.timestamp >= start_time,
                SensorReading.timestamp <= end_time,
            )
            .order_by(SensorReading.timestamp.asc())
        )

        result = await self.session.execute(statement)
        return list(result.scalars().all())
