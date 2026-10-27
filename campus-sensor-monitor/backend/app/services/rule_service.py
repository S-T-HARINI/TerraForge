
from uuid import UUID

from pydantic import ValidationError
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.alert_rule import AlertRule
from backend.app.repositories.rule_repository import RuleRepository
from backend.app.schemas.rule import AlertRuleCreate, AlertRuleUpdate


class RuleService:
    def __init__(self, session: AsyncSession):
        self.session = session
        self.repository = RuleRepository(session)

    async def create_rule(self, data: AlertRuleCreate) -> AlertRule:
        try:
            rule = await self.repository.create(data)
            await self.session.commit()
            await self.session.refresh(rule)
            return rule
        except Exception:
            await self.session.rollback()
            raise

    async def get_rule(self, rule_id: UUID) -> AlertRule | None:
        return await self.repository.get_by_id(rule_id)

    async def list_rules(
        self,
        enabled_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AlertRule]:
        return await self.repository.list_all(
            enabled_only=enabled_only,
            limit=limit,
            offset=offset,
        )

    async def update_rule(
        self,
        rule_id: UUID,
        data: AlertRuleUpdate,
    ) -> AlertRule | None:
        rule = await self.repository.get_by_id(rule_id)
        if rule is None:
            return None

        updates = data.model_dump(exclude_unset=True)
        merged = {
            "name": rule.name,
            "description": rule.description,
            "sensor_id": rule.sensor_id,
            "reading_type": rule.reading_type,
            "rule_type": rule.rule_type,
            "operator": rule.operator,
            "threshold": rule.threshold,
            "window_seconds": rule.window_seconds,
            "enabled": rule.enabled,
        }
        merged.update(updates)

        try:
            validated = AlertRuleCreate.model_validate(merged)
        except ValidationError as exc:
            raise ValueError(str(exc)) from exc

        try:
            updated_rule = await self.repository.update(rule, AlertRuleUpdate(
                **validated.model_dump()
            ))
            await self.session.commit()
            await self.session.refresh(updated_rule)
            return updated_rule
        except Exception:
            await self.session.rollback()
            raise

    async def set_enabled(
        self,
        rule_id: UUID,
        enabled: bool,
    ) -> AlertRule | None:
        return await self.update_rule(
            rule_id,
            AlertRuleUpdate(enabled=enabled),
        )
