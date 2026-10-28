# ANALYZIZ — Formula 1 2026 Telemetry, Analytics & Live Pit-Wall 🏎️⚡

[![CI](https://github.com/AIJS2/adnaizf1/actions/workflows/ci.yml/badge.svg)](https://github.com/AIJS2/adnaizf1/actions/workflows/ci.yml)
![Python](https://img.shields.io/badge/Python-3.11%20%7C%203.12-3776AB.svg?style=flat-square&logo=python&logoColor=white)
![FastAPI](https://img.shields.io/badge/FastAPI-0.115+-009688.svg?style=flat-square&logo=fastapi&logoColor=white)
![React](https://img.shields.io/badge/React-19.1-61DAFB.svg?style=flat-square&logo=react&logoColor=black)
![TypeScript](https://img.shields.io/badge/TypeScript-5.7-3178C6.svg?style=flat-square&logo=typescript&logoColor=white)
![Vite](https://img.shields.io/badge/Vite-7.3-646CFF.svg?style=flat-square&logo=vite&logoColor=white)
![Tailwind CSS](https://img.shields.io/badge/Tailwind-4.3-38B2AC.svg?style=flat-square&logo=tailwind-css&logoColor=white)
![Docker](https://img.shields.io/badge/Docker-Ready-2496ED.svg?style=flat-square&logo=docker&logoColor=white)
![Security Hardened](https://img.shields.io/badge/Security-Hardened%20(A+)-brightgreen.svg?style=flat-square&logo=shield)

**ANALYZIZ (`adnaizf1`)** is an enterprise-grade, broadcast-quality Formula 1 telemetry analysis, live timing pit-wall, and championship intelligence platform built for the 2026 FIA Formula One World Championship season.

Engineered with a high-performance decoupled full-stack architecture (**FastAPI + React 19 + TypeScript + Vite + Redis + SQLite**), ANALYZIZ connects directly to live Formula 1 SignalR WebSocket timing streams, processes multi-driver telemetry down to millisecond precision, and provides interactive analytics and simulation tools used by race strategists and motorsport analysts.

---

## 📑 Table of Contents

- [Key Architectural Highlights](#-key-architectural-highlights)
- [Key Features](#-key-features)
  - [1. Real-Time Pit-Wall Live Timing (`/live`)](#1-real-time-pit-wall-live-timing-live)
  - [2. Broadcast-Grade Team Radio Player](#2-broadcast-grade-team-radio-player)
  - [3. Synchronized Multi-Driver Telemetry (`/race/:year/:round`)](#3-synchronized-multi-driver-telemetry-raceyearround)
  - [4. Championship Analytics, Profiles & Monte Carlo Simulator](#4-championship-analytics-profiles--monte-carlo-simulator)
  - [5. DevSecOps & Pentest Hardening](#5-devsecops--security-hardening)
- [System Architecture](#-system-architecture)
- [Tech Stack](#-tech-stack)
- [Repository Structure](#-repository-structure)
- [Quick Start Guide](#-quick-start-guide)
  - [Option A: Docker Compose (Recommended)](#option-a-docker-compose-recommended)
  - [Option B: Local Development](#option-b-local-development)
- [Automated Verification & CI/CD](#-automated-verification--cicd)
- [API Reference](#-api-reference)
- [License & Disclaimer](#-license--disclaimer)

---

## ⚡ Key Architectural Highlights

- **Zero-Dependency Live Timing:** Custom native Python SignalR client consuming official Formula 1 live streams directly without third-party paid subscriptions.
- **Micro-Second Telemetry Sync:** Multi-driver telemetry normalization aligning distance, speed, throttle, brake, and gear data across up to 10 cars simultaneously.
- **High-Density SVG Circuit Maps:** 24 precision-vectorized 2026 circuit paths with driver position mapping calculated via native SVG path geometry (`getPointAtLength()`).
- **Resilient Fallback Pipelines:** Multi-tier fallback architecture bridging FastF1, OpenF1, local SQLite, and persistent disk-backed JSON caches with exponential backoff.
- **Enterprise DevSecOps:** Hardened against OWASP Top 10 vulnerabilities, timing attacks, rate abuse, reverse proxy spoofing, and supply-chain compromises.

---

## 🚀 Key Features

### 1. Real-Time Pit-Wall Live Timing (`/live`)
- **Direct SignalR WebSocket Client:** Connects natively to official F1 timing feeds with auto-reconnection, heartbeat monitoring, and gzip stream decompression.
- **24 Official 2026 Circuit SVG Maps:** Dynamic track visualization plotting driver dots and car telemetry markers directly along canonical SVG race lines using SVG path length calculation (`getPointAtLength()`).
- **Session Lifecycle Intelligence:** Real-time state machine detecting `LIVE`, `FINISHED / CHEQUERED FLAG`, `RED FLAG`, `SAFETY CAR (SC/VSC)`, and `NO SESSION` modes.
- **Interactive Previous Race Toggle:** Instantly switches between live telemetry and the archive of the latest completed Grand Prix (e.g., Round 18 — United States GP at COTA), populating the full 22-driver classification, circuit maps, weather conditions, tyre stint strategies, race control messages, and team radio clips.
- **Live Weather & Race Control HUD:** Micro-climate tracking (track temp, air temp, humidity, pressure, wind speed/direction, rainfall) and real-time FIA race control bulletin ticker.

### 2. Broadcast-Grade Team Radio Player
- **High-Fidelity Audio Streaming:** Direct streaming of `.mp3` team-to-driver pit-wall radio communications captured in real-time.
- **Dynamic Equalizer & Waveform Animation:** Audio visualization with interactive seek bar, duration tracking, playback speed controls, and timestamp synchronization.
- **2026 Grid Filtering:** Quick filtering by driver code (e.g., `ANT`, `VER`, `HAM`, `NOR`, `LEC`, `PIA`, `RUS`) and constructor.
- **Multi-Source Resilient Fallback:** Automatic failover between SignalR live audio payloads and OpenF1 REST archives with exponential backoff retry policies.

### 3. Synchronized Multi-Driver Telemetry (`/race/:year/:round`)
- **Up to 10-Driver Simultaneous Comparison:** Interactive overlaid telemetry charts (Speed, Throttle, Brake, Gear, RPM, DRS, and Time Delta vs Benchmark).
- **Synchronized Vertical Crosshair:** Scrubbing through the race distance updates all metric charts and driver track positions in unison.
- **MoTeC-Inspired Live Distance HUD:** Instant digital readouts of speed, throttle percentage, and interval deltas at any exact metre along the circuit.
- **Track Domination Map:** Interactive circuit visualization color-coded by micro-sectors indicating which driver recorded higher cornering speed or lower delta.

### 4. Championship Analytics, Profiles & Monte Carlo Simulator
- **Interactive Standings & Sticky Columns:** Complete WDC and WCC standings with sticky driver/team badges, form guides, points progression, and podium statistics.
- **Progression Worm Graph:** Visualizes championship momentum across all completed rounds (Rounds 1–18).
- **Global Quick Search (`Ctrl+K`):** Instant search modal with Unicode diacritic normalization (seamlessly matching `Sergio Pérez` via `perez` and `Nico Hülkenberg` via `hulkenberg`).
- **Driver & Constructor Profiles:** Deep career histories, teammate head-to-head comparisons, and track record breakdowns with slug normalization.
- **Monte Carlo Title Simulator:** Probabilistic engine calculating title clinch scenarios, mathematically locked championships, and point spread forecasts across remaining rounds.
- **Automated Next Race Countdown:** Intelligent scheduling engine dynamically pinpointing the next upcoming Grand Prix weekend (Round 19 — Mexico City Grand Prix) across `/dashboard` and `/races`.

### 5. DevSecOps & Pentest Hardening
- **Strict Parameter Regex Validation:** Every path and query parameter (`year`, `round`, `driver_slug`, `team_slug`) is validated against strict alphanumeric regular expressions, eliminating path traversal and injection vectors.
- **Constant-Time Secret Comparison:** Administrative and write endpoints protect `X-API-Key` headers using Python's `secrets.compare_digest` to prevent side-channel timing attacks.
- **Reverse-Proxy Aware Rate Limiting:** `slowapi` rate limiter configured with trusted proxy headers (`X-Real-IP`, `X-Forwarded-For`), protecting endpoints from DoS/scraping while correctly isolating client IPs.
- **WebSocket Connection & Origin Governance:** Enforces explicit allowed origins, limits maximum concurrent connections per IP, and protects memory pools against socket exhaustion.
- **Hardened HTTP Headers & CSP:** Production middleware enforces strict Content Security Policy (CSP), `X-Content-Type-Options: nosniff`, `X-Frame-Options: DENY`, `Referrer-Policy: strict-origin-when-cross-origin`, and `HSTS`.
- **Supply-Chain & Container Security:** Frontend builds use `npm ci --ignore-scripts` with high-severity vulnerability audits (`npm audit --audit-level=high`). Backend Docker images execute under an unprivileged `appuser` non-root system account.

---

## 🏛️ System Architecture

```text
                                  [ F1 SignalR Timing Stream ]
                                                │
                                                ▼
  ┌──────────────────────┐          ┌───────────────────────┐          ┌──────────────────────┐
  │   React 19 + Vite    │ ◄──────► │  FastAPI Python 3.11+ │ ◄──────► │ FastF1 / OpenF1 / DB │
  │   TypeScript 5.7     │  REST &  │  Asynchronous Core    │  Worker  │ SQLite + JSON Cache  │
  │   Tailwind + Recharts│  WSS     │  Rate-Limit + Security│  Pool    │ Redis In-Memory TTL  │
  └──────────────────────┘          └───────────────────────┘          └──────────────────────┘
         ▲                                      ▲
         │                                      │
   [ Web Browser ]                     [ Nginx Reverse Proxy ]
```

---

## 💻 Tech Stack

| Layer | Technologies & Tools |
|---|---|
| **Frontend UI/UX** | React 19.1, TypeScript 5.7, Vite 7.3, Tailwind CSS 4.3, Lucide React |
| **Data Visualization** | Recharts, SVG Geometry Manipulation (`getPointAtLength`), Custom Audio Equalizer |
| **State & Networking** | TanStack React Query 5, Native Fetch API, Native WebSocket Client |
| **Backend Core** | FastAPI 0.115+, Python 3.11+, Uvicorn (ASGI), Pydantic v2 |
| **F1 Data Engines** | Custom SignalR Protocol Client, FastF1 3.4+, OpenF1 API Client |
| **Storage & Caching** | SQLite 3 (Structured DB), Redis 7 (In-Memory Key/Value), Atomic JSON Store |
| **Security & Auditing** | `slowapi` (Rate Limiter), `secrets` (Timing Attack Mitigation), CSP Middleware |
| **DevOps & Containers**| Docker, Docker Compose, Multi-Stage Builds, GitHub Actions CI/CD |
| **Quality & Testing**  | Vitest, React Testing Library, ESLint, Python Unittest, Ruff, Compileall |

---

## 📁 Repository Structure

```text
adnaizf1/
├── .github/
│   └── workflows/
│       └── ci.yml               # GitHub Actions Dual-Stack CI Pipeline
├── README.md                    # Root Portfolio Documentation
└── F1-Fullstack-project/
    ├── docker-compose.yml       # Production Multi-Container Orchestration
    ├── Backend/
    │   ├── Dockerfile           # Multi-stage non-root Python 3.11 image
    │   ├── main.py              # FastAPI app initialization, middleware, CSP
    │   ├── requirements.txt     # Locked backend dependencies
    │   ├── f1_stats.db          # SQLite relational database (drivers, teams, standings)
    │   ├── cache/               # High-speed disk-backed caches & session archives
    │   │   ├── championship_cache_2026.json
    │   │   ├── dashboard_cache_2026.json
    │   │   ├── all_races_cache_2026.json
    │   │   └── race_detail_cache_2026_*.json
    │   ├── routers/             # Modular API routes
    │   │   ├── livetiming.py    # WebSocket and Previous Race endpoints
    │   │   ├── telemetry.py     # Multi-driver telemetry processing
    │   │   ├── championship.py  # Standings, history, and simulation
    │   │   ├── drivers.py       # Driver profiles and career stats
    │   │   ├── teams.py         # Team profiles and constructor analytics
    │   │   └── races.py         # Race schedules and session details
    │   ├── services/            # Core business logic and external integrations
    │   └── tests/               # Backend contract, live timing, and security test suite
    └── frontend/
        ├── Dockerfile           # Optimized Vite build + Nginx Alpine runner
        ├── package.json         # Frontend dependencies and scripts
        ├── vite.config.js       # Vite configuration with proxy, test, and host bindings
        ├── tailwind.config.js   # Tailored motorsport dark-mode design system
        └── src/
            ├── pages/           # LiveTimingPage, TelemetryPage, DashboardPage, StatsPage...
            ├── components/      # Circuit SVG maps, Radio Player, Recharts telemetry charts
            ├── utils/           # nextRace resolver, date formatting, Unicode slug normalizers
            └── services/        # Frontend API client and WebSocket handlers
```

---

## 🏁 Quick Start Guide

### Option A: Docker Compose (Recommended)

Run the entire full-stack application (Redis, FastAPI Backend, and Nginx-served React Frontend) with a single command:

```bash
cd F1-Fullstack-project
docker compose up --build -d
```

- **Frontend Application:** `http://localhost:5173`
- **Backend API Documentation:** `http://localhost:8000/docs`
- **Redis Service:** Internal container network on `redis:6379`

To stop the containers:
```bash
docker compose down
```

---

### Option B: Local Development

#### 1. Backend Setup

```bash
cd F1-Fullstack-project/Backend

# 1. Create and activate a Python 3.11 virtual environment
python -m venv venv
# On Windows:
venv\Scripts\activate
# On Linux/macOS:
source venv/bin/activate

# 2. Install dependencies
pip install -r requirements.txt

# 3. Seed initial 2026 championship and driver database
python scripts/seed_standings.py

# 4. Run the FastAPI development server
uvicorn main:app --host 127.0.0.1 --port 8000 --reload
```

The Backend will be accessible at `http://127.0.0.1:8000`. Interactive OpenAPI documentation is available at `http://127.0.0.1:8000/docs`.

#### 2. Frontend Setup

```bash
cd F1-Fullstack-project/frontend

# 1. Install dependencies with supply-chain script execution disabled
npm ci --ignore-scripts

# 2. Start the Vite development server
npm run dev
```

The Frontend will be running at `http://localhost:5173`.

---

## 🧪 Automated Verification & CI/CD

Both frontend and backend are covered by strict automated test pipelines configured in `.github/workflows/ci.yml`.

### Frontend Quality Gates
```bash
cd F1-Fullstack-project/frontend

npm run lint        # ESLint strict type-aware linting
npm run typecheck   # TypeScript compiler check (tsc --noEmit)
npm run test        # Vitest suite (Component, Live Timing & Util unit tests)
npm run build       # Production distribution compilation
```

### Backend Quality Gates
```bash
cd F1-Fullstack-project/Backend

python -m compileall -q .                     # Byte-compile syntax check
ruff check --select E9,F63,F7,F82 .           # Critical syntax and lint scan
python -m unittest discover -s tests -v        # Complete security, contract & live timing tests
```

---

## 📡 API Reference

| Method | Endpoint | Description | Rate Limit |
|---|---|---|---|
| `GET` | `/api/dashboard/2026` | Season summary, last race result, next race countdown | 60/min |
| `GET` | `/api/championship/2026` | WDC & WCC standings, points progression, round count | 60/min |
| `GET` | `/api/races/2026` | Complete 2026 race calendar, status, and circuit info | 60/min |
| `GET` | `/api/race/2026/{round}` | Detailed classification and session data for a round | 60/min |
| `GET` | `/api/telemetry/2026/{round}` | Synchronized multi-driver telemetry channels | 30/min |
| `GET` | `/api/livetiming/previous` | Full previous race archive (COTA R18) for Live Timing HUD | 60/min |
| `WS`  | `/ws/live-timing` | Real-time SignalR live timing streaming socket | Max 20 conns |
| `GET` | `/api/drivers` | 2026 driver grid with career stats & normalized slugs | 60/min |
| `GET` | `/api/teams` | 2026 constructor profiles and technical specifications | 60/min |

---

## ⚖️ License & Disclaimer

This project is licensed under the MIT License.

*Disclaimer: This application is unofficial and is not associated in any way with Formula 1 companies. F1, FORMULA ONE, FORMULA 1, FIA FORMULA ONE WORLD CHAMPIONSHIP, GRAND PRIX, and related marks are trademarks of Formula One Licensing B.V.*
