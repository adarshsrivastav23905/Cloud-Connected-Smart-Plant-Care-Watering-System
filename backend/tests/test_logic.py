import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from app.logic import evaluate_watering, generate_alert_message, severity_for_alert, should_water


def test_watering_decision_uses_configured_threshold():
    assert should_water(29.9, 30)
    assert not should_water(30, 30)
    assert not should_water(82, 30)


def test_evaluation_includes_virtual_actuator_recommendation():
    decision = evaluate_watering(25, 35)
    assert decision["watering_required"] is True
    assert decision["trigger"] == "low_moisture"
    assert decision["duration_seconds"] > 0
    assert decision["recommended_moisture_after"] > 25


def test_alert_severity_tracks_moisture_risk():
    assert severity_for_alert(18, 50) == "critical"
    assert severity_for_alert(30, 50) == "warning"
    assert severity_for_alert(55, 50) == "info"
    assert "critically low" in generate_alert_message("PLANT-001", 18, 25, 50)
