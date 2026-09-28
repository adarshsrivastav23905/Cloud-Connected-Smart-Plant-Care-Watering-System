FROM python:3.12-slim

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

WORKDIR /app
RUN pip install --no-cache-dir "httpx==0.27.2"
COPY sensor_simulator.py .

CMD ["python", "sensor_simulator.py", "--api-url", "http://backend:8000/api/v1/sensor-readings"]
