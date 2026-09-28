from collections.abc import Iterator
import sys
from pathlib import Path

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.database import Base, get_db
from app.main import app


@pytest.fixture
def client() -> Iterator[TestClient]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    test_session = sessionmaker(autocommit=False, autoflush=False, bind=engine)

    def override_get_db():
        db = test_session()
        try:
            yield db
        finally:
            db.close()

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_low_moisture_reading_is_stored_and_triggers_watering(client: TestClient):
    device_id = "TEST-PLANT-001"
    registered = client.post(
        "/api/v1/devices",
        json={
            "device_id": device_id,
            "plant_name": "Test Basil",
            "moisture_threshold": 35,
            "watering_enabled": True,
        },
    )
    assert registered.status_code == 200

    received = client.post(
        "/api/v1/sensor-readings",
        json={
            "device_id": device_id,
            "soil_moisture": 20,
            "temperature": 24,
            "humidity": 55,
            "light_level": 60,
        },
    )
    assert received.status_code == 200

    dashboard = client.get(f"/api/v1/dashboard/{device_id}")
    assert dashboard.status_code == 200
    assert dashboard.json()["latest_reading"]["soil_moisture"] == 20
    assert dashboard.json()["watering_required"] is True

    events = client.get(f"/api/v1/watering-events/{device_id}")
    alerts = client.get(f"/api/v1/alerts/{device_id}")
    assert len(events.json()) == 1
    assert events.json()[0]["trigger_type"] == "low_moisture"
    assert len(alerts.json()) == 1


def test_disabled_automatic_watering_suppresses_events(client: TestClient):
    device_id = "TEST-PLANT-002"
    registered = client.post(
        "/api/v1/devices",
        json={
            "device_id": device_id,
            "plant_name": "Test Fern",
            "moisture_threshold": 35,
            "watering_enabled": False,
        },
    )
    assert registered.status_code == 200

    received = client.post(
        "/api/v1/sensor-readings",
        json={
            "device_id": device_id,
            "soil_moisture": 20,
            "temperature": 24,
            "humidity": 55,
        },
    )
    assert received.status_code == 200

    dashboard = client.get(f"/api/v1/dashboard/{device_id}")
    assert dashboard.status_code == 200
    assert dashboard.json()["watering_required"] is False
    assert client.get(f"/api/v1/watering-events/{device_id}").json() == []
