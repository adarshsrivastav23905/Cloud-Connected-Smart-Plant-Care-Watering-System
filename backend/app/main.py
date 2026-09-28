from __future__ import annotations

from datetime import datetime, timezone
from typing import List, Optional

from fastapi import Depends, FastAPI, HTTPException, status
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session

from .config import settings
from .database import Base, engine, get_db
from .logic import evaluate_watering, generate_alert_message
from .models import Alert, Device, SensorReading, WateringEvent, utcnow
from .schemas import AlertCreate, AlertOut, DeviceCreate, DeviceOut, DeviceUpdate, SensorReadingCreate, SensorReadingOut, WateringEventCreate, WateringEventOut

Base.metadata.create_all(bind=engine)

app = FastAPI(title=settings.app_name, version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=[origin.strip() for origin in settings.cors_origins.split(",") if origin.strip()],
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
def root():
    return {"message": "Smart Plant Care API is running", "status": "ok"}


@app.get(f"{settings.api_v1_prefix}/health")
def healthcheck():
    return {"status": "healthy", "timestamp": datetime.now(timezone.utc).isoformat()}


@app.post(f"{settings.api_v1_prefix}/devices", response_model=DeviceOut)
def create_device(payload: DeviceCreate, db: Session = Depends(get_db)):
    existing = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail="Device already exists")

    device = Device(**payload.model_dump())
    db.add(device)
    db.commit()
    db.refresh(device)
    return device


@app.get(f"{settings.api_v1_prefix}/devices", response_model=List[DeviceOut])
def list_devices(db: Session = Depends(get_db)):
    return db.query(Device).order_by(Device.created_at.desc()).all()


@app.get(f"{settings.api_v1_prefix}/devices/{{device_id}}", response_model=DeviceOut)
def get_device(device_id: str, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    return device


@app.patch(f"{settings.api_v1_prefix}/devices/{{device_id}}", response_model=DeviceOut)
def update_device(device_id: str, payload: DeviceUpdate, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")
    for field, value in payload.model_dump(exclude_unset=True).items():
        setattr(device, field, value)
    db.commit()
    db.refresh(device)
    return device


@app.post(f"{settings.api_v1_prefix}/sensor-readings", response_model=SensorReadingOut)
def receive_reading(payload: SensorReadingCreate, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not registered")

    reading = SensorReading(
        device_id=payload.device_id,
        soil_moisture=payload.soil_moisture,
        temperature=payload.temperature,
        humidity=payload.humidity,
        light_level=payload.light_level,
        timestamp=payload.timestamp or utcnow(),
    )
    db.add(reading)
    db.commit()
    db.refresh(reading)

    watering_decision = evaluate_watering(payload.soil_moisture, device.moisture_threshold)
    if watering_decision["watering_required"] and device.watering_enabled:
        log_event(db, payload.device_id, "low_moisture", payload.soil_moisture, None, int(watering_decision["duration_seconds"]))
        create_alert(db, payload.device_id, "low_moisture", generate_alert_message(payload.device_id, payload.soil_moisture, payload.temperature, payload.humidity))

    return reading


@app.get(f"{settings.api_v1_prefix}/sensor-readings/{{device_id}}", response_model=List[SensorReadingOut])
def list_sensor_readings(device_id: str, limit: int = 20, db: Session = Depends(get_db)):
    query = db.query(SensorReading).filter(SensorReading.device_id == device_id).order_by(SensorReading.timestamp.desc())
    if limit > 0:
        query = query.limit(limit)
    return query.all()


@app.post(f"{settings.api_v1_prefix}/watering-events", response_model=WateringEventOut)
def register_watering_event(payload: WateringEventCreate, db: Session = Depends(get_db)):
    device = db.query(Device).filter(Device.device_id == payload.device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not registered")

    event = WateringEvent(
        device_id=payload.device_id,
        trigger_type=payload.trigger_type,
        moisture_before=payload.moisture_before,
        moisture_after=payload.moisture_after,
        duration_seconds=payload.duration_seconds,
        timestamp=payload.timestamp or utcnow(),
    )
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


@app.get(f"{settings.api_v1_prefix}/watering-events/{{device_id}}", response_model=List[WateringEventOut])
def list_watering_events(device_id: str, limit: int = 20, db: Session = Depends(get_db)):
    query = db.query(WateringEvent).filter(WateringEvent.device_id == device_id).order_by(WateringEvent.timestamp.desc())
    if limit > 0:
        query = query.limit(limit)
    return query.all()


@app.post(f"{settings.api_v1_prefix}/alerts", response_model=AlertOut)
def create_alert_route(payload: AlertCreate, db: Session = Depends(get_db)):
    alert = create_alert(db, payload.device_id, payload.alert_type, payload.message, payload.status)
    return alert


@app.get(f"{settings.api_v1_prefix}/alerts/{{device_id}}", response_model=List[AlertOut])
def list_alerts(device_id: str, db: Session = Depends(get_db)):
    return db.query(Alert).filter(Alert.device_id == device_id).order_by(Alert.created_at.desc()).all()


@app.get(f"{settings.api_v1_prefix}/dashboard/{{device_id}}")
def dashboard_summary(device_id: str, db: Session = Depends(get_db)):
    latest = db.query(SensorReading).filter(SensorReading.device_id == device_id).order_by(SensorReading.timestamp.desc()).first()
    recent = db.query(SensorReading).filter(SensorReading.device_id == device_id).order_by(SensorReading.timestamp.desc()).limit(5).all()
    device = db.query(Device).filter(Device.device_id == device_id).first()
    if not device:
        raise HTTPException(status_code=404, detail="Device not found")

    alert_count = db.query(Alert).filter(Alert.device_id == device_id, Alert.status == "open").count()
    decision = evaluate_watering(latest.soil_moisture, device.moisture_threshold) if latest else {"watering_required": False}

    return {
        "device": {"device_id": device.device_id, "plant_name": device.plant_name, "location": device.location, "moisture_threshold": device.moisture_threshold},
        "latest_reading": latest,
        "recent_readings": recent,
        "warning_count": alert_count,
        "watering_required": device.watering_enabled and decision.get("watering_required", False),
        "status": "healthy" if latest and not (device.watering_enabled and decision.get("watering_required", False)) else "needs_attention",
    }


def create_alert(db: Session, device_id: str, alert_type: str, message: str, status: str = "open") -> Alert:
    alert = Alert(device_id=device_id, alert_type=alert_type, message=message, status=status)
    db.add(alert)
    db.commit()
    db.refresh(alert)
    return alert


def log_event(db: Session, device_id: str, trigger_type: str, moisture_before: Optional[float], moisture_after: Optional[float], duration_seconds: int) -> WateringEvent:
    event = WateringEvent(device_id=device_id, trigger_type=trigger_type, moisture_before=moisture_before, moisture_after=moisture_after, duration_seconds=duration_seconds)
    db.add(event)
    db.commit()
    db.refresh(event)
    return event


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True)
