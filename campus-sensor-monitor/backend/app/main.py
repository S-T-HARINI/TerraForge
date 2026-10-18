
from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app.api.router import api_router
from backend.app.config import settings
from backend.app.db.session import dispose_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield
    await dispose_db()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    description=(
        "Campus sensor monitoring, configurable alert rules, "
        "and real-time alert management."
    ),
    lifespan=lifespan,
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/", tags=["Root"])
async def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "message": "TerraForge API is running",
        "docs": "/docs",
    }
