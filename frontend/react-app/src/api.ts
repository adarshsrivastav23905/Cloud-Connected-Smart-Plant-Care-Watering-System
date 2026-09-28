import type { Alert, DashboardSummary, Device, Reading, WateringEvent } from "./types";

const API_BASE_URL = (import.meta.env.VITE_API_BASE_URL || "/api/v1").replace(/\/$/, "");

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(detail || `Request failed (${response.status})`);
  }
  return response.json() as Promise<T>;
}

export const api = {
  devices: () => request<Device[]>("/devices"),
  dashboard: (deviceId: string) =>
    request<DashboardSummary>(`/dashboard/${encodeURIComponent(deviceId)}`),
  readings: (deviceId: string) =>
    request<Reading[]>(`/sensor-readings/${encodeURIComponent(deviceId)}?limit=100`),
  alerts: (deviceId: string) =>
    request<Alert[]>(`/alerts/${encodeURIComponent(deviceId)}`),
  events: (deviceId: string) =>
    request<WateringEvent[]>(`/watering-events/${encodeURIComponent(deviceId)}`),
  updateDevice: (deviceId: string, update: Partial<Device>) =>
    request<Device>(`/devices/${encodeURIComponent(deviceId)}`, {
      method: "PATCH",
      body: JSON.stringify(update),
    }),
  water: (deviceId: string, moisture: number | null) =>
    request<WateringEvent>("/watering-events", {
      method: "POST",
      body: JSON.stringify({
        device_id: deviceId,
        trigger_type: "manual",
        moisture_before: moisture,
        moisture_after: moisture === null ? null : Math.min(100, moisture + 20),
        duration_seconds: 15,
      }),
    }),
};
