import argparse
import asyncio
import time
from datetime import datetime, timezone

import httpx


def generate_batch(size: int, batch_id: int):
    now = datetime.now(timezone.utc).isoformat()
    return {
        "readings": [
            {
                "sensorId": f"burst-sensor-{(i % 50):03d}",
                "type": "temperature",
                "value": round(20.0 + (i % 15) * 0.5, 2),
                "timestamp": now,
            }
            for i in range(size)
        ]
    }


async def run_burst(
    target_url: str,
    total_readings: int = 10000,
    batch_size: int = 1000,
    concurrency: int = 10,
):
    num_batches = total_readings // batch_size
    print(f"==================================================")
    print(f"TerraForge Burst Ingestion Load Test")
    print(f"Target URL: {target_url}")
    print(f"Total Readings: {total_readings}")
    print(f"Batch Size: {batch_size} readings/batch ({num_batches} batches)")
    print(f"Concurrency: {concurrency} parallel requests")
    print(f"==================================================")

    limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency * 2)
    async with httpx.AsyncClient(limits=limits) as client:
        sem = asyncio.Semaphore(concurrency)
        latencies: list[float] = []
        statuses: list[int] = []

        async def send_single(batch_idx: int):
            payload = generate_batch(batch_size, batch_idx)
            async with sem:
                t0 = time.perf_counter()
                try:
                    res = await client.post(
                        f"{target_url}/api/v1/readings/batch",
                        json=payload,
                        timeout=30.0,
                    )
                    elapsed = time.perf_counter() - t0
                    latencies.append(elapsed)
                    statuses.append(res.status_code)
                except Exception as exc:
                    elapsed = time.perf_counter() - t0
                    latencies.append(elapsed)
                    statuses.append(500)
                    print(f"Batch {batch_idx} error: {exc}")

        overall_t0 = time.perf_counter()
        tasks = [asyncio.create_task(send_single(i)) for i in range(num_batches)]
        await asyncio.gather(*tasks)
        overall_time = time.perf_counter() - overall_t0

    successful_batches = sum(1 for s in statuses if s == 202)
    successful_readings = successful_batches * batch_size
    throughput = successful_readings / overall_time if overall_time > 0 else 0

    print("\n--- Burst Test Results ---")
    print(f"Overall Time: {overall_time:.3f} seconds")
    print(f"Successful Batches: {successful_batches}/{num_batches}")
    print(f"Readings Ingested: {successful_readings}/{total_readings}")
    print(f"Throughput: {throughput:.2f} readings/second")

    if latencies:
        latencies_ms = [l * 1000 for l in latencies]
        latencies_ms.sort()
        p50 = latencies_ms[int(len(latencies_ms) * 0.50)]
        p95 = latencies_ms[int(len(latencies_ms) * 0.95)]
        p99 = latencies_ms[int(len(latencies_ms) * 0.99)]
        avg = sum(latencies_ms) / len(latencies_ms)
        print(f"Latency Avg: {avg:.2f} ms")
        print(f"Latency P50: {p50:.2f} ms")
        print(f"Latency P95: {p95:.2f} ms")
        print(f"Latency P99: {p99:.2f} ms")


def main():
    parser = argparse.ArgumentParser(description="Burst load test for TerraForge")
    parser.add_argument("--url", default="http://localhost:8000", help="API URL")
    parser.add_argument("--readings", type=int, default=10000, help="Total burst readings")
    parser.add_argument("--batch-size", type=int, default=1000, help="Readings per batch")
    parser.add_argument("--concurrency", type=int, default=10, help="Concurrent HTTP connections")
    args = parser.parse_args()

    asyncio.run(
        run_burst(
            target_url=args.url,
            total_readings=args.readings,
            batch_size=args.batch_size,
            concurrency=args.concurrency,
        )
    )


if __name__ == "__main__":
    main()
