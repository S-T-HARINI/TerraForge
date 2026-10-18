
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_db
from backend.app.schemas.rule import (
    AlertRuleCreate,
    AlertRuleResponse,
    AlertRuleUpdate,
)
from backend.app.services.rule_service import RuleService

router = APIRouter(prefix="/rules", tags=["Alert Rules"])


@router.post(
    "",
    response_model=AlertRuleResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_rule(
    data: AlertRuleCreate,
    session: AsyncSession = Depends(get_db),
):
    service = RuleService(session)
    return await service.create_rule(data)


@router.get("", response_model=list[AlertRuleResponse])
async def list_rules(
    enabled_only: bool = False,
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db),
):
    service = RuleService(session)
    return await service.list_rules(
        enabled_only=enabled_only,
        limit=limit,
        offset=offset,
    )


@router.get("/{rule_id}", response_model=AlertRuleResponse)
async def get_rule(
    rule_id: UUID,
    session: AsyncSession = Depends(get_db),
):
    rule = await RuleService(session).get_rule(rule_id)

    if rule is None:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    return rule


@router.patch("/{rule_id}", response_model=AlertRuleResponse)
async def update_rule(
    rule_id: UUID,
    data: AlertRuleUpdate,
    session: AsyncSession = Depends(get_db),
):
    try:
        rule = await RuleService(session).update_rule(rule_id, data)
    except ValueError as exc:
        raise HTTPException(status_code=422, detail=str(exc)) from exc

    if rule is None:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    return rule


@router.patch("/{rule_id}/enable", response_model=AlertRuleResponse)
async def enable_rule(
    rule_id: UUID,
    session: AsyncSession = Depends(get_db),
):
    rule = await RuleService(session).set_enabled(rule_id, True)

    if rule is None:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    return rule


@router.patch("/{rule_id}/disable", response_model=AlertRuleResponse)
async def disable_rule(
    rule_id: UUID,
    session: AsyncSession = Depends(get_db),
):
    rule = await RuleService(session).set_enabled(rule_id, False)

    if rule is None:
        raise HTTPException(status_code=404, detail="Alert rule not found")

    return rule
