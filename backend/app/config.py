from __future__ import annotations

from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    app_name: str = "Smart Plant Care API"
    database_url: str = "sqlite:///./plant_data.db"
    api_v1_prefix: str = "/api/v1"
    cors_origins: str = "http://localhost:5173,http://localhost:8080"
    simulator_interval_seconds: int = 10
    moisture_threshold_default: int = 35
    alert_cooldown_seconds: int = 180

    model_config = SettingsConfigDict(env_file=".env", case_sensitive=False)


settings = Settings()
