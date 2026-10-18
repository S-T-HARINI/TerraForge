
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.alert import Alert


class AlertRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, alert: Alert) -> Alert:
        self.session.add(alert)
        await self.session.flush()
        await self.session.refresh(alert)
        return alert

    async def get_by_id(self, alert_id: UUID) -> Alert | None:
        result = await self.session.execute(
            select(Alert).where(Alert.id == alert_id)
        )
        return result.scalar_one_or_none()

    async def list_alerts(
        self,
        status: str | None = None,
        sensor_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Alert]:
        statement = select(Alert)

        if status is not None:
            statement = statement.where(Alert.status == status)

        if sensor_id is not None:
            statement = statement.where(Alert.sensor_id == sensor_id)

        statement = (
            statement.order_by(Alert.triggered_at.desc())
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def update_status(self, alert: Alert) -> Alert:
        await self.session.flush()
        await self.session.refresh(alert)
        return alert
