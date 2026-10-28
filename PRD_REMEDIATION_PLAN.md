# PRD — Remediation Plan for `adnaizf1` (F1 Dashboard & Telemetry)

Status: **DRAFT — awaiting human approval before Phase 2 (implementation)**
Source of truth: [`AUDIT_REPORT.md`](./AUDIT_REPORT.md)
Scope: `F1-Fullstack-project/Backend`, `F1-Fullstack-project/frontend`, `docker-compose.yml`, nginx, CI, docs.

> This document specifies the engineering work to close every remaining `⏳` (deferred) item and the housekeeping debt. It does **not** re-open items already fixed and verified: `C1`, `C1a`, `C2` (standings caching), `C3`, `H1`, `H2`, `H3`, `H4`, `H5`, `H6`, `H7`, `H8`, `M1` (round 1–25 loop), `M2`, `M3`, `M4`.

---

## 1. Executive Summary & Objectives

### 1.1 Goal
Resolve all remaining deferred items and housekeeping debt with **zero regressions** against the current green baseline, while:
- preserving the already-fixed items untouched in intent (only touching them where a follow-up explicitly extends them, e.g. `clear_cache`);
- never deleting `fastf1/` or `fastf1_http_cache.sqlite`;
- never committing secrets, and keeping `_safe_redis_url()` sanitization in place.

### 1.2 Baseline verification gates (must stay 100% green after every wave)

```bash
# Backend (from F1-Fullstack-project/Backend)
python -m compileall -q main.py config routers services utils
ruff check --select E9,F63,F7,F82 .
python -m unittest discover -s tests -v   # 37/37

# Frontend (from F1-Fullstack-project/frontend)
npm run typecheck && npm run lint && npm run test && npm run build   # 167/167, build clean
```

### 1.3 Rollback triggers
- Any failing gate ⇒ halt, identify the diff, and revert the offending change before proceeding.
- Backend test count drops below 37, or frontend below 167, ⇒ block the wave.
- `git diff` touching `fastf1/` or `fastf1_http_cache.sqlite` ⇒ abort (guardrail).
- Any log line leaking a credential ⇒ abort.

### 1.4 Definition of Done
Each item ships with: code change, an added/updated test, and a re-run of the applicable gate. Waves are reviewed and merged independently; no wave lands partially.

---

## 2. Phased Implementation Specifications

Each item: **(a) Root cause & files/lines**, **(b) proposed design**, **(c) contract impact**, **(d) acceptance criteria & tests**.

---

### Wave 1 — Security, Housekeeping & Isolated Quick Fixes (Low Risk)

#### W1.1 — Secret & config cleanup
- **(a) Root cause**
  - `F1-Fullstack-project/opencode.json` is **tracked** and contains a local `apiKey` (`sk-9router`) and `baseURL http://localhost:20128` (dev tool config, irrelevant to the app).
  - `F1-Fullstack-project/.github/workflows/ci.yml` is a dead, broken duplicate (GitHub only reads `.github/workflows` at repo root; this copy uses wrong `working-directory: frontend`, `Backend/requirements.txt` paths, and `black --check` with `black` not installed).
  - `F1-Fullstack-project/nginx/nginx.conf` is unused by compose (frontend image copies `frontend/nginx.conf`) and has drifted: no security headers, `client_max_body_size 50m`.
- **(b) Design**
  1. `git rm --cached F1-Fullstack-project/opencode.json` and add it to `.gitignore` (repo root and/or `F1-Fullstack-project/.gitignore`). Keep the local file on disk for whoever uses the tool; it simply stops being versioned.
  2. Delete `F1-Fullstack-project/.github/workflows/ci.yml` (and its empty parent dir if orphaned).
  3. Delete `F1-Fullstack-project/nginx/nginx.conf`; retain `frontend/nginx.conf` as the single Nginx source.
- **(c) Contract impact**: none (build/runtime unaffected).
- **(d) Acceptance**: `git ls-files` no longer lists `opencode.json` or the duplicate workflow; `nginx/nginx.conf` removed; frontend build unaffected.

#### W1.2 — H10: secure `GET /api/livetiming/previous`
- **(a) Root cause** — `Backend/routers/livetiming.py:766-792`: endpoint is unauthenticated and carries no `@limiter.limit`; it calls `_ensure_signalr()` (starts the upstream daemon), then busy-waits up to `_LIVE_DATA_WAIT_SECONDS` (8 s) **while holding the global `_init_lock`** (`:781`), serialising every WebSocket handshake; the feed only stops when `not _state.is_live` (`:787-789`), which is never true right after connect, so an anonymous GET can leave a permanent upstream WebSocket.
- **(b) Design**
  1. Add `@limiter.limit("60/minute")` to the route (matches sibling read endpoints).
  2. Do not hold `_init_lock` across the 8 s wait. Split the path into: (i) a short locked section that checks/starts the broadcast state, and (ii) an unlocked `await` polling loop with a `try/finally` that guarantees `_stop_signalr()` runs when no WS clients remain.
  3. Make upstream teardown explicit: when the previous-session probe finishes and `_connected_clients` is empty, always `_stop_signalr()` (and reset transient state).
  4. Optional auth: keep the endpoint public but rate-limited (matches the public-read posture documented in `AGENTS.md`); note in code comment that auth can be gated behind `require_api_key` if desired. **Decision point for reviewer.**
- **(c) Contract impact**: response shape unchanged; new 429 under burst. No `401` unless reviewer opts into auth.
- **(d) Acceptance**: unit test asserts (i) a burst > limit returns 429; (ii) two concurrent WS handshakes are not serialised behind a previous-session probe (mock `_state.timing_data` and measure/assert lock is not held during the wait); (iii) after a timeout with no clients, `_stop_signalr` was called.

#### W1.3 — M9: normalise schedule-cache shape
- **(a) Root cause** — `livetiming.py:134-158` fallback reads `data.get("races", [])`, but `races_service.py:147` writes a **bare list**. `data.get(...)` on a list raises `AttributeError`, swallowed at `:157`, so the offline schedule fallback never works.
- **(b) Design** — in the fallback block, accept both shapes:
  ```python
  races = data.get("races") if isinstance(data, dict) else data
  races = races or []
  ```
- **(c) Contract impact**: none.
- **(d) Acceptance**: unit test feeding a list-shaped `all_races_cache_{year}.json` returns a populated schedule; dict-shaped still works.

#### W1.4 — M7: chronological team attribution
- **(a) Root cause** — `dashboard_service.py:182` and `championship_service.py:227` use `agg(team=("TeamName","last"))` after grouping by `FullName`, but the concatenated frames are **not ordered by round/session**, so `"last"` (pandas row order) can attribute a mid-season transfer to the wrong team.
- **(b) Design** — before grouping, sort by (`RoundNumber`, then a stable session order `R` before `Sprint`); keep `"last"` (now correct) or switch to an explicit "team at max round" reduction for clarity. Apply consistently in both services.
- **(c) Contract impact**: `driver_standings[].team` (dashboard) and `drivers[].team` (championship) now reflect the driver's actual latest team. Consumers already render this field; no schema change.
- **(d) Acceptance**: unit test where a synthetic driver appears for two teams across two rounds; assert `team` equals the team at the **higher** round.

#### W1.5 — M10: scraper source marker + graceful non-numeric cells
- **(a) Root cause** — `scraper.py:207-244` overlays points only on **exact name match** with no provenance marker, and `float(cols[2].text)` / `float(cols[4].text)` (`:165`, `:179`) raise on a non-numeric cell, which is caught by the broad outer `except` and aborts the **whole** scrape (falling back to the stale snapshot).
- **(b) Design**
  1. Wrap per-cell parsing in `try/except` (skip the row's cell, continue) so one bad cell cannot abort the scrape.
  2. Add `data["standings_source"] = "fastf1+official_overlay"` (or `"fastf1"` when no overlay applied) so consumers can tell provenance. Keep it additive/optional.
- **(c) Contract impact**: dashboard/championship payload gains an optional `standings_source` field; frontend unchanged unless it later opts to display provenance.
- **(d) Acceptance**: unit test with a non-numeric cell → scrape still returns other rows; `standings_source` present; existing FastF1-only path returns `"fastf1"`.

#### W1.6 — M6: UTC-aware schedule partitioning
- **(a) Root cause** — `dashboard_service.py:267,283-285`, `races_service.py:48,82-85`, `championship_service.py:131-134` use `pd.to_datetime("today").normalize()` (server-local midnight), compared against circuit `EventDate` normalised the same way. On a UTC+07 host this misclassifies a race finished Sunday UTC as "Upcoming" for hours.
- **(b) Design** — replace with `pd.Timestamp.now(tz="UTC").normalize()`; normalise circuit `EventDate` as UTC dates (`pd.to_datetime(..., utc=True)` then `.dt.normalize()`), so both sides share one timezone. Cover all three call sites.
- **(c) Contract impact**: none.
- **(d) Acceptance**: unit test mocking "now" to a time near UTC midnight; assert a just-finished race is `Finished`, not `Upcoming`, independent of host TZ.

#### W1.7 — M1 follow-up: explicit telemetry/marker purge in `clear_cache`
- **(a) Root cause** — `system.py:29-33` deletes only dashboard/championship/races/race_detail keys; `telemetry_v2_*` and `fastf1_no_laps_*` are never cleared (and round-25 gap was already fixed).
- **(b) Design** — add an explicit opt-in query flag, e.g. `?include_telemetry=true` (still behind `X-API-Key`), that also removes `telemetry_v2_{year}_*.json` and `fastf1_no_laps_{year}_*.json`. Default stays destructive-safe (does not touch telemetry). Use a directory-glob match guarded to the resolved cache dir (basename-only, no traversal).
- **(c) Contract impact**: new optional query parameter on an authenticated endpoint; default behaviour unchanged.
- **(d) Acceptance**: with the flag, telemetry + negative markers removed; without the flag, they remain; flag is rejected (401) without a valid key.

---

### Wave 2 — Concurrency, Bulkhead Isolation & Data Contracts (Medium–High Risk)

#### W2.1 — M8 + C2 follow-up: single-flight + bulkhead executor
- **(a) Root cause** — `telemetry_service.py:75-84,518-523`: a per-`(year,round)` `threading.Lock` only serialises `load_session_safe`; each waiter then re-loads/re-processes its own copy. All heavy work (FastF1 compute, cache I/O, SWR background) shares asyncio's single default executor (`min(32, cpu+4)`), so N cold requests starve every endpoint.
- **(b) Design**
  1. **Single-flight**: maintain an in-process map `(year, round, drivers_key, lap) -> concurrent.futures.Future`; concurrent identical requests await the same future instead of recomputing. Guard with a lock; remove the entry on completion.
  2. **Bulkhead**: create a dedicated bounded `ThreadPoolExecutor` (size via env, e.g. `F1_HEAVY_WORKERS`, default 4) for FastF1/OpenF1/telemetry compute; route the heavy callables through it so the default executor stays free for cache I/O and small work.
  3. Keep the per-round load lock but scope it to the single-flight fetch (so the coalesced call still respects one load at a time per round).
- **(c) Contract impact**: none (response shape unchanged); capacity behaviour improves.
- **(d) Acceptance**: mock `process_telemetry_compare`'s upstream call and assert N concurrent identical requests trigger **one** upstream invocation; assert heavy compute runs on the dedicated executor (patch `_heavy_executor` and assert used); no gate regression.

#### W2.2 — H9: separate calendar state from data availability
- **(a) Root cause** — `race_details_service.py:1590-1592` derives `status` from data presence (`"Completed" if results else ("Ongoing" if available_tabs else "Upcoming")`); `championship_service.py:149-160` returns `_empty_season(..., "pre_season")` both for a genuinely unstarted season **and** for "every session failed to load". Both are then cached (10 min / 6 h), so a transient upstream outage is presented as "upcoming"/"season not started".
- **(b) Design**
  1. Derive calendar state **only** from the schedule (`EventDate` vs now), never from payload presence.
  2. Add additive availability fields, e.g. `"data_status": "ok" | "partial" | "error"` and an `"error"`/`"message"` string, plus `"source"` where meaningful.
  3. When sessions fail to load, return calendar state as computed + `data_status: "error"`; cache error-state payloads with a **short TTL** (or not at all), so recovery is automatic.
  4. Frontend: render a distinct "data unavailable" state (reuse existing `ErrorState`/empty states) instead of "season hasn't started".
- **(c) Contract impact**: **additive** backend fields; frontend consumes `data_status`/`error` for the affected pages (dashboard, championship, race detail). Must be backward compatible for older cached payloads (treat missing field as `"ok"`).
- **(d) Acceptance**: unit tests — (i) schedule says future ⇒ `pre_season`/`Upcoming` with `data_status: ok`; (ii) schedule says past but all loads fail ⇒ calendar state `Completed`/non-pre-season **and** `data_status: error`; (iii) frontend test renders the error state, not "season not started"; error payloads are not cached long.

#### W2.3 — M5: stable circuit identity + fallback-only canonical geometry
- **(a) Root cause** — `canonical_circuits.py:40-45` keys geometry by **round number** (season-specific; `data/circuits/5.json` = Canada/Montreal), and `telemetry_service.py:220-230` **overwrites** real GPS `X/Y` with canonical interpolation whenever canonical data exists, discarding genuine track excursions/racing line.
- **(b) Design**
  1. Add a stable circuit-key mapping (slug/`circuit_key`) resolved from event metadata (`circuit_paths.json` / `data/circuits/by_key/`) so a circuit is identified by identity, not round.
  2. In `telemetry_service.py`, use canonical geometry as a **fallback only** when real GPS is missing/sparse (`unique_count` below a threshold), never to overwrite a dense valid trace.
  3. Keep round-number lookup as a deprecated fallback for back-compat, logged with a warning.
- **(c) Contract impact**: telemetry `X/Y` may differ for non-2026 seasons (now correct); 2026 output should remain visually identical for dense traces.
- **(d) Acceptance**: resolve a non-2026 event to the correct circuit by slug; a dense GPS trace is returned un-overwritten; a sparse trace still falls back to canonical.

---

### Wave 3 — Bundle Optimization, CSP Hardening & Tech Debt Cleanup (Low Risk)

#### W3.1 — Dead code elimination (backend + frontend)
- **(a) Root cause / items**
  - `races_service.py:13` `LIGHT_LOAD_KWARGS` (used — verify before removing; it IS used at `:132`, so **keep** — mark as "confirmed used, do not delete").
  - `dashboard_service.py:15-16` `F1_SEASON_START/END` (unused; real bounds in `fastf1_safe.is_valid_year`).
  - `get_dashboard_cache_filename` duplicated in `routers/dashboard.py:13`, `routers/races.py:12` (races' copy is wrong/unused), `routers/system.py:12` — consolidate to one shared helper.
  - `clean_nans` duplicated in `race_details_service.py:1654` and `championship_service.py` — keep one (the `championship_service` copy is imported by `dashboard_service.py:345`), remove the other; ensure the surviving one is exception-safe.
  - `spline_smooth.py:41-48,70` unused `order`/`mask`/`mask2`/`dup` and never-called `smooth_curve()`.
  - `openf1_service.py:395-415` `openf1_status()` exported but never called (and hardcodes 2026) — remove or wire into `/health`.
  - `CommandPalette.tsx:816` dead branch: `item.type === 'driver'` never matches (real values are `'Pages'|'Teams'|'Drivers'|'Circuits'`).
- **(b) Design** — mechanical removal/consolidation, each followed by the applicable gate. Prefer a shared `cache_filenames.py` helper for the duplicated filename builders.
- **(c) Contract impact**: none.
- **(d) Acceptance**: `ruff` + `tsc`/`eslint` clean; no test references the removed symbols; driver rows in CommandPalette now use the driver color.

#### W3.2 — Frontend deps & code-splitting
- **(a) Root cause** — `frontend/package.json`: `react-icons` (0 imports in `src`), `puppeteer` (devDep, unused), metadata `"name": "vite-project"` `"version": "0.0.0"`. Root `F1-Fullstack-project/package.json` + `prisma/` are vestigial (app uses FastF1/OpenF1 + sqlite3 via `standings_db.py`). `TrackDominationMap.tsx:6` statically imports 623 KB `data/circuitPaths.ts`, inflating the race-detail chunk past the 500 KB warning.
- **(b) Design**
  1. Remove `react-icons` and `puppeteer` from `package.json`; run `npm install` to refresh the lockfile (or `npm pkg remove`).
  2. Fix name/version metadata.
  3. Lazy-load the circuit map: convert `circuitPaths` to a dynamic `import()` (or `React.lazy` the `TrackDominationMap` component) so it is split out of the race-detail chunk.
  4. Prisma: remove root `package.json`/`package-lock.json` and `prisma/` **only after** removing the `prisma/dev.db` fallback reference in `standings_db.py:18-20` (or keep the dir; **decision point for reviewer** — safe default is to remove the root package + prisma and drop the dead fallback).
- **(c) Contract impact**: none; smaller initial chunks.
- **(d) Acceptance**: `vite build` emits no `>500 KB` race-detail warning (or the warning is reduced to the unavoidable vendor chunk); `npm ls react-icons puppeteer` empty; tests still green.

#### W3.3 — CSP hardening & documentation
- **(a) Root cause** — `main.py:28-39` and `frontend/nginx.conf:14` set `connect-src 'self' ws: wss: http: https:` (effectively allow-anything) and `script-src 'unsafe-inline'`; `README.md` claims React 18.3 / TS 5.5 / "Axios" / "HSTS" / "A+", references non-existent files, and states "MIT" with no `LICENSE` file.
- **(b) Design**
  1. Tighten `connect-src` to `'self' ws: wss: https://api.openf1.org https://livetiming.formula1.com` (drop blanket `http: https:`). Keep `'unsafe-inline'` only if the current inline Vite/Tailwind usage requires it (verify; otherwise move toward hashes/nonces — at minimum document why it remains).
  2. Mirror the same CSP in `main.py` and `frontend/nginx.conf`.
  3. Rewrite `README.md` to match reality (React 19.1, TypeScript 5.7, Vite 7, Tailwind 4, native fetch not Axios, actual file tree). Add a `LICENSE` file if MIT is intended (or drop the claim). **Decision point: license choice.**
- **(c) Contract impact**: CSP change can break live-timing if the WebSocket/audio origins aren't listed — verify `/live` and team-radio still load.
- **(d) Acceptance**: security-header test still passes (update the expected `connect-src`); manual/automated check that `/ws/livetiming` and OpenF1 audio/`media-src` origins still function; README claims verified against actual versions/files.

---

## 3. Verification & Rollback Protocol

Run after **every wave** (and after each item where practical):

```bash
# Backend (from F1-Fullstack-project/Backend)
python -m compileall -q main.py config routers services utils
ruff check --select E9,F63,F7,F82 .
python -m unittest discover -s tests -v          # must be 37/37

# Frontend (from F1-Fullstack-project/frontend)
npm run typecheck && npm run lint && npm run test && npm run build   # 167/167 + clean build
```

### Rollback rules
1. Any gate red ⇒ stop, `git diff` the wave, revert the offending change, re-run the gate.
2. Test counts must not decrease below baseline.
3. Any diff touching `fastf1/` or `fastf1_http_cache.sqlite` ⇒ immediate revert (guardrail).
4. Any credential in a log line or committed file ⇒ immediate revert + rotate if applicable.

### Suggested review checkpoints
- **End of Wave 1**: approve the auth decision for `H10` (public+rate-limit vs API-key) and the Prisma/license decisions.
- **End of Wave 2**: approve the additive `data_status`/`source` contract before frontend work begins.
- **End of Wave 3**: final full-suite run + bundle-size review.
