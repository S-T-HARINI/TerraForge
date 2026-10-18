
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession

from backend.app.db.session import get_db
from backend.app.schemas.reading import (
    ReadingBatchCreate,
    ReadingBatchResponse,
    SensorReadingCreate,
)
from backend.app.services.ingestion_service import IngestionService

router = APIRouter(prefix="/readings", tags=["Sensor Readings"])


@router.post("", status_code=status.HTTP_202_ACCEPTED)
async def ingest_reading(
    reading: SensorReadingCreate,
    session: AsyncSession = Depends(get_db),
):
    service = IngestionService(session)

    try:
        accepted = await service.ingest_reading(reading)
        return {
            "accepted": accepted,
            "message": "Sensor reading stored successfully",
        }
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store sensor reading",
        ) from exc


@router.post(
    "/batch",
    response_model=ReadingBatchResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
async def ingest_batch(
    batch: ReadingBatchCreate,
    session: AsyncSession = Depends(get_db),
):
    service = IngestionService(session)

    try:
        accepted = await service.ingest_batch(batch.readings)
        return ReadingBatchResponse(
            accepted=accepted,
            message="Sensor readings stored successfully",
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to store sensor readings",
        ) from exc
