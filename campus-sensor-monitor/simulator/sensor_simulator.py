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


async def run_simulator(
    url: str,
    batch_size: int,
    total_batches: int,
    concurrency: int,
    interval_seconds: float,
) -> None:
    logger.info(
        "Starting Sensor Simulator: target=%s, batch_size=%d, total_batches=%d, concurrency=%d",
        url, batch_size, total_batches, concurrency,
    )

    limits = httpx.Limits(max_keepalive_connections=concurrency, max_connections=concurrency * 2)
    async with httpx.AsyncClient(limits=limits) as client:
        sem = asyncio.Semaphore(concurrency)

        async def worker(index: int):
            async with sem:
                success = await send_batch(client, url, batch_size, index)
                if interval_seconds > 0:
                    await asyncio.sleep(interval_seconds)
                return success

        tasks = [asyncio.create_task(worker(i + 1)) for i in range(total_batches)]
        results = await asyncio.gather(*tasks)

        successful = sum(1 for r in results if r)
        logger.info(
            "Simulation finished. Successfully sent %d/%d batches (%d readings total).",
            successful, total_batches, successful * batch_size,
        )


def main():
    parser = argparse.ArgumentParser(description="TerraForge Campus Sensor Simulator")
    parser.add_argument("--url", default="http://localhost:8000", help="Base URL of TerraForge API")
    parser.add_argument("--batch-size", type=int, default=100, help="Readings per batch")
    parser.add_argument("--total-batches", type=int, default=10, help="Total batches to send")
    parser.add_argument("--concurrency", type=int, default=5, help="Concurrent workers")
    parser.add_argument("--interval", type=float, default=0.2, help="Interval between batches (seconds)")

    args = parser.parse_args()
    asyncio.run(
        run_simulator(
            url=args.url,
            batch_size=args.batch_size,
            total_batches=args.total_batches,
            concurrency=args.concurrency,
            interval_seconds=args.interval,
        )
    )


if __name__ == "__main__":
    main()
