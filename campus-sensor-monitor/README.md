# TerraForge — Campus Sensor Monitoring and Alerts Backend

TerraForge is a reliable, high-throughput backend system built to monitor IoT sensors across university campuses. It accepts individual sensor readings and bulk batches, absorbs bursts of 10,000 readings per second, evaluates real-time and sliding time-window alert rules, and provides organizers with an alert management lifecycle.

---

## Technology Stack

- **Python:** 3.12+
- **API Framework:** FastAPI, Starlette, Uvicorn
- **Validation:** Pydantic v2
- **Database & ORM:** PostgreSQL 16, SQLAlchemy 2.x async, asyncpg
- **Queue & Buffering:** Redis 7 (redis-py asyncio)
- **Migrations:** Alembic
- **Testing & Load Testing:** Pytest, pytest-asyncio, HTTPX, Locust
- **Containerization:** Docker & Docker Compose

---

## Getting Started

### Prerequisites
- Python 3.12+
- PostgreSQL 16+
- Redis 7+
- (Optional) Docker & Docker Compose

### 1. Environment Setup

```bash
# Navigate to the project directory
cd campus-sensor-monitor

# Create and activate a virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install dependencies
pip install -r requirements.txt

# Copy example environment variables
cp .env.example .env
```

### 2. Run with Docker Compose (Recommended)

To start PostgreSQL, Redis, the FastAPI service, and the background worker with a single command:

```bash
docker compose up --build
```

The API will be available at `http://localhost:8000` with interactive Swagger docs at `http://localhost:8000/docs`.

### 3. Run Locally

```bash
# 1. Apply database migrations
alembic -c backend/alembic.ini upgrade head

# 2. Start the FastAPI application
python scripts/start_api.py

# 3. In another terminal, start the background worker
python scripts/start_worker.py
```

---

## API Reference

### Health & Readiness
- `GET /health` — Service liveness probe.
- `GET /health/ready` — Readiness probe checking PostgreSQL and Redis connectivity.

### Sensor Readings
- `POST /api/v1/readings` — Queue a single sensor reading (HTTP 202).
- `POST /api/v1/readings/batch` — Queue a batch of readings (HTTP 202).

### Alert Rules
- `POST /api/v1/rules` — Create a new rule (`threshold` or `time_window`).
- `GET /api/v1/rules` — List alert rules with optional `enabled_only` filter.
- `GET /api/v1/rules/{id}` — Get rule details by UUID.
- `PATCH /api/v1/rules/{id}` — Update rule configuration.
- `PATCH /api/v1/rules/{id}/enable` — Enable an alert rule.
- `PATCH /api/v1/rules/{id}/disable` — Disable an alert rule.

### Alerts
- `GET /api/v1/alerts` — Query alerts (filter by `status` or `sensor_id`).
- `GET /api/v1/alerts/{id}` — Get single alert details.
- `POST /api/v1/alerts/{id}/acknowledge` — Acknowledge an open alert.
- `POST /api/v1/alerts/{id}/resolve` — Resolve an alert with optional resolution note.

---

## Sensor Simulator & Load Testing

### Run Sensor Simulator
Simulate campus sensors sending batches of synthetic readings:

```bash
python simulator/sensor_simulator.py --url http://localhost:8000 --batch-size 100 --total-batches 50 --concurrency 5
```

### Run 10,000 Burst Test
Execute the high-throughput burst load test:

```bash
python loadtest/run_burst_test.py --url http://localhost:8000 --readings 10000 --batch-size 1000 --concurrency 10
```

### Run Locust Load Testing
Launch the Locust interactive UI:

```bash
locust -f loadtest/locustfile.py --host http://localhost:8000
```

---

## Running Automated Tests

Run the full test suite with pytest:

```bash
pytest
```
