# TerraForge Load Test Report

## Executive Summary
- **Date & Time:** YYYY-MM-DD HH:MM:SS
- **Target Environment:** Development / Staging / Production
- **Test Objective:** Evaluate system resilience and throughput under 10,000 readings/second burst conditions.
- **Outcome:** PASS / FAIL

---

## Test Configuration
- **API URL:** `http://localhost:8000`
- **Total Ingestion Volume:** 10,000 readings
- **Batch Size:** 1,000 readings per batch
- **Concurrency Level:** 10 concurrent HTTP clients
- **Database:** PostgreSQL 16 (Async SQLAlchemy / asyncpg)
- **Queue/Buffer:** Redis 7 (redis-py asyncio)

---

## Performance Metrics

| Metric | Measured Value | Target SLA | Status |
|---|---|---|---|
| **Peak Ingestion Throughput** | X,XXX readings/sec | ≥ 10,000 readings/sec | PASS/FAIL |
| **Total Burst Duration** | X.XX seconds | ≤ 1.5 seconds | PASS/FAIL |
| **P50 Request Latency** | XX.X ms | ≤ 50 ms | PASS/FAIL |
| **P95 Request Latency** | XX.X ms | ≤ 150 ms | PASS/FAIL |
| **P99 Request Latency** | XX.X ms | ≤ 300 ms | PASS/FAIL |
| **HTTP Error Rate** | 0.00% | 0.00% | PASS |
| **Queue Ingestion Loss** | 0 readings | 0 readings | PASS |

---

## Worker & Persistence Analysis
- **Queue Drain Time:** X.X seconds for 10,000 readings
- **Worker Batch Processing Rate:** XXX readings/batch
- **Alert Evaluation Overhead:** XX ms per batch
- **Dead-Letter Queue Count:** 0

---

## Bottlenecks & Recommendations
1. **Network / Connection Pooling:** ...
2. **PostgreSQL Bulk Insert Throughput:** ...
3. **Redis Memory Utilization:** ...
