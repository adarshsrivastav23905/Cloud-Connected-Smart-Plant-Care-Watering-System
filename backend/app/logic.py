from __future__ import annotations

from datetime import datetime, timezone
from typing import Dict, Optional


def should_water(soil_moisture: float, threshold: int, min_soak: int = 10) -> bool:
    return soil_moisture < threshold and soil_moisture < 100


def evaluate_watering(soil_moisture: float, threshold: int) -> Dict[str, object]:
    watering_required = should_water(soil_moisture, threshold)
    return {
        "watering_required": watering_required,
        "trigger": "low_moisture" if watering_required else "healthy",
        "reason": f"Soil moisture {soil_moisture}% below threshold {threshold}%" if watering_required else "Soil moisture within safe range",
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "duration_seconds": 8 if watering_required else 0,
        "recommended_moisture_after": min(75, max(soil_moisture + 20, threshold + 10)) if watering_required else soil_moisture,
    }


def severity_for_alert(soil_moisture: float, humidity: float) -> str:
    if soil_moisture < 20:
        return "critical"
    if soil_moisture < 35 or humidity > 80:
        return "warning"
    return "info"


def generate_alert_message(device_id: str, soil_moisture: float, temperature: float, humidity: float) -> str:
    if soil_moisture < 20:
        return f"{device_id}: Soil moisture critically low ({soil_moisture}%). Watering is recommended immediately."
    if soil_moisture < 35:
        return f"{device_id}: Soil moisture is low ({soil_moisture}%). Consider watering soon."
    if humidity > 80:
        return f"{device_id}: Humidity is high ({humidity}%), monitor ventilation and avoid unnecessary watering."
    return f"{device_id}: Plant status is normal. Soil {soil_moisture}%, Temp {temperature}C, Humidity {humidity}%"
