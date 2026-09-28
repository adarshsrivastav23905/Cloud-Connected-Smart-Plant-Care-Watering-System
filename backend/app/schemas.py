from __future__ import annotations

from datetime import datetime
from typing import Optional

from pydantic import BaseModel, Field


class DeviceCreate(BaseModel):
    device_id: str = Field(..., min_length=3, max_length=100)
    plant_name: str = Field(..., min_length=2, max_length=150)
    plant_type: str = "Herb"
    location: str = "Indoor"
    moisture_threshold: int = Field(default=35, ge=0, le=100)
    watering_enabled: bool = True


class DeviceUpdate(BaseModel):
    plant_name: Optional[str] = Field(default=None, min_length=2, max_length=150)
    plant_type: Optional[str] = Field(default=None, max_length=100)
    location: Optional[str] = Field(default=None, max_length=150)
    moisture_threshold: Optional[int] = Field(default=None, ge=0, le=100)
    watering_enabled: Optional[bool] = None


class SensorReadingCreate(BaseModel):
    device_id: str
    soil_moisture: float = Field(..., ge=0, le=100)
    temperature: float = Field(..., ge=-20, le=60)
    humidity: float = Field(..., ge=0, le=100)
    light_level: Optional[float] = Field(default=None, ge=0, le=100)
    timestamp: Optional[datetime] = None


class WateringEventCreate(BaseModel):
    device_id: str
    trigger_type: str
    moisture_before: Optional[float] = None
    moisture_after: Optional[float] = None
    duration_seconds: int = 0
    timestamp: Optional[datetime] = None


class AlertCreate(BaseModel):
    device_id: str
    alert_type: str
    message: str
    status: str = "open"


class DeviceOut(BaseModel):
    device_id: str
    plant_name: str
    plant_type: str
    location: str
    moisture_threshold: int
    watering_enabled: bool
    created_at: datetime


class SensorReadingOut(BaseModel):
    id: int
    device_id: str
    soil_moisture: float
    temperature: float
    humidity: float
    light_level: Optional[float]
    timestamp: datetime


class WateringEventOut(BaseModel):
    id: int
    device_id: str
    trigger_type: str
    moisture_before: Optional[float]
    moisture_after: Optional[float]
    duration_seconds: int
    timestamp: datetime


class AlertOut(BaseModel):
    id: int
    device_id: str
    alert_type: str
    message: str
    status: str
    created_at: datetime
