import { useCallback, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import {
  Activity,
  Bell,
  Check,
  ChevronDown,
  Clock3,
  Cloud,
  Droplets,
  Leaf,
  MapPin,
  RefreshCw,
  Settings2,
  Sprout,
  Sun,
  Thermometer,
  TriangleAlert,
  Wind,
} from "lucide-react";
import { api } from "./api";
import type { Alert, DashboardSummary, Device, Reading, WateringEvent } from "./types";

type RangeOption = "24 hours" | "7 days" | "30 days";

const rangeHours: Record<RangeOption, number> = {
  "24 hours": 24,
  "7 days": 24 * 7,
  "30 days": 24 * 30,
};

function formatTime(value: string) {
  return new Date(value).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
}

function formatDate(value: string) {
  return new Date(value).toLocaleString([], {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function App() {
  const [devices, setDevices] = useState<Device[]>([]);
  const [selectedId, setSelectedId] = useState("PLANT-001");
  const [summary, setSummary] = useState<DashboardSummary | null>(null);
  const [readings, setReadings] = useState<Reading[]>([]);
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [events, setEvents] = useState<WateringEvent[]>([]);
  const [range, setRange] = useState<RangeOption>("24 hours");
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");
  const [threshold, setThreshold] = useState(35);
  const [savingThreshold, setSavingThreshold] = useState(false);
  const [watering, setWatering] = useState(false);
  const [notice, setNotice] = useState("");

  const refresh = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true);
    setRefreshing(quiet);
    try {
      const availableDevices = await api.devices();
      setDevices(availableDevices);
      const activeId = availableDevices.some((device) => device.device_id === selectedId)
        ? selectedId
        : availableDevices[0]?.device_id;
      if (!activeId) {
        setSummary(null);
        setReadings([]);
        setAlerts([]);
        setEvents([]);
        setError("");
        return;
      }
      if (activeId !== selectedId) setSelectedId(activeId);
      const [dashboard, sensorReadings, deviceAlerts, wateringEvents] = await Promise.all([
        api.dashboard(activeId),
        api.readings(activeId),
        api.alerts(activeId),
        api.events(activeId),
      ]);
      setSummary(dashboard);
      setReadings(sensorReadings);
      setAlerts(deviceAlerts);
      setEvents(wateringEvents);
      setThreshold(dashboard.device.moisture_threshold);
      setError("");
    } catch (requestError) {
      setError(requestError instanceof Error ? requestError.message : "Unable to connect to API");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [selectedId]);

  useEffect(() => {
    void refresh();
    const timer = window.setInterval(() => void refresh(true), 15_000);
    return () => window.clearInterval(timer);
  }, [refresh]);

  useEffect(() => {
    if (!notice) return;
    const timer = window.setTimeout(() => setNotice(""), 3200);
    return () => window.clearTimeout(timer);
  }, [notice]);

  const latest = summary?.latest_reading ?? null;
  const activeDevice = devices.find((device) => device.device_id === selectedId);
  const chartReadings = useMemo(() => {
    const cutoff = Date.now() - rangeHours[range] * 60 * 60 * 1000;
    return readings
      .filter((reading) => new Date(reading.timestamp).getTime() >= cutoff)
      .slice()
      .reverse()
      .map((reading) => ({
        ...reading,
        label: formatTime(reading.timestamp),
      }));
  }, [readings, range]);

  async function handleWater() {
    if (!selectedId) return;
    setWatering(true);
    try {
      await api.water(selectedId, latest?.soil_moisture ?? null);
      setNotice("Virtual watering event recorded");
      await refresh(true);
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : "Watering action failed");
    } finally {
      setWatering(false);
    }
  }

  async function saveThreshold() {
    if (!selectedId || threshold < 0 || threshold > 100) return;
    setSavingThreshold(true);
    try {
      await api.updateDevice(selectedId, { moisture_threshold: threshold });
      setNotice("Moisture threshold saved");
      await refresh(true);
    } catch (requestError) {
      setNotice(requestError instanceof Error ? requestError.message : "Could not save threshold");
    } finally {
      setSavingThreshold(false);
    }
  }

  const statusText = error
    ? "API unavailable"
    : summary?.watering_required
      ? "Needs attention"
      : latest
        ? "Plant is thriving"
        : "Waiting for readings";

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <a className="brand" href="#" aria-label="Verdant home">
          <span className="brand-mark"><Sprout size={21} /></span>
          <span>verdant<span className="brand-dot">.</span></span>
        </a>

        <div className="workspace-label">WORKSPACE</div>
        <div className="workspace-switch">
          <span className="workspace-icon"><Leaf size={17} /></span>
          <span><strong>My greenhouse</strong><small>Personal space</small></span>
          <ChevronDown size={15} className="muted-icon" />
        </div>

        <div className="side-label">OVERVIEW</div>
        <nav className="side-nav">
          <a className="nav-item active" href="#overview"><Activity size={17} /> Dashboard</a>
          <a className="nav-item" href="#history"><Clock3 size={17} /> Sensor history</a>
          <a className="nav-item" href="#alerts"><Bell size={17} /> Alerts <span className="nav-count">{summary?.warning_count ?? 0}</span></a>
        </nav>

        <div className="plants-heading">
          <span className="side-label">YOUR PLANTS</span>
          <span className="plant-count">{devices.length}</span>
        </div>
        <div className="plant-list">
          {devices.map((device) => (
            <button
              className={`plant-item ${selectedId === device.device_id ? "selected" : ""}`}
              key={device.device_id}
              onClick={() => setSelectedId(device.device_id)}
            >
              <span className="plant-emoji">🌿</span>
              <span className="plant-name">{device.plant_name}</span>
              <span className="plant-dot" />
            </button>
          ))}
          {devices.length === 0 && !loading && (
            <p className="sidebar-empty">Start the simulator to register your first virtual plant.</p>
          )}
        </div>

        <div className="sidebar-bottom">
          <div className="cloud-status"><span className={`cloud-dot ${error ? "offline" : ""}`} /><Cloud size={15} /> {error ? "Disconnected" : "Cloud connected"}</div>
          <div className="profile">
            <div className="avatar">A</div>
            <div><strong>Plant keeper</strong><small>Local demo</small></div>
            <Settings2 size={17} className="muted-icon" />
          </div>
        </div>
      </aside>

      <main className="main-content" id="overview">
        <header className="topbar">
          <div className="breadcrumbs"><span>Workspace</span><span className="crumb-separator">/</span><strong>Dashboard</strong></div>
          <div className="topbar-actions">
            <span className="last-sync"><span className={`live-dot ${error ? "offline" : ""}`} /> {error ? "Offline" : "Live updates · 15 sec"}</span>
            <button className="icon-button" aria-label="Refresh dashboard" onClick={() => void refresh()} disabled={loading}>
              <RefreshCw size={17} className={refreshing ? "spin" : ""} />
            </button>
            <button className="notification-button" aria-label={`${summary?.warning_count ?? 0} alerts`} onClick={() => document.getElementById("alerts")?.scrollIntoView({ behavior: "smooth" })}>
              <Bell size={18} />
              {(summary?.warning_count ?? 0) > 0 && <span />}
            </button>
            <div className="avatar top-avatar">A</div>
          </div>
        </header>

        <div className="page-content">
          <section className="welcome-row">
            <div>
              <div className="eyebrow"><Sun size={14} /> MONDAY, YOUR GREENHOUSE IS LOOKING GOOD</div>
              <h1>Good morning, plant keeper <span>✦</span></h1>
              <p>Here’s what’s happening with your plants today.</p>
            </div>
            <button className="button button-primary" onClick={handleWater} disabled={!selectedId || watering || !latest}>
              <Droplets size={17} /> {watering ? "Recording..." : "Water plant"}
            </button>
          </section>

          {error && (
            <div className="error-banner" role="alert">
              <TriangleAlert size={18} />
              <div><strong>Can’t reach the plant API</strong><span>{error}. Check that the backend is running, then refresh.</span></div>
              <button onClick={() => void refresh()}>Try again</button>
            </div>
          )}

          {!error && devices.length === 0 && !loading && (
            <div className="empty-state">
              <span className="empty-icon"><Sprout size={29} /></span>
              <h2>Your greenhouse is ready to grow</h2>
              <p>No devices are registered yet. Start the Python simulator to create the demo plant and send synthetic sensor readings.</p>
              <code>python simulator/sensor_simulator.py</code>
            </div>
          )}

          {summary && (
            <>
              <section className="plant-banner">
                <div className="plant-avatar">🪴</div>
                <div className="plant-description">
                  <div className="plant-title-row"><h2>{summary.device.plant_name}</h2><span className={`health-pill ${summary.watering_required ? "warning" : "healthy"}`}><span />{statusText}</span></div>
                  <div className="plant-meta"><span><Sprout size={14} /> {activeDevice?.plant_type ?? "Plant"}</span><span><MapPin size={14} /> {summary.device.location}</span><span><Clock3 size={14} /> Added {activeDevice ? new Date(activeDevice.created_at).toLocaleDateString() : "recently"}</span></div>
                </div>
                <div className="device-selector">
                  <label htmlFor="device-select">DEVICE</label>
                  <select id="device-select" value={selectedId} onChange={(event) => setSelectedId(event.target.value)}>
                    {devices.map((device) => <option key={device.device_id} value={device.device_id}>{device.device_id}</option>)}
                  </select>
                </div>
              </section>

              <section className="metric-grid" aria-label="Latest sensor metrics">
                <MetricCard title="Soil moisture" value={latest ? `${latest.soil_moisture.toFixed(1)}%` : "--"} detail={`Target ${summary.device.moisture_threshold}%`} icon={<Droplets size={18} />} tone="green" progress={latest?.soil_moisture} status={summary.watering_required ? "Below target" : "Optimal"} />
                <MetricCard title="Temperature" value={latest ? `${latest.temperature.toFixed(1)}°` : "--"} detail="Air temperature" icon={<Thermometer size={18} />} tone="orange" status="Comfortable" />
                <MetricCard title="Humidity" value={latest ? `${latest.humidity.toFixed(0)}%` : "--"} detail="Air humidity" icon={<Wind size={18} />} tone="blue" status="In range" />
                <MetricCard title="Light level" value={latest?.light_level != null ? `${latest.light_level.toFixed(0)}%` : "--"} detail="Ambient light" icon={<Sun size={18} />} tone="yellow" status="Good exposure" />
              </section>

              <section className="content-grid">
                <article className="panel chart-panel" id="history">
                  <div className="panel-heading">
                    <div><h3>Plant conditions</h3><p>Sensor readings over time</p></div>
                    <select className="range-select" value={range} onChange={(event) => setRange(event.target.value as RangeOption)}>
                      {Object.keys(rangeHours).map((option) => <option key={option}>{option}</option>)}
                    </select>
                  </div>
                  <div className="chart-legend"><span><i className="legend-dot moisture" /> Soil moisture</span><span className="chart-live"><span className="live-dot" /> Live data</span></div>
                  <div className="chart-wrap">
                    {chartReadings.length > 0
                      ? <MoistureChart readings={chartReadings} />
                      : <div className="chart-empty">{loading ? "Loading sensor history…" : "Waiting for the first sensor reading…"}</div>}
                  </div>
                  <div className="chart-footnote"><span className="threshold-line" /> Watering threshold <strong>{summary.device.moisture_threshold}%</strong><span className="footnote-spacer" /> Updated {latest ? formatTime(latest.timestamp) : "—"}</div>
                </article>

                <article className="panel settings-panel">
                  <div className="panel-heading"><div><h3>Care settings</h3><p>Keep this plant in its happy place</p></div><span className="settings-icon"><Settings2 size={17} /></span></div>
                  <div className="setting-row"><div className="setting-icon green-soft"><Droplets size={17} /></div><div className="setting-copy"><strong>Moisture threshold</strong><span>Water below this level</span></div><div className="threshold-input"><input aria-label="Moisture threshold percentage" type="number" min="0" max="100" value={threshold} onChange={(event) => setThreshold(Number(event.target.value))} /><span>%</span></div></div>
                  <button className="button button-save" onClick={() => void saveThreshold()} disabled={savingThreshold || threshold === summary.device.moisture_threshold}>{savingThreshold ? "Saving…" : <><Check size={15} /> Save threshold</>}</button>
                  <div className="setting-divider" />
                  <div className="automation-card"><span className="automation-symbol"><Activity size={17} /></span><div><strong>Smart watering</strong><span>{activeDevice?.watering_enabled ? "Enabled · automatic moisture checks" : "Disabled for this plant"}</span></div><span className={`toggle-indicator ${activeDevice?.watering_enabled ? "on" : ""}`} aria-label={activeDevice?.watering_enabled ? "Enabled" : "Disabled"} /></div>
                  <p className="settings-note">Watering is simulated and logged as an event. This demo does not control a physical pump.</p>
                </article>
              </section>

              <section className="bottom-grid">
                <article className="panel activity-panel" id="alerts">
                  <div className="panel-heading"><div><h3>Recent alerts</h3><p>Plant health notifications</p></div><span className="count-pill">{alerts.filter((alert) => alert.status === "open").length} open</span></div>
                  {alerts.length === 0 ? <div className="small-empty"><span className="ok-icon"><Check size={16} /></span> No open alerts. Your plant is looking good.</div> : (
                    <div className="activity-list">{alerts.slice(0, 4).map((alert) => <AlertRow key={alert.id} alert={alert} />)}</div>
                  )}
                </article>
                <article className="panel activity-panel">
                  <div className="panel-heading"><div><h3>Watering activity</h3><p>Recent irrigation events</p></div><span className="watering-total"><Droplets size={14} /> {events.length} events</span></div>
                  {events.length === 0 ? <div className="small-empty"><span className="water-icon"><Droplets size={15} /></span> No watering events yet. Automatic decisions will appear here.</div> : (
                    <div className="activity-list">{events.slice(0, 4).map((event) => <EventRow key={event.id} event={event} />)}</div>
                  )}
                </article>
              </section>

              <footer className="page-footer"><span><span className="live-dot" /> All systems operational</span><span>Smart Plant Care · Demo environment · Synthetic sensor data</span></footer>
            </>
          )}
        </div>
      </main>

      {notice && <div className="toast" role="status"><Check size={17} /> {notice}</div>}
    </div>
  );
}

function MoistureChart({ readings }: { readings: Reading[] }) {
  const width = 680;
  const height = 210;
  const left = 38;
  const right = 12;
  const top = 12;
  const bottom = 27;
  const plotWidth = width - left - right;
  const plotHeight = height - top - bottom;
  const points = readings.map((reading, index) => ({
    x: left + (readings.length === 1 ? plotWidth / 2 : (index / (readings.length - 1)) * plotWidth),
    y: top + (1 - reading.soil_moisture / 100) * plotHeight,
    reading,
  }));
  const line = points.map((point, index) => `${index === 0 ? "M" : "L"}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(" ");
  const lastPoint = points[points.length - 1];
  const area = `${line} L${lastPoint.x.toFixed(1)},${(top + plotHeight).toFixed(1)} L${left},${(top + plotHeight).toFixed(1)} Z`;
  const labelIndexes = [...new Set([0, Math.floor((points.length - 1) / 3), Math.floor(((points.length - 1) * 2) / 3), points.length - 1])];

  return (
    <svg className="moisture-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label="Soil moisture history chart, in percent">
      <defs><linearGradient id="moisture-fill" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor="#43866b" stopOpacity=".2" /><stop offset="100%" stopColor="#43866b" stopOpacity=".015" /></linearGradient></defs>
      {[0, 25, 50, 75, 100].map((tick) => {
        const y = top + (1 - tick / 100) * plotHeight;
        return <g key={tick}><line x1={left} x2={width - right} y1={y} y2={y} stroke="#edf0ea" strokeDasharray={tick === 0 ? undefined : "0"} /><text x={left - 9} y={y + 3} textAnchor="end" fill="#8b948b" fontSize="10">{tick}</text></g>;
      })}
      <path d={area} fill="url(#moisture-fill)" />
      <path d={line} fill="none" stroke="#43866b" strokeWidth="2.5" vectorEffect="non-scaling-stroke" strokeLinejoin="round" strokeLinecap="round" />
      {points.map((point) => <circle key={point.reading.id} cx={point.x} cy={point.y} r="3" fill="#43866b"><title>{`${point.reading.soil_moisture.toFixed(1)}% · ${formatDate(point.reading.timestamp)}`}</title></circle>)}
      {labelIndexes.map((index) => <text key={`${index}-${points[index]?.reading.id}`} x={points[index]?.x} y={height - 7} textAnchor={index === 0 ? "start" : index === points.length - 1 ? "end" : "middle"} fill="#8b948b" fontSize="10">{points[index] ? formatTime(points[index].reading.timestamp) : ""}</text>)}
    </svg>
  );
}

function MetricCard({ title, value, detail, icon, tone, progress, status }: { title: string; value: string; detail: string; icon: ReactNode; tone: string; progress?: number; status: string }) {
  return (
    <article className="metric-card">
      <div className="metric-top"><span className={`metric-icon ${tone}`}>{icon}</span><span className={`metric-state ${tone}`}>{status}</span></div>
      <div className="metric-title">{title}</div>
      <div className="metric-value">{value}</div>
      <div className="metric-detail">{detail}</div>
      {progress !== undefined && <div className="moisture-track"><span style={{ width: `${Math.max(0, Math.min(100, progress))}%` }} /></div>}
    </article>
  );
}

function AlertRow({ alert }: { alert: Alert }) {
  return (
    <div className="activity-row">
      <span className="activity-icon alert-icon"><TriangleAlert size={16} /></span>
      <div className="activity-copy"><strong>{alert.alert_type.replaceAll("_", " ")}</strong><span>{alert.message}</span></div>
      <time>{formatDate(alert.created_at)}</time>
    </div>
  );
}

function EventRow({ event }: { event: WateringEvent }) {
  return (
    <div className="activity-row">
      <span className="activity-icon water-event-icon"><Droplets size={16} /></span>
      <div className="activity-copy"><strong>{event.trigger_type === "manual" ? "Manual watering" : "Automatic watering check"}</strong><span>{event.duration_seconds}s virtual watering · {event.moisture_before == null ? "Moisture unavailable" : `${event.moisture_before.toFixed(1)}% soil moisture`}</span></div>
      <time>{formatDate(event.timestamp)}</time>
    </div>
  );
}

export default App;
