# TerraForge — Campus Sensor Monitoring and Alerts

TerraForge (`campus-sensor-monitor`) is a high-throughput, fault-tolerant backend and frontend system built to monitor IoT sensors across university campuses. It accepts individual sensor readings and bulk batches, absorbs bursts of 10,000 readings per second via Redis buffering, evaluates real-time and sliding 10-minute time-window alert rules, deduplicates alerts, and provides campus organizers with a complete alert lifecycle management system and interactive monitoring dashboard.

---

## Key Features

- **High-Throughput Ingestion:** Absorbs bursts exceeding 100,000 readings/sec into a Redis queue with immediate `HTTP 202 Accepted` responses.
- **Asynchronous Persistence:** Background workers pull batches from Redis, perform bulk database inserts, and route unprocessable items to a dead-letter queue (DLQ).
- **Dual Rule Evaluation Engine:**
  - **Single-Reading Threshold Rules:** Evaluates operators (`>`, `>=`, `<`, `<=`, `==`, `!=`) instantaneously.
  - **Time-Window Rolling Averages:** Computes sliding averages over a configured window (e.g., 10-minute / 600s window) from historical readings.
- **Atomic Deduplication:** Prevents alert storms using atomic Redis `SET NX EX` keys with rollback-safe deletion if database transactions fail.
- **Alert Lifecycle Management:** Full state machine (`open` -> `acknowledged` -> `resolved`) with audit trails and transition validation.
- **Configurable Sensor Simulator:** Generates synthetic telemetry for temperature, humidity, CO₂, noise, and power with anomaly injection.
- **Modern Web Dashboard:** Next.js 16 + TypeScript + Tailwind CSS UI with real-time charts, sensor filters, alert actions, and health indicators.

---

## Technology Stack

- **Backend:** Python 3.12+, FastAPI, Uvicorn, Pydantic v2
- **Database & ORM:** PostgreSQL 16 (or SQLite in local dev), SQLAlchemy 2.x async, asyncpg, aiosqlite
- **Queue & Cache:** Redis 7 (or `fakeredis` / `dev_redis.py` in local dev), `redis-py` asyncio client
- **Migrations:** Alembic
- **Testing & Benchmarking:** Pytest, pytest-asyncio, HTTPX, Locust
- **Frontend:** Next.js 16 (Turbopack), React 19, TypeScript, Tailwind CSS, Lucide icons, Recharts
- **Containerization:** Docker & Docker Compose

---

## Project Structure

```
campus-sensor-monitor/
├── backend/
│   ├── app/
│   │   ├── api/routes/          # API endpoints (readings, rules, alerts, health)
│   │   ├── core/                # Redis connection, logging
│   │   ├── db/                  # SQLAlchemy async session and Base
│   │   ├── models/              # Alert, AlertRule, SensorReading models
│   │   ├── repositories/        # Database access layers
│   │   ├── schemas/             # Pydantic v2 validation models
│   │   ├── services/            # Ingestion, evaluation, window, and alert services
│   │   ├── workers/             # Async background reading worker and scheduler
│   │   ├── dev_redis.py         # Standalone local Redis TCP server (fakeredis)
│   │   ├── config.py            # Pydantic BaseSettings
│   │   └── main.py              # FastAPI app definition and lifespan
│   ├── alembic/                 # Database migrations
│   └── alembic.ini              # Alembic configuration
├── frontend/                    # Next.js 16 TypeScript web dashboard
│   ├── src/app/                 # App router pages (overview, sensors, alerts, rules, health, simulator)
│   └── package.json             # Configured on port 3005
├── simulator/                   # Synthetic sensor telemetry simulator
│   ├── sensor_simulator.py      # Simulator CLI (supports batch and individual modes)
│   └── batch_generator.py       # Sensor telemetry generator with anomaly injection
├── loadtest/                    # Load-testing tools
│   ├── run_burst_test.py        # 10,000 readings burst test runner
│   └── locustfile.py            # Locust interactive load testing scenario
├── tests/                       # 32 pytest unit and integration tests
│   └── verify_end_to_end.py     # Automated task-sheet compliance verification script
├── ARCHITECTURE.md              # Detailed architecture, diagrams, and trade-offs
├── LOAD_TEST_REPORT.md          # 10,000 readings burst test report
├── TASK_SHEET_COMPLIANCE_REPORT.md # Official GDG task-sheet compliance audit
└── docker-compose.yml           # Multi-container production deployment
```

---

## Installation & Setup

### Prerequisites
- Python 3.12 or newer
- Node.js 18+ (for frontend dashboard)
- PostgreSQL 16+ and Redis 7+ (or Docker Compose)

### Option 1: Docker Compose (Full Production Stack)

To run PostgreSQL, Redis, FastAPI backend, and the background worker with a single command:

```bash
cd campus-sensor-monitor
docker compose up --build
```

- API Docs: `http://localhost:8000/docs`
- Health check: `http://localhost:8000/health/ready`

---

### Option 2: Local Standalone Development Mode (No Docker Required)

TerraForge includes a zero-dependency local development mode utilizing `sqlite+aiosqlite` and an in-memory Redis TCP server (`dev_redis.py`).

1. **Activate Virtual Environment and Install Dependencies:**
   ```bash
   cd campus-sensor-monitor
   python -m venv .venv
   # Windows:
   .venv\Scripts\activate
   # Linux/macOS:
   source .venv/bin/activate

   pip install -r requirements.txt
   ```

2. **Configure Environment Variables:**
   A pre-configured `.env` is included in the project:
   ```env
   DATABASE_URL=sqlite+aiosqlite:///./terraforge.db
   REDIS_URL=redis://127.0.0.1:6379/0
   ENVIRONMENT=development
   WORKER_BATCH_SIZE=500
   ```

3. **Start the Local Redis TCP Server:**
   ```bash
   python backend/app/dev_redis.py
   # Output: [TerraForge Dev Redis] In-memory Redis server listening on 127.0.0.1:6379
   ```

4. **Start the Backend API Server:**
   ```bash
   python scripts/start_api.py
   # Serves API on http://127.0.0.1:8000 (Swagger docs at /docs)
   ```

5. **Start the Asynchronous Reading Worker:**
   ```bash
   python scripts/start_worker.py
   # Continuously polls Redis and persists batches to the database
   ```

6. **Start the Frontend Dashboard:**
   ```bash
   cd frontend
   npm install
   npm run dev
   ```
   Open your browser at `http://localhost:3005`.

---

## API Reference

### Health & Readiness
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/health` | Liveness probe returning status: `ok` |
| `GET` | `/health/ready` | Readiness probe checking Database and Redis connectivity |

### Sensor Telemetry Ingestion
| Method | Endpoint | Description | Status Code |
| :--- | :--- | :--- | :--- |
| `POST` | `/api/v1/readings` | Enqueue a single reading | `202 Accepted` |
| `POST` | `/api/v1/readings/batch` | Enqueue a batch of readings | `202 Accepted` |

**Single Reading Payload:**
```json
{
  "sensorId": "sensor-temp-01",
  "type": "temperature",
  "value": 24.5,
  "timestamp": "2026-10-19T14:30:00Z"
}
```

**Batch Reading Payload:**
```json
{
  "readings": [
    {
      "sensorId": "sensor-co2-01",
      "type": "co2",
      "value": 1150.0,
      "timestamp": "2026-10-19T14:30:00Z"
    }
  ]
}
```

### Alert Rules Management
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `POST` | `/api/v1/rules` | Create threshold or time-window rule |
| `GET` | `/api/v1/rules` | List rules (optional `?enabled_only=true`) |
| `GET` | `/api/v1/rules/{id}` | Get rule details |
| `PATCH` | `/api/v1/rules/{id}` | Update rule threshold, name, or metadata |
| `PATCH` | `/api/v1/rules/{id}/enable` | Enable an alert rule |
| `PATCH` | `/api/v1/rules/{id}/disable` | Disable an alert rule |

### Alert Lifecycle Management
| Method | Endpoint | Description |
| :--- | :--- | :--- |
| `GET` | `/api/v1/alerts` | List alerts (filter by `status` or `sensor_id`) |
| `GET` | `/api/v1/alerts/{id}` | Retrieve specific alert details |
| `POST` | `/api/v1/alerts/{id}/acknowledge` | Acknowledge alert (`{"acknowledged_by": "alice"}`) |
| `POST` | `/api/v1/alerts/{id}/resolve` | Resolve alert (`{"resolved_by": "alice", "resolution_note": "Replaced filter"}`) |

---

## Sensor Simulator

The simulator produces high-volume synthetic campus telemetry and supports anomaly spikes and error modes.

```bash
# Run simulator in batch mode (50 batches of 100 readings)
python simulator/sensor_simulator.py --url http://localhost:8000 --mode batch --batch-size 100 --total-batches 50 --concurrency 5

# Run simulator in individual mode (1 reading per HTTP request)
python simulator/sensor_simulator.py --url http://localhost:8000 --mode individual --total-batches 200

# Inject 10% anomaly spikes to trigger threshold alerts
python simulator/sensor_simulator.py --url http://localhost:8000 --batch-size 50 --total-batches 20 --anomaly-rate 0.10
```

---

## High-Throughput Load Testing

### Run 10,000 Burst Ingestion Test
Submits 10,000 readings across concurrent batches and measures end-to-end throughput:
```bash
python loadtest/run_burst_test.py --url http://localhost:8000 --readings 10000 --batch-size 1000 --concurrency 10
```

### Run Interactive Locust Load Testing
```bash
locust -f loadtest/locustfile.py --host http://localhost:8000
```
Open `http://localhost:8089` to configure virtual users and monitor live latency percentiles.

---

## Automated Verification & Test Suite

### Run All 32 Pytest Tests
```bash
python -m pytest tests/ -v
```

### Run End-to-End Task-Sheet Audit Script
Executes all 8 task-sheet audit sections (single & batch ingestion, rule management, single-reading rules, 10-minute rolling window average, deduplication, alert lifecycle transitions, simulator check, and 10,000 readings burst test):
```bash
python tests/verify_end_to_end.py
```

---

## Compliance and Performance Deliverables

- Detailed task-sheet requirement matrix: [`TASK_SHEET_COMPLIANCE_REPORT.md`](file:///d:/projects/TerraForge/campus-sensor-monitor/TASK_SHEET_COMPLIANCE_REPORT.md)
- Complete load testing and queue drainage report: [`LOAD_TEST_REPORT.md`](file:///d:/projects/TerraForge/campus-sensor-monitor/LOAD_TEST_REPORT.md)
- Full system architecture and failure recovery design: [`ARCHITECTURE.md`](file:///d:/projects/TerraForge/campus-sensor-monitor/ARCHITECTURE.md)
