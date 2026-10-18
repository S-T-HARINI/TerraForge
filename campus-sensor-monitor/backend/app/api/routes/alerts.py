
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_db
from backend.app.schemas.alert import (
    AlertAcknowledgeRequest,
    AlertResolveRequest,
    AlertResponse,
)
from backend.app.services.alert_service import AlertService

router = APIRouter(prefix="/alerts", tags=["Alerts"])


@router.get("", response_model=list[AlertResponse])
async def list_alerts(
    status_filter: str | None = Query(
        default=None,
        alias="status",
        pattern="^(open|acknowledged|resolved)$",
    ),
    sensor_id: str | None = Query(default=None, min_length=1, max_length=150),
    limit: int = Query(default=100, ge=1, le=500),
    offset: int = Query(default=0, ge=0),
    session: AsyncSession = Depends(get_db),
):
    return await AlertService(session).list_alerts(
        status=status_filter,
        sensor_id=sensor_id,
        limit=limit,
        offset=offset,
    )


@router.get("/{alert_id}", response_model=AlertResponse)
async def get_alert(
    alert_id: UUID,
    session: AsyncSession = Depends(get_db),
):
    alert = await AlertService(session).get_alert(alert_id)

    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    return alert


@router.post("/{alert_id}/acknowledge", response_model=AlertResponse)
async def acknowledge_alert(
    alert_id: UUID,
    data: AlertAcknowledgeRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        alert = await AlertService(session).acknowledge_alert(
            alert_id,
            data.acknowledged_by,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    return alert


@router.post("/{alert_id}/resolve", response_model=AlertResponse)
async def resolve_alert(
    alert_id: UUID,
    data: AlertResolveRequest,
    session: AsyncSession = Depends(get_db),
):
    try:
        alert = await AlertService(session).resolve_alert(
            alert_id,
            data.resolved_by,
            data.resolution_note,
        )
    except ValueError as exc:
        raise HTTPException(status_code=409, detail=str(exc)) from exc

    if alert is None:
        raise HTTPException(status_code=404, detail="Alert not found")

    return alert
