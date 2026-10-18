import random
from datetime import datetime, timezone
from typing import Any

SENSOR_TYPES = {
    "temperature": {"min": 18.0, "max": 28.0, "spike_min": 35.0, "spike_max": 50.0},
    "humidity": {"min": 30.0, "max": 60.0, "spike_min": 75.0, "spike_max": 95.0},
    "co2": {"min": 400.0, "max": 900.0, "spike_min": 1200.0, "spike_max": 2500.0},
    "noise": {"min": 35.0, "max": 70.0, "spike_min": 85.0, "spike_max": 120.0},
    "power": {"min": 100.0, "max": 500.0, "spike_min": 800.0, "spike_max": 1500.0},
}

DEFAULT_SENSORS = [
    "sensor-lib-01",
    "sensor-lib-02",
    "sensor-lab-01",
    "sensor-lab-02",
    "sensor-hall-01",
    "sensor-hall-02",
    "sensor-dorm-01",
    "sensor-dorm-02",
]


def generate_single_reading(
    sensor_id: str | None = None,
    reading_type: str | None = None,
    force_spike: bool = False,
    timestamp: datetime | None = None,
) -> dict[str, Any]:
    selected_type = reading_type or random.choice(list(SENSOR_TYPES.keys()))
    config = SENSOR_TYPES[selected_type]

    if force_spike or random.random() < 0.05:
        value = round(random.uniform(config["spike_min"], config["spike_max"]), 2)
    else:
        value = round(random.uniform(config["min"], config["max"]), 2)

    return {
        "sensorId": sensor_id or random.choice(DEFAULT_SENSORS),
        "type": selected_type,
        "value": value,
        "timestamp": (timestamp or datetime.now(timezone.utc)).isoformat(),
    }


def generate_reading_batch(
    count: int = 100,
    spike_ratio: float = 0.05,
    sensor_ids: list[str] | None = None,
    reading_type: str | None = None,
) -> list[dict[str, Any]]:
    sensors = sensor_ids or DEFAULT_SENSORS
    now = datetime.now(timezone.utc)

    batch = []
    for _ in range(count):
        force_spike = random.random() < spike_ratio
        sensor = random.choice(sensors)
        reading = generate_single_reading(
            sensor_id=sensor,
            reading_type=reading_type,
            force_spike=force_spike,
            timestamp=now,
        )
        batch.append(reading)

    return batch
