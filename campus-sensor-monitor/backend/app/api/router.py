
from fastapi import APIRouter

from backend.app.api.routes import alerts, health, readings, rules

api_router = APIRouter()

api_router.include_router(health.router)
api_router.include_router(readings.router)
api_router.include_router(rules.router)
api_router.include_router(alerts.router)
