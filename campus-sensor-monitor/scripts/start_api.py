import os
import sys
from pathlib import Path
import uvicorn

# Ensure campus-sensor-monitor is on sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from backend.app.config import settings

if __name__ == "__main__":
    host = os.getenv("API_HOST", "0.0.0.0")
    port = int(os.getenv("API_PORT", "8000"))
    reload = settings.environment == "development"
    print(f"Starting TerraForge API on {host}:{port} (reload={reload})...")
    uvicorn.run(
        "backend.app.main:app",
        host=host,
        port=port,
        reload=reload,
        log_level=settings.log_level.lower(),
    )
