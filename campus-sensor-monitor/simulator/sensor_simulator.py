import argparse
import asyncio
import logging
import time

import httpx

from simulator.batch_generator import generate_reading_batch, generate_single_reading

logging.basicConfig(level=logging.INFO, format="%(asctime)s [%(levelname)s] %(message)s")
logger = logging.getLogger("SensorSimulator")


async def send_batch(
    client: httpx.AsyncClient,
    url: str,
    batch_size: int,
    batch_index: int,
) -> bool:
    payload = {"readings": generate_reading_batch(count=batch_size)}
    start = time.perf_counter()
    try:
        response = await client.post(f"{url}/api/v1/readings/batch", json=payload, timeout=10.0)
        elapsed = (time.perf_counter() - start) * 1000
        if response.status_code == 202:
            logger.info("Batch #%d (%d readings) accepted in %.2f ms", batch_index, batch_size, elapsed)
            return True
        else:
            logger.warning("Batch #%d failed with status %d: %s", batch_index, response.status_code, response.text)
            return False
    except Exception as exc:
        logger.error("Batch #%d failed with exception: %s", batch_index, exc)
        return False


async def send_single(
    client: httpx.AsyncClient,
    url: str,
    index: int,
    reading_type: str | None = None,
    force_spike: bool = False,
) -> bool:
    payload = generate_single_reading(reading_type=reading_type, force_spike=force_spike)
    start = time.perf_counter()
    try:
        response = await client.post(f"{url}/api/v1/readings", json=payload, timeout=10.0)
        elapsed = (time.perf_counter() - start) * 1000
        if response.status_code == 202:
            logger.info("Reading #%d (%s) accepted in %.2f ms", index, payload["type"], elapsed)
            return True
        else:
            logger.warning("Reading #%d failed with status %d: %s", index, response.status_code, response.text)
            return False
    except Exception as exc:
        logger.error("Reading #%d failed with exception: %s", index, exc)
        return False


async def run_simulator(
    url: str,
    mode: str,
    batch_size: int,
    total_count: int,
    concurrency: int,
    interval_seconds: float,
    spike_ratio: float = 0.05,
    reading_type: str | None = None,
) -> dict[str, float | int]:
    logger.info(
        "Starting Sensor Simulator: target=%s, mode=%s, count=%d, concurrency=%d",
        url, mode, total_count, concurrency,
    )

    limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency * 2)
    start_total = time.perf_counter()

    async with httpx.AsyncClient(limits=limits) as client:
        sem = asyncio.Semaphore(concurrency)

        if mode == "individual":
            total_readings = total_count

            async def worker_single(index: int):
                async with sem:
                    success = await send_single(client, url, index, reading_type=reading_type)
                    if interval_seconds > 0:
                        await asyncio.sleep(interval_seconds)
                    return success

            tasks = [asyncio.create_task(worker_single(i + 1)) for i in range(total_readings)]
            results = await asyncio.gather(*tasks)
            accepted_readings = sum(1 for r in results if r)
            rejected_readings = total_readings - accepted_readings
        else:
            # Batch mode: total_count represents number of batches
            total_batches = total_count
            total_readings = total_batches * batch_size

            async def worker_batch(index: int):
                async with sem:
                    success = await send_batch(client, url, batch_size, index)
                    if interval_seconds > 0:
                        await asyncio.sleep(interval_seconds)
                    return success

            tasks = [asyncio.create_task(worker_batch(i + 1)) for i in range(total_batches)]
            results = await asyncio.gather(*tasks)
            successful_batches = sum(1 for r in results if r)
            accepted_readings = successful_batches * batch_size
            rejected_readings = total_readings - accepted_readings

    elapsed_total = time.perf_counter() - start_total
    throughput = accepted_readings / elapsed_total if elapsed_total > 0 else 0

    logger.info("=" * 60)
    logger.info("Simulator Execution Summary (%s mode):", mode.upper())
    logger.info("  Total Attempted:   %d readings", total_readings)
    logger.info("  Accepted by API:   %d readings", accepted_readings)
    logger.info("  Rejected by API:   %d readings", rejected_readings)
    logger.info("  Elapsed Time:      %.3f seconds", elapsed_total)
    logger.info("  Throughput:        %.2f readings/second", throughput)
    logger.info("=" * 60)

    return {
        "total": total_readings,
        "accepted": accepted_readings,
        "rejected": rejected_readings,
        "elapsed": elapsed_total,
        "throughput": throughput,
    }


def main():
    parser = argparse.ArgumentParser(description="TerraForge Campus Sensor Simulator")
    parser.add_argument("--url", default="http://localhost:8000", help="Base URL of TerraForge API")
    parser.add_argument("--mode", choices=["batch", "individual"], default="batch", help="Submission mode")
    parser.add_argument("--batch-size", type=int, default=100, help="Readings per batch (in batch mode)")
    parser.add_argument("--total", type=int, default=10, help="Total batches (batch mode) or total readings (individual mode)")
    parser.add_argument("--concurrency", type=int, default=5, help="Concurrent HTTP workers")
    parser.add_argument("--interval", type=float, default=0.1, help="Interval between requests (seconds)")
    parser.add_argument("--spike-ratio", type=float, default=0.05, help="Anomaly/spike ratio (0.0 to 1.0)")
    parser.add_argument("--type", dest="reading_type", default=None, help="Filter by specific reading type")

    args = parser.parse_args()
    asyncio.run(
        run_simulator(
            url=args.url,
            mode=args.mode,
            batch_size=args.batch_size,
            total_count=args.total,
            concurrency=args.concurrency,
            interval_seconds=args.interval,
            spike_ratio=args.spike_ratio,
            reading_type=args.reading_type,
        )
    )


if __name__ == "__main__":
    main()
