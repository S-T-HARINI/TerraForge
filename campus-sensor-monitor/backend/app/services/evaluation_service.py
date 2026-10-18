
import operator
from datetime import datetime, timezone

from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.config import settings
from backend.app.core.redis import redis_client
from backend.app.models.alert import Alert
from backend.app.models.alert_rule import AlertRule
from backend.app.repositories.alert_repository import AlertRepository
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


class EvaluationService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.rule_repository = RuleRepository(session)
        self.alert_repository = AlertRepository(session)

    def matches(self, value: float, rule: AlertRule) -> bool:
        comparison = OPERATORS.get(rule.operator)
        return comparison is not None and comparison(value, rule.threshold)

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
            if rule.rule_type != "threshold":
                continue
            if rule.reading_type != reading.reading_type:
                continue
            if rule.sensor_id and rule.sensor_id != reading.sensor_id:
                continue
            if not self.matches(reading.value, rule):
                continue

            dedup_key = (
                f"terraforge:alert:dedup:{rule.id}:{reading.sensor_id}"
            )

            # Avoid repeatedly generating alerts for the same rule and sensor.
            # Reserve the key only when it does not already exist.
            reserved = await redis_client.set(
                dedup_key,
                "1",
                ex=max(settings.alert_deduplication_seconds, 1),
                nx=True,
            )
            if not reserved:
                continue

            alert = Alert(
                rule_id=rule.id,
                sensor_id=reading.sensor_id,
                reading_type=reading.reading_type,
                message=(
                    f"{rule.name}: {reading.reading_type} "
                    f"value {reading.value} {rule.operator} {rule.threshold}"
                ),
                observed_value=reading.value,
                status="open",
                triggered_at=datetime.now(timezone.utc),
                details={
                    "rule_name": rule.name,
                    "rule_type": rule.rule_type,
                    "threshold": rule.threshold,
                    "operator": rule.operator,
                    "reading_timestamp": reading.timestamp.isoformat(),
                },
            )

            await self.alert_repository.create(alert)
            generated_alerts.append(alert)

        return generated_alerts
