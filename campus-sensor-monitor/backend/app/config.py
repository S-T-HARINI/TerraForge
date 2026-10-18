
from functools import lru_cache
from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        extra="ignore",
        case_sensitive=False,
    )

    app_name: str = "TerraForge"
    app_version: str = "1.0.0"
    environment: str = "development"
    api_prefix: str = "/api/v1"

    database_url: str = Field(
        default="postgresql+asyncpg://terraforge:terraforge@localhost:5432/terraforge"
    )
    redis_url: str = "redis://localhost:6379/0"

    log_level: str = "INFO"
    batch_max_size: int = Field(default=1000, ge=1, le=10000)
    reading_queue_name: str = "terraforge:readings"
    worker_batch_size: int = Field(default=500, ge=1, le=5000)
    worker_block_ms: int = Field(default=1000, ge=100, le=10000)

    alert_deduplication_seconds: int = Field(default=300, ge=0)
    default_window_seconds: int = Field(default=600, ge=1)
    database_pool_size: int = Field(default=20, ge=1)
    database_max_overflow: int = Field(default=30, ge=0)


@lru_cache
def get_settings() -> Settings:
    return Settings()


settings = get_settings()
