from datetime import datetime, timezone
from uuid import UUID

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.alert import Alert
from backend.app.repositories.alert_repository import AlertRepository


class AlertService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repository = AlertRepository(session)

    async def list_alerts(
        self,
        status: str | None = None,
        sensor_id: str | None = None,
        limit: int = 100,
        offset: int = 0,
    ) -> list[Alert]:
        return await self.repository.list_alerts(
            status=status,
            sensor_id=sensor_id,
            limit=limit,
            offset=offset,
        )

    async def get_alert(self, alert_id: UUID) -> Alert | None:
        return await self.repository.get_by_id(alert_id)

    async def acknowledge_alert(
        self,
        alert_id: UUID,
        acknowledged_by: str,
    ) -> Alert | None:
        alert = await self.repository.get_by_id(alert_id)
        if alert is None:
            return None

        if alert.status != "open":
            raise ValueError("Only open alerts can be acknowledged")

        try:
            alert.status = "acknowledged"
            alert.acknowledged_by = acknowledged_by
            alert.acknowledged_at = datetime.now(timezone.utc)

            await self.repository.update_status(alert)
            await self.session.commit()
            await self.session.refresh(alert)
            return alert
        except Exception:
            await self.session.rollback()
            raise

    async def resolve_alert(
        self,
        alert_id: UUID,
        resolved_by: str,
        resolution_note: str | None = None,
    ) -> Alert | None:
        alert = await self.repository.get_by_id(alert_id)
        if alert is None:
            return None

        if alert.status == "resolved":
            raise ValueError("Alert is already resolved")

        try:
            alert.status = "resolved"
            alert.resolved_by = resolved_by
            alert.resolved_at = datetime.now(timezone.utc)

            details = dict(alert.details or {})
            if resolution_note is not None:
                details["resolution_note"] = resolution_note
            alert.details = details

            await self.repository.update_status(alert)
            await self.session.commit()
            await self.session.refresh(alert)
            return alert
        except Exception:
            await self.session.rollback()
            raise
