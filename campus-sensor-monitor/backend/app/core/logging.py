import logging
import sys

from backend.app.config import settings


def setup_logging(level: str | None = None) -> None:
    """Configure structured logging for TerraForge applications and workers."""
    log_level = level or settings.log_level
    numeric_level = getattr(logging, log_level.upper(), logging.INFO)

    logging.basicConfig(
        level=numeric_level,
        format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        handlers=[
            logging.StreamHandler(sys.stdout),
        ],
        force=True,
    )
