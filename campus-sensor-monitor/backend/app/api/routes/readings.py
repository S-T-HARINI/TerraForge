
from fastapi import APIRouter, HTTPException, status
from backend.app.schemas.reading import (
    ReadingBatchCreate,
    ReadingBatchResponse,
    SensorReadingCreate,
)
from backend.app.services.ingestion_service import IngestionService

router = APIRouter(prefix="/readings", tags=["Sensor Readings"])

@router.post("", response_model=ReadingBatchResponse, status_code=status.HTTP_202_ACCEPTED)
async def ingest_reading(reading: SensorReadingCreate):
    try:
        accepted = await IngestionService().ingest(reading)
        return ReadingBatchResponse(accepted=accepted)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to queue sensor reading",
        ) from exc

@router.post("/batch", response_model=ReadingBatchResponse, status_code=status.HTTP_202_ACCEPTED)
async def ingest_batch(batch: ReadingBatchCreate):
    try:
        accepted = await IngestionService().ingest_batch(batch.readings)
        return ReadingBatchResponse(accepted=accepted)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Unable to queue sensor readings",
        ) from exc
