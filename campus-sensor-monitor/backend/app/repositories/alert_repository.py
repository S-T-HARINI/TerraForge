from datetime import datetime
from typing import Any
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
        status_filter: str | None = None,
    ) -> list[Alert]:
        statement = select(Alert)

        filter_status = status if status is not None else status_filter
        if filter_status is not None:
            statement = statement.where(Alert.status == filter_status)

        if sensor_id is not None:
            statement = statement.where(Alert.sensor_id == sensor_id)

        statement = (
            statement.order_by(Alert.triggered_at.desc())
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    list_all = list_alerts

    async def update_status(
        self,
        alert: Alert,
        status: str | None = None,
        acknowledged_by: str | None = None,
        acknowledged_at: datetime | None = None,
        resolved_by: str | None = None,
        resolved_at: datetime | None = None,
        details: dict | None = None,
        **kwargs: Any,
    ) -> Alert:
        if status is not None:
            alert.status = status
        if acknowledged_by is not None:
            alert.acknowledged_by = acknowledged_by
        if acknowledged_at is not None:
            alert.acknowledged_at = acknowledged_at
        if resolved_by is not None:
            alert.resolved_by = resolved_by
        if resolved_at is not None:
            alert.resolved_at = resolved_at
        if details is not None:
            alert.details = details
        for key, val in kwargs.items():
            if hasattr(alert, key):
                setattr(alert, key, val)
        await self.session.flush()
        await self.session.refresh(alert)
        return alert
