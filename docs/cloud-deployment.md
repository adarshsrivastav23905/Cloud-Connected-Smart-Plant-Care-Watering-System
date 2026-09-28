# Cloud Database and Deployment Guide

## Supabase PostgreSQL

The API uses SQLAlchemy and a private PostgreSQL connection to Supabase. Run `supabase/schema.sql` in the Supabase SQL Editor first. The DDL creates the application tables and device/time indexes expected by the backend.

Set the database URL in the hosting platform's backend environment, not in frontend code:

```dotenv
DATABASE_URL=postgresql://postgres.<project-ref>:<password>@<pooler-host>:5432/postgres?sslmode=require
CORS_ORIGINS=https://your-dashboard.example
```

The backend rewrites `postgresql://` to `postgresql+psycopg://`; psycopg 3 is in the requirements. Use the TLS connection details Supabase provides. Treat the connection URL as a password. It is not a `VITE_` variable and must never be exposed to browsers.

## Render deployment

`render.yaml` defines a Render Blueprint containing a Docker web service for FastAPI and a static site for the React app. Before the app can be deployed successfully:

1. Create a Supabase project and run `supabase/schema.sql`.
2. Connect the GitHub repository to Render and deploy its Blueprint.
3. Configure the API's `DATABASE_URL` with the private TLS-enabled Supabase PostgreSQL URL.
4. Configure the API's `CORS_ORIGINS` with the exact HTTPS dashboard origin.
5. Configure the dashboard's build-time `VITE_API_BASE_URL` with the API origin and `/api/v1` suffix.
6. Redeploy the frontend after changing its build-time variable.
7. Check `/api/v1/health` on the API service and load the dashboard.

Do not commit cloud secrets in `render.yaml`; `sync: false` intentionally leaves sensitive/runtime-specific values to be entered in Render's environment settings. Free service instances may sleep when idle; first requests can take longer to wake.

### Deployment shape

```text
Browser -> HTTPS dashboard hosting
Browser -> HTTPS FastAPI service -> Supabase PostgreSQL
Simulator / ESP32 -> HTTPS FastAPI service
```

1. Deploy the backend container from `backend/Dockerfile` to a container platform.
2. Configure `DATABASE_URL` and exact `CORS_ORIGINS` in its secret/environment settings.
3. Expose `/api/v1/health` as the platform's HTTP health check.
4. Deploy `frontend/react-app` from its Dockerfile, or build it with `npm ci && npm run build`.
5. Set build-time `VITE_API_BASE_URL` to `https://<api-host>/api/v1` when the dashboard and API use different origins.
6. Run the simulator as a worker/container with `--api-url https://<api-host>/api/v1/sensor-readings`.

For the included Compose topology, Nginx proxies `/api/*` to the backend on the internal Docker network; the browser sees one origin at `http://localhost:8081`.

### Database connection notes

- If the direct connection is unavailable from the hosting provider, use the Supabase session pooler URL shown in the project dashboard.
- Ensure TLS is enabled using the exact connection parameters shown by Supabase.
- On first startup, SQLAlchemy `create_all` will create missing tables; the provided SQL schema is recommended for explicit constraints and indexes.
- Back up production data and monitor connection limits before increasing simulator/device count.

## Security before public deployment

The current educational API intentionally has no user/device authentication. Before making it public:

- Add authentication and per-user device ownership checks to every API route.
- Give each physical device a rotatable credential; do not trust a client-provided device ID alone.
- Use TLS, rate limits, request size limits, and audit logs.
- Restrict `CORS_ORIGINS`; remember CORS does not prevent non-browser clients.
- Use a least-privilege database role and keep it private. Do not expose Supabase service-role keys or database credentials in frontend bundles.
- Enable appropriate Row Level Security policies if the browser is ever allowed to query Supabase directly.
- Validate real pump wiring, power isolation, tank-empty cutoff, and maximum run time independently of cloud commands.

## Local Docker troubleshooting

- `docker compose ps` shows service health.
- `docker compose logs -f backend simulator dashboard` streams logs.
- If port 8081 or 8000 is busy, edit the left side of the corresponding `ports` mapping in `docker-compose.yml`.
- Local data is stored in `plant-data`. `docker compose down -v` permanently removes that volume.
- If Supabase is selected, set its `DATABASE_URL` in `.env` and recreate the backend container with `docker compose up --build`.
