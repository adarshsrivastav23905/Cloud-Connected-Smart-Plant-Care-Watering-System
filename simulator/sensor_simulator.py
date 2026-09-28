from __future__ import annotations

import argparse
import logging
import random
import time
from datetime import datetime
from typing import Optional

import httpx

logging.basicConfig(level=logging.INFO, format="%(asctime)s - %(levelname)s - %(message)s")
logger = logging.getLogger("plant-simulator")


class PlantSensorSimulator:
    def __init__(
        self,
        device_id: str = "PLANT-001",
        api_url: str = "http://localhost:8000/api/v1/sensor-readings",
        interval_seconds: int = 10,
        soil_moisture: float = 58.0,
        temperature: float = 26.0,
        humidity: float = 60.0,
        light_level: float = 55.0,
        device_threshold: int = 35,
        offline_mode: bool = False,
        max_retries: int = 3,
    ):
        self.device_id = device_id
        self.api_url = api_url
        self.interval_seconds = interval_seconds
        self.soil_moisture = soil_moisture
        self.temperature = temperature
        self.humidity = humidity
        self.light_level = light_level
        self.device_threshold = device_threshold
        self.offline_mode = offline_mode
        self.max_retries = max_retries
        self.last_water_time: Optional[datetime] = None

    def _next_light_level(self) -> float:
        hour = datetime.utcnow().hour
        if 6 <= hour <= 18:
            return max(0, min(100, 70 - abs(hour - 12) * 5 + random.uniform(-8, 8)))
        return max(0, min(100, 20 + random.uniform(-10, 10)))

    def _simulate_step(self) -> dict:
        hour_factor = 1 + (datetime.utcnow().hour / 24)
        self.soil_moisture = max(0, min(100, self.soil_moisture - random.uniform(0.2, 0.9) * (1.5 if self.last_water_time is None else 0.7)))

        if self.last_water_time and (datetime.utcnow() - self.last_water_time).total_seconds() < 25:
            self.soil_moisture += 0.8

        self.temperature = max(15, min(40, self.temperature + random.uniform(-0.6, 0.6) + (0.1 * (hour_factor - 0.8))))
        self.humidity = max(30, min(90, self.humidity + random.uniform(-1.2, 1.2) + (0.4 if self.temperature > 30 else -0.2)))
        self.light_level = self._next_light_level()

        if self.soil_moisture < self.device_threshold:
            self.soil_moisture = min(self.soil_moisture + random.uniform(0.8, 1.6), self.device_threshold + 8)

        return {
            "device_id": self.device_id,
            "soil_moisture": round(self.soil_moisture, 2),
            "temperature": round(self.temperature, 2),
            "humidity": round(self.humidity, 2),
            "light_level": round(self.light_level, 2),
            "timestamp": datetime.utcnow().isoformat(),
        }

    def send_reading(self, payload: dict) -> bool:
        if self.offline_mode:
            logger.info("Offline mode enabled - local log only: %s", payload)
            return True

        retries = 0
        while retries <= self.max_retries:
            try:
                response = httpx.post(self.api_url, json=payload, timeout=10)
                if response.status_code in (200, 201):
                    logger.info("Reading sent successfully: %s", payload)
                    return True
                logger.warning("API responded with %s: %s", response.status_code, response.text)
            except httpx.HTTPError as exc:
                logger.warning("Retry %s/%s failed: %s", retries + 1, self.max_retries + 1, exc)
            retries += 1
            if retries <= self.max_retries:
                time.sleep(2)
        logger.error("Failed to send reading after retries: %s", payload)
        return False

    def register_device(self) -> bool:
        if self.offline_mode:
            logger.info("Offline mode enabled - skipping device registration")
            return True

        devices_url = f"{self.api_url.rsplit('/', 1)[0]}/devices"
        payload = {
            "device_id": self.device_id,
            "plant_name": "Demo Basil",
            "plant_type": "Herb",
            "location": "Virtual greenhouse",
            "moisture_threshold": self.device_threshold,
            "watering_enabled": True,
        }
        for attempt in range(self.max_retries + 1):
            try:
                response = httpx.post(devices_url, json=payload, timeout=10)
                if response.status_code in (200, 201, 409):
                    logger.info("Device %s is registered", self.device_id)
                    return True
                logger.error("Device registration failed with %s: %s", response.status_code, response.text)
            except httpx.HTTPError as exc:
                logger.warning("Device registration attempt %s failed: %s", attempt + 1, exc)
            if attempt < self.max_retries:
                time.sleep(2 ** attempt)
        logger.error("Could not register device %s", self.device_id)
        return False

    def run(self):
        logger.info("Starting sensor simulator for device %s", self.device_id)
        if not self.register_device():
            raise RuntimeError(f"Could not register device {self.device_id} with the API")
        while True:
            payload = self._simulate_step()
            self.send_reading(payload)
            time.sleep(self.interval_seconds)


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Generate synthetic plant sensor data.")
    parser.add_argument("--device-id", default="PLANT-001")
    parser.add_argument("--api-url", default="http://localhost:8000/api/v1/sensor-readings")
    parser.add_argument("--interval", type=int, default=10)
    parser.add_argument("--offline", action="store_true", help="Log generated readings without calling the API.")
    args = parser.parse_args()
    if args.interval < 1:
        parser.error("--interval must be at least one second")
    simulator = PlantSensorSimulator(
        device_id=args.device_id,
        api_url=args.api_url,
        interval_seconds=args.interval,
        offline_mode=args.offline,
    )
    simulator.run()
