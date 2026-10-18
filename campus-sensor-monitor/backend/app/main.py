
from contextlib import asynccontextmanager

from fastapi import FastAPI

from backend.app.api.router import api_router
from backend.app.config import settings
from backend.app.core.redis import close_redis
from backend.app.db.session import dispose_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    try:
        yield
    finally:
        await close_redis()
        await dispose_db()


app = FastAPI(
    title=settings.app_name,
    version=settings.app_version,
    lifespan=lifespan,
)

app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
    }
