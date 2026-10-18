from fastapi import APIRouter, Response, status
from sqlalchemy import text

from backend.app.core.redis import redis_client
from backend.app.db.session import AsyncSessionLocal

router = APIRouter(tags=["Health"])


@router.get("/health")
async def health_check():
    return {
        "status": "ok",
        "service": "TerraForge",
    }


@router.get("/health/ready")
async def readiness_check(response: Response):
    db_status = "connected"
    redis_status = "connected"

    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
    except Exception:
        db_status = "unavailable"

    try:
        await redis_client.ping()
    except Exception:
        redis_status = "unavailable"

    is_ready = db_status == "connected" and redis_status == "connected"
    if not is_ready:
        response.status_code = status.HTTP_503_SERVICE_UNAVAILABLE
        return {
            "status": "not_ready",
            "database": db_status,
            "redis": redis_status,
        }

    return {
        "status": "ready",
        "database": db_status,
        "redis": redis_status,
    }
