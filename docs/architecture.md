# Architecture Overview

## System Flow

Plant / Virtual Plant
  ↓
Soil Moisture + Temperature + Humidity Sensors
  ↓
Python Sensor Simulator
  ↓
REST API (FastAPI)
  ↓
SQLite Database
  ↓
Automation Engine
  ↓
Watering Decision / Alert Generation
  ↓
Dashboard

## Components

### 1. Sensor Simulation Layer
The simulator generates realistic values without requiring hardware. It produces values that drift over time and responds to watering events.

### 2. Cloud Backend Layer
FastAPI exposes endpoints to register devices, accept sensor readings, store events, and return dashboard summaries.

### 3. Data Layer
SQLite stores device metadata, sensor readings, watering events, and alerts.

### 4. Decision Layer
The automation logic compares incoming moisture to a threshold and triggers watering or alert actions.

### 5. Frontend Layer
A lightweight browser dashboard reads the API and displays sensor health data using charts and cards.

## Benefits
- Simple local setup
- Great learning value
- Realistic cloud-IoT architecture
- Easy extension to a cloud-hosted deployment
