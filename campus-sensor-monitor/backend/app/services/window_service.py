
import operator
from datetime import timedelta, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.alert import Alert
from backend.app.repositories.alert_repository import AlertRepository
from backend.app.repositories.reading_repository import ReadingRepository
from backend.app.repositories.rule_repository import RuleRepository
from backend.app.schemas.reading import SensorReadingCreate


OPERATORS = {
    ">": operator.gt,
    ">=": operator.ge,
    "<": operator.lt,
    "<=": operator.le,
    "==": operator.eq,
    "!=": operator.ne,
}


class WindowService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.reading_repository = ReadingRepository(session)
        self.rule_repository = RuleRepository(session)
        self.alert_repository = AlertRepository(session)

    async def evaluate_reading(
        self,
        reading: SensorReadingCreate,
    ) -> list[Alert]:
        rules = await self.rule_repository.list_all(
            enabled_only=True,
            limit=10000,
        )
        generated_alerts: list[Alert] = []

        for rule in rules:
            if rule.rule_type != "time_window":
                continue
            if rule.reading_type != reading.reading_type:
                continue
            if rule.sensor_id and rule.sensor_id != reading.sensor_id:
                continue
            if not rule.window_seconds:
                continue

            end_time = reading.timestamp
            start_time = end_time - timedelta(seconds=rule.window_seconds)

            readings = await self.reading_repository.get_window(
                sensor_id=reading.sensor_id,
                reading_type=reading.reading_type,
                start_time=start_time,
                end_time=end_time,
            )

            if not readings:
                continue

            average = sum(item.value for item in readings) / len(readings)
            comparison = OPERATORS.get(rule.operator)

            if comparison is None or not comparison(average, rule.threshold):
                continue

            alert = Alert(
                rule_id=rule.id,
                sensor_id=reading.sensor_id,
                reading_type=reading.reading_type,
                message=(
                    f"{rule.name}: average {reading.reading_type} "
                    f"over {rule.window_seconds} seconds is {average:.2f}; "
                    f"threshold {rule.operator} {rule.threshold}"
                ),
                observed_value=average,
                status="open",
                triggered_at=end_time.astimezone(timezone.utc),
                details={
                    "rule_name": rule.name,
                    "rule_type": "time_window",
                    "window_seconds": rule.window_seconds,
                    "threshold": rule.threshold,
                    "operator": rule.operator,
                    "reading_count": len(readings),
                    "window_start": start_time.isoformat(),
                    "window_end": end_time.isoformat(),
                },
            )
            await self.alert_repository.create(alert)
            generated_alerts.append(alert)

        return generated_alerts
