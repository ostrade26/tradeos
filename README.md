# TradeOS

Trading operations app with a **React** frontend and **Python (FastAPI)** backend.

## Architecture

- **Frontend** — React + Vite + TypeScript (`src/`)
- **Backend** — FastAPI + SQLite JSON store (`backend/app/`)
- **API** — REST under `/api/v1/`; Vite dev server proxies `/api` → `http://127.0.0.1:8000`

Business logic (orders, lifts, allocations, directory CRUD) lives in the Python `TradeService`. The React `TradeStore` is a thin client that loads state from the API and applies mutations via REST.

## Prerequisites

- Node.js 20+
- Python 3.11+

## Backend setup

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
uvicorn app.main:app --reload --host 127.0.0.1 --port 8000
```

Or from the repo root:

```bash
npm run dev:backend
```

Data is stored in `backend/data/trade.db`. On first load, if the database is empty, the frontend auto-seeds demo data via `POST /api/v1/admin/seed`.

## Frontend setup

```bash
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173). Ensure the backend is running on port 8000.

## Marketing website

Public landing page (hero, product story, demo request) lives in `marketing/` and shares the root React + Tailwind dependencies.

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

**Verify both are running and all API routes are reachable:**

```bash
npm run verify:local
```

The UI shows a red banner if the Python API goes offline. All data mutations from the app go through `/api/v1/*` on the FastAPI backend.

## Browser support

TradeOS targets **modern evergreen browsers** on desktop and mobile:

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

## Admin

From **Settings** in the app:

- **Load demo data** — `POST /api/v1/admin/seed`
- **Clear all data** — `POST /api/v1/admin/reset`
# tradeos
