
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.models.alert_rule import AlertRule
from backend.app.schemas.rule import AlertRuleCreate, AlertRuleUpdate


class RuleRepository:
    def __init__(self, session: AsyncSession):
        self.session = session

    async def create(self, data: AlertRuleCreate) -> AlertRule:
        rule = AlertRule(**data.model_dump())
        self.session.add(rule)
        await self.session.flush()
        await self.session.refresh(rule)
        return rule

    async def get_by_id(self, rule_id: UUID) -> AlertRule | None:
        result = await self.session.execute(
            select(AlertRule).where(AlertRule.id == rule_id)
        )
        return result.scalar_one_or_none()

    async def list_all(
        self,
        enabled_only: bool = False,
        limit: int = 100,
        offset: int = 0,
    ) -> list[AlertRule]:
        statement = select(AlertRule)

        if enabled_only:
            statement = statement.where(AlertRule.enabled.is_(True))

        statement = (
            statement.order_by(AlertRule.created_at.desc())
            .limit(limit)
            .offset(offset)
        )

        result = await self.session.execute(statement)
        return list(result.scalars().all())

    async def update(
        self,
        rule: AlertRule,
        data: AlertRuleUpdate,
    ) -> AlertRule:
        updates = data.model_dump(exclude_unset=True)

        for field, value in updates.items():
            setattr(rule, field, value)

        await self.session.flush()
        await self.session.refresh(rule)
        return rule

    async def delete(self, rule: AlertRule) -> None:
        await self.session.delete(rule)
        await self.session.flush()
