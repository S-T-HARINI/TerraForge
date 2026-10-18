import random
from datetime import datetime, timezone
from locust import HttpUser, between, task


class SensorIngestionUser(HttpUser):
    wait_time = between(0.01, 0.1)

    @task(5)
    def send_batch(self):
        now = datetime.now(timezone.utc).isoformat()
        batch_size = random.choice([50, 100, 250, 500])
        sensor_type = random.choice(["temperature", "humidity", "co2", "noise", "power"])

        readings = [
            {
                "sensorId": f"sensor-{random.randint(1, 100):03d}",
                "type": sensor_type,
                "value": round(random.uniform(15.0, 45.0), 2),
                "timestamp": now,
            }
            for _ in range(batch_size)
        ]

        self.client.post(
            "/api/v1/readings/batch",
            json={"readings": readings},
            name="/api/v1/readings/batch",
        )

    @task(2)
    def send_single_reading(self):
        now = datetime.now(timezone.utc).isoformat()
        self.client.post(
            "/api/v1/readings",
            json={
                "sensorId": f"sensor-{random.randint(1, 100):03d}",
                "type": "temperature",
                "value": round(random.uniform(20.0, 30.0), 2),
                "timestamp": now,
            },
            name="/api/v1/readings",
        )

    @task(1)
    def check_health(self):
        self.client.get("/health", name="/health")

    @task(1)
    def list_alerts(self):
        self.client.get("/api/v1/alerts?limit=20", name="/api/v1/alerts")
