# Tradeal

Trading operations app with a **React** frontend and **Python (FastAPI)** backend.

```
tradeal/
  frontend/    React + Vite + TypeScript (app + marketing site) — deploy on Vercel
  backend/     FastAPI — deploy on Railway (Postgres in production, SQLite locally)
```

## Architecture

- **Frontend** — React + Vite + TypeScript (`frontend/src/`)
- **Backend** — FastAPI (`backend/app/`)
- **API** — REST under `/api/v1/`; Vite dev server proxies `/api` → `http://127.0.0.1:8000`
- **Data** — SQLite at `backend/data/trade.db` locally; Railway Postgres when `DATABASE_URL` is set

Business logic (orders, lifts, allocations, directory CRUD) lives in the Python `TradeService`. The React `TradeStore` is a thin client that loads state from the API and applies mutations via REST.

## Prerequisites

- Node.js 20.19+ or 22+ (Vite 8)
- Python 3.9+ locally (3.12 on Railway)

## Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
./run.sh
```

Or from the repo root / `frontend/`:

```bash
npm run dev:backend
```

Data is stored in `backend/data/trade.db`. On first load, if the database is empty, the frontend auto-seeds demo data via `POST /api/v1/admin/seed`.

## Frontend setup

```bash
cd frontend
npm install
```

Then from the repo root or `frontend/`:

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Ensure the backend is running on port 8000.

## Marketing website

Public landing page (hero, product story, demo request) lives in `frontend/marketing/` and shares the React + Tailwind dependencies in `frontend/`.

```bash
npm run dev:backend    # API on :8000 — needed for the demo form
npm run dev:marketing   # site on :5174
```

Open [http://localhost:5174](http://localhost:5174). Demo requests are stored in SQLite (`demo_requests`) via `POST /api/v1/demo-requests`.

```bash
npm run build:marketing
```

**API docs (Swagger):** [http://localhost:8000/docs](http://localhost:8000/docs)
Also available: [ReDoc](http://localhost:8000/redoc) · [OpenAPI JSON](http://localhost:8000/openapi.json) · shortcut [http://localhost:8000/swagger](http://localhost:8000/swagger)

Optional: set `VITE_API_URL` if the API is hosted elsewhere (defaults to `/api/v1`).

## Development

**Start both servers (recommended):**

```bash
npm run dev:all
```

Or in separate terminals:

```bash
npm run dev:backend   # terminal 1 — API on :8000
npm run dev           # terminal 2 — UI on :5173
```

These scripts also work from `frontend/` (`cd frontend && npm run dev:all`).

**Verify both are running and all API routes are reachable:**

```bash
npm run verify:local
```

The UI shows a red banner if the Python API goes offline. All data mutations from the app go through `/api/v1/*` on the FastAPI backend.

## Browser support

Tradeal targets **modern evergreen browsers** on desktop and mobile:

| Platform | Browsers |
|----------|----------|
| **Desktop** | Chrome, Firefox, Safari, Microsoft Edge (current + previous major version) |
| **Mobile** | iOS Safari 15+, Chrome for Android |
| **OS** | Windows, macOS, Linux, iOS, Android |

**Not supported:** Internet Explorer 11 (React 19 / Vite require modern JavaScript).

Cross-platform notes:

- Works over **LAN HTTP** (`http://192.168.x.x:5173`) — UUID and auth use safe fallbacks when the browser blocks secure APIs.
- **Safari private mode** — preferences (theme, table density, sort) degrade gracefully if storage is unavailable.
- **iOS / Android** — viewport height uses `100vh` with `100dvh` enhancement; modals use scroll lock to prevent background bleed.

## Build

```bash
npm run build
```

## Deploy

```
Browser  →  Vercel (React)  →  Railway (FastAPI)  →  Postgres
              frontend/         backend/             Railway plugin
```

**Database:** SQLite locally (`backend/data/trade.db`). **Postgres on Railway** — Railway’s disk is ephemeral, so SQLite would lose every PO/SO on deploy. Do not run production on SQLite.

The browser calls the Railway API using `VITE_API_URL` (baked in at Vercel **build** time).

### 1. Railway — API + Postgres

1. Create a [Railway](https://railway.app) project and add a **GitHub** service from this repo.
2. Set the service **Root Directory** to `backend`.
3. Add a **PostgreSQL** plugin to the same project.
4. On the API service, set variables:

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (reference the Postgres plugin) |
   | `CORS_ORIGINS` | `https://your-app.vercel.app` (add a custom domain later if you use one) |
   | `TRADEAL_USERS` | `admin:change-me:admin:Admin` (seeded **once** when `users` is empty; use strong passwords) |
   | `TRADEAL_PLATFORM_ADMIN` | `platform:change-me:Tradeal Admin` (optional; platform login for org/user APIs) |

5. Generate a public domain on the API service (`xxx.up.railway.app`).
6. Confirm `GET https://xxx.up.railway.app/api/v1/health` returns `{"status":"ok","db":"postgres"}`.

On the **first deploy** after the org/RBAC update, the API runs a migration: existing Postgres `trade_state` moves into organisation **“Existing Tradeal Organisation”**; env users become DB users with roles. Everyone must **sign in again** (sessions are DB-backed now).

`backend/Dockerfile` and `backend/railway.toml` define the start command and health check. Locally, leave `DATABASE_URL` unset so SQLite is still used.

### 2. Vercel — frontend

1. Import this repo in [Vercel](https://vercel.com). Root `vercel.json` already points install/build/output at `frontend/`.
2. Add an environment variable for **Production** and **Preview**:

   | Name | Value |
   |---|---|
   | `VITE_API_URL` | `https://xxx.up.railway.app/api/v1` |

   Vite only reads `VITE_*` vars at **build** time. After changing this, redeploy the frontend.

3. Deploy. Deep links (`/orders`, `/lifts/new`, …) rewrite to `index.html`.
4. Copy the Vercel URL into Railway `CORS_ORIGINS` if you use a custom domain. `*.vercel.app` hosts are already allowed.

### 3. First login

Open the Vercel URL (e.g. [trade-os5/tradeal on Vercel](https://vercel.com/trade-os5/tradeal)) and sign in with your **Organisation Admin** account from `TRADEAL_USERS`.

- **Load demo / clear all data** — Tradeal platform admin only (`TRADEAL_PLATFORM_ADMIN`), not org admins.
- **Create organisations or users** — platform admin via [Railway API Swagger](https://your-service.up.railway.app/docs) → `/api/v1/platform/*`, not the customer UI.

### Checklists

- [ ] Railway health is `ok` and `"db":"postgres"`
- [ ] Vercel build succeeds (`frontend` `npm run build`)
- [ ] Browser network tab: UI calls `https://…railway.app/api/v1/…` (not `/api/v1` on Vercel)
- [ ] Login works; `/auth/me` returns `permissions`, `organisationName`
- [ ] Creating a PO persists after a Railway redeploy
- [ ] Operator can create but not edit POs (403 on PATCH)

## Admin

From **Settings** in the app:

- **Load demo data** — `POST /api/v1/admin/seed`
- **Clear all data** — `POST /api/v1/admin/reset`
