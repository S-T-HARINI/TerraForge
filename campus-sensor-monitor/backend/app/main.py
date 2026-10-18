from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.app.api.router import api_router
from backend.app.api.routes import health
from backend.app.config import settings
from backend.app.core.logging import setup_logging
from backend.app.core.redis import close_redis
from backend.app.db.session import dispose_db


@asynccontextmanager
async def lifespan(app: FastAPI):
    setup_logging()
    if settings.database_url.startswith("sqlite"):
        from backend.app.db.base import Base
        from backend.app.db.session import engine
        import backend.app.models  # noqa: F401
        async with engine.begin() as conn:
            await conn.run_sync(Base.metadata.create_all)
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

# Enable CORS for frontend dashboard
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        "http://localhost:3001",
        "http://127.0.0.1:3001",
        "http://localhost:3002",
        "http://127.0.0.1:3002",
        "http://localhost:3005",
        "http://127.0.0.1:3005",
    ],
    allow_origin_regex=r"^https?://(localhost|127\.0\.0\.1)(:\d+)?$",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Root-level health endpoints (e.g. for container healthchecks)
app.include_router(health.router)

# Versioned API routes
app.include_router(api_router, prefix=settings.api_prefix)


@app.get("/")
async def root():
    return {
        "name": settings.app_name,
        "version": settings.app_version,
        "status": "running",
    }
