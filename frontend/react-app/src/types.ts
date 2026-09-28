export interface Device {
  device_id: string;
  plant_name: string;
  plant_type: string;
  location: string;
  moisture_threshold: number;
  watering_enabled: boolean;
  created_at: string;
}

export interface Reading {
  id: number;
  device_id: string;
  soil_moisture: number;
  temperature: number;
  humidity: number;
  light_level: number | null;
  timestamp: string;
}

export interface Alert {
  id: number;
  device_id: string;
  alert_type: string;
  message: string;
  status: string;
  created_at: string;
}

export interface WateringEvent {
  id: number;
  device_id: string;
  trigger_type: string;
  moisture_before: number | null;
  moisture_after: number | null;
  duration_seconds: number;
  timestamp: string;
}

export interface DashboardSummary {
  device: Pick<Device, "device_id" | "plant_name" | "location" | "moisture_threshold">;
  latest_reading: Reading | null;
  recent_readings: Reading[];
  warning_count: number;
  watering_required: boolean;
  status: string;
}
