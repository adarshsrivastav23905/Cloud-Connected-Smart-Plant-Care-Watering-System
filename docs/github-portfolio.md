# GitHub Portfolio Checklist

## Before publishing

- [ ] Run `python -m pytest backend/tests`.
- [ ] Run `npm ci && npm run build` from `frontend/react-app`.
- [ ] Run `docker compose config` and, where Docker is available, `docker compose up --build`.
- [ ] Capture an actual full-page dashboard screenshot to `docs/screenshots/dashboard.png`.
- [ ] Verify `.env`, database files, credentials, and personal data are not staged.
- [ ] Confirm the README quick-start instructions from a clean clone.

## Repository presentation

Suggested repository description:

> A simulated IoT plant-care platform with a FastAPI backend, React dashboard, SQLite/Supabase storage, and Docker deployment.

Suggested topics: `cloud-computing`, `iot`, `fastapi`, `react`, `typescript`, `supabase`, `docker`, `smart-agriculture`.

In the README, lead with the dashboard screenshot and architecture, followed by a copy-paste quick start, API/data model, tests, security limitations, and the hardware extension. Add a short screen-recorded demo or deployed URL only after credentials and access controls are configured safely.

## Commit hygiene

- Use small descriptive commits, for example `feat: add React plant monitoring dashboard`.
- Never commit `.env`, Supabase database URLs, API tokens, local database files, or unrelated personal files.
- Enable GitHub Actions and protect the main branch with the CI workflow if desired.
- Include the license and clearly state that demo readings and actuator events are simulated.

## Suggested demo walkthrough

1. Start with `docker compose up --build`.
2. Show the dashboard and a device's latest sensor reading.
3. Wait for simulator updates and demonstrate trend/history refresh.
4. Change the soil threshold and show the API-backed setting.
5. Trigger/log a virtual watering event and show its history.
6. Explain SQLite versus Supabase PostgreSQL and the security limitations.
