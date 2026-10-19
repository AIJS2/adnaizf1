# F1 Dashboard & Telemetry — agent notes

Git root is `adnaizf1/`; the app lives under `F1-Fullstack-project/`:

- `Backend/` — FastAPI app (`main.py`, `routers/`, `services/`, `config/`, `scripts/`)
- `frontend/` — React 19 + Vite + TypeScript (vitest, eslint)
- `docker-compose.yml` — Redis (6379), backend (8000), frontend (5173)
- `prisma/` — schema + seed; the app reads FastF1/OpenF1, not the seeded SQL DB

The only real frontend manifest + lockfile live in `F1-Fullstack-project/frontend/` — always install/run there. (The vestigial root `package.json`/`package-lock.json` were removed.)

## Prerequisites
- Node.js 18/20 LTS + npm, Python 3.10+, Redis on `localhost:6379` (or `docker compose up -d redis` from `F1-Fullstack-project/`).
- `.env` is gitignored — create from the committed `.env.example` files:
  - `Backend/.env` from `Backend/.env.example` (`REDIS_URL`, `SENTRY_DSN`, `ENVIRONMENT`, `CORS_ORIGINS`)
  - `frontend/.env` from `frontend/.env.example` (`VITE_API_URL=http://localhost:8000`)
  - Vite also loads gitignored `frontend/.env.local` if present.

## Backend — run from `F1-Fullstack-project/Backend/`
```bash
python -m venv venv
source venv/bin/activate   # or .\venv\Scripts\activate on Windows
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
- `main.py` runs `setup_observability()` at import: `load_dotenv()` reads `.env` from CWD, Sentry starts only if `SENTRY_DSN` is set, Redis is pinged at import (degrades to a file cache under `Backend/cache/`), and logs go to `logs/app.log` relative to CWD. **Launch uvicorn from `Backend/`** so dotenv, logs, and relative paths resolve.
- `GET /health` → `{"status": "ok", "cache": {"connected": true}}` or `degraded` when Redis is down; the app still works.
- Every router in `routers/` is mounted in `main.py`, including `team_radio.py` → `GET /api/team_radio` works (not a 404).
- SlowAPI rate limiting is active; FastF1 keeps an on-disk cache at `Backend/cache/` (~500 calls/hour — repeated uncached refreshes are rate-limited).
- `GET /api/clear_cache/{year}` is the only destructive endpoint; it requires an `X-API-Key` header matching `API_KEY` (`utils/auth.py`). Public read endpoints stay open.
- No pytest suite exists. Edge-case sweep: `python tests_chaos_probe.py` (standalone TestClient, not pytest; hits the network and FastF1 — 429s are notes, not failures).
- `Backend/scripts/seed_standings.py` writes `f1_stats.db` (gitignored); not used by the running app.

## Frontend — run from `F1-Fullstack-project/frontend/`
```bash
npm ci            # lockfile-driven, preferred over npm install
npm run dev       # Vite on :5173
npm run build
npm run lint      # eslint flat config
npm run typecheck # tsc --noEmit (strict)
npm run test      # vitest run (jsdom; setupTests.js imports @testing-library/jest-dom)
npm run test -- src/App.test.tsx   # single test file
npm run test -- --watch | --coverage
```
- `src/config.ts`: `VITE_API_URL` env var, fallback `http://127.0.0.1:8000` in dev.
- Tests are colocated (`*.test.tsx`, `__tests__/` dirs).

## Running the stack
Order matters: Redis → backend → frontend.
```bash
docker compose up -d            # full stack, from F1-Fullstack-project/
# or manual:
redis-server
uvicorn main:app --reload       # from Backend/
npm run dev                     # from frontend/
```
Swagger UI: `http://localhost:8000/docs`. App: `http://localhost:5173`.

## Verification before pushing
```bash
cd F1-Fullstack-project/frontend
npm run typecheck && npm run lint && npm run test   # same order as CI
```
Backend: start uvicorn and check `GET /health`.

## CI
`.github/workflows/ci.yml` lives at the repo root (`adnaizf1/.github/workflows/` — GitHub only reads workflows there) and runs on push/PR to `main`:
- **frontend** job (`working-directory: ./F1-Fullstack-project/frontend`): Node 20 → `npm ci` → lint → typecheck → test → build
- **backend** job (`working-directory: ./F1-Fullstack-project/Backend`): Python 3.11 → `ruff` → `compileall` (syntax) → `ruff check --select E9,F63,F7,F82`
