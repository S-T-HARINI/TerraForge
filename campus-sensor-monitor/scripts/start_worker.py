import asyncio
import sys
from pathlib import Path

# Ensure campus-sensor-monitor is on sys.path
project_root = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(project_root))

from backend.app.workers.reading_worker import main

if __name__ == "__main__":
    print("Starting TerraForge Reading Ingestion Worker...")
    asyncio.run(main())
