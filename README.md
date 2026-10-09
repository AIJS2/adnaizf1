# Formula 1 Dashboard & Telemetry 🏎️

![React](https://img.shields.io/badge/React-18-blue.svg?style=for-the-badge&logo=react)
![TypeScript](https://img.shields.io/badge/TypeScript-100%25-blue.svg?style=for-the-badge&logo=typescript)
![FastAPI](https://img.shields.io/badge/FastAPI-Modular-green.svg?style=for-the-badge&logo=fastapi)
![Redis](https://img.shields.io/badge/Redis-Caching-red.svg?style=for-the-badge&logo=redis)
![Vite](https://img.shields.io/badge/Vite-Bundler-yellow.svg?style=for-the-badge&logo=vite)
![SignalR](https://img.shields.io/badge/SignalR-Live_Timing-purple.svg?style=for-the-badge)

A comprehensive, real-time Formula 1 dashboard and telemetry visualization platform. This project provides deep insights into F1 races, including driver standings, live timing, advanced telemetry charts, and race analytics, leveraging a high-performance full-stack architecture.

---

## 📖 Table of Contents

1. [Overview](#-overview)
2. [Key Features](#-key-features)
3. [System Architecture](#-system-architecture)
4. [Tech Stack](#-tech-stack)
5. [Prerequisites](#-prerequisites)
6. [Getting Started & Installation](#-getting-started--installation)
7. [Running the Application](#-running-the-application)
8. [Automated Testing](#-automated-testing)
9. [CI/CD (GitHub Actions)](#-cicd-github-actions)
10. [Troubleshooting](#-troubleshooting)

---

## 🎯 Overview

The **Formula 1 Dashboard & Telemetry** project is a full-stack web application designed for motorsport enthusiasts and analysts. It integrates official timing data, historical race statistics, and real-time live timing feeds via a highly optimized Python backend and a modular React frontend. 

The application goes beyond standard standings by offering deep telemetry analysis (throttle, speed, gear selection, time deltas) using interactive charting.

---

## ✨ Key Features

- **Real-Time Live Timing**: Streaming live race data via SignalR with sub-second latency.
- **Advanced Telemetry Visualization**: Interactive charts for speed, throttle, and time deltas using Recharts.
- **Race Simulator & What-If Scenarios**: Predict world championship outcomes with interactive calculators.
- **Driver & Team Profiles**: Deep historical stats, performance metrics, and Head-to-Head comparisons.
- **High-Performance Caching**: Redis-backed API caching to ensure lightning-fast response times even under load.
- **Resilient API**: Built-in rate limiting (SlowAPI) and observability (Sentry) for production-grade reliability.

---

## 🏗️ System Architecture

This project strictly adheres to a decoupled client-server architecture:

### 1. Backend (FastAPI Modular)
- **Framework**: `FastAPI` configured with modular APIRouters for clean domain separation.
- **Concurrency**: Uses `asyncio` for non-blocking I/O and `ThreadPool` for heavy data scraping tasks without blocking the main event loop.
- **Scraper & Live Timing**: Utilizes a custom SignalR client implementation to hook into official F1 timing feeds.
- **Caching Layer**: `Redis` is used to cache expensive API responses (e.g., historical race telemetry) with automatic TTL invalidation.
- **Security & Rate Limiting**: `slowapi` restricts abusive traffic per IP/Endpoint.
- **Observability**: `Sentry` integration captures unhandled exceptions and performance bottlenecks in real-time.

### 2. Frontend (React + Vite)
- **Framework**: `React 18` bundled with `Vite` for ultra-fast Hot Module Replacement (HMR) and optimized builds.
- **Type Safety**: 100% `TypeScript` coverage across all components, hooks, and API responses. Strictly enforced interfaces (`f1.ts`).
- **Data Visualization**: Modularized `Recharts` components (e.g., `SpeedChart.tsx`, `ThrottleChart.tsx`) handle complex telemetry rendering without UI blocking.
- **State Management & Data Fetching**: `TanStack React Query` handles API data caching, background refetching, and stale-time invalidation.

---

## 💻 Tech Stack

### Frontend
- **Library**: React 18
- **Language**: TypeScript 5+ (Strict Mode)
- **Bundler**: Vite
- **Routing**: React Router v6
- **Styling**: Tailwind CSS + Lucide Icons
- **Charting**: Recharts
- **Testing**: Vitest + React Testing Library

### Backend
- **Framework**: FastAPI (Python 3.10+)
- **Concurrency**: Asyncio + Threading
- **Real-time Protocol**: SignalR
- **Cache**: Redis
- **Rate Limiting**: SlowAPI
- **Monitoring**: Sentry

### DevOps & CI/CD
- **Testing Pipeline**: GitHub Actions
- **Environment Management**: `.env` configuration

---

## 📋 Prerequisites

Before setting up the project, ensure you have the following installed on your machine:

- **Node.js** (v18.x or v20.x LTS)
- **npm** (v9+)
- **Python** (v3.10 or higher)
- **Redis Server** (Local installation or Docker container)
- **Git**

---

## 🚀 Getting Started & Installation

### 1. Clone the Repository

```bash
git clone https://github.com/yourusername/F1-Fullstack-project.git
cd F1-Fullstack-project
```

### 2. Backend Setup (Python FastAPI)

Navigate to the backend directory (if separated, or run in root) and set up the virtual environment:

```bash
# Create a virtual environment
python -m venv venv

# Activate the virtual environment
# On Windows:
.\venv\Scripts\activate
# On macOS/Linux:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt
```

#### Environment Variables (.env)
Create a `.env` file in the backend root based on `.env.example`:

```env
# Backend Configuration
REDIS_URL=redis://localhost:6379/0
SENTRY_DSN=your_sentry_dsn_here
ENVIRONMENT=development
CORS_ORIGINS=http://localhost:5173
```

### 3. Frontend Setup (React/Vite)

Navigate to the frontend directory:

```bash
cd frontend

# Install exact dependencies securely
npm ci
```

*(Note: `npm ci` is preferred over `npm install` for reproducible, clean installations based strictly on `package-lock.json`.)*

#### Environment Variables (.env)
Create a `.env` file in the frontend directory:

```env
VITE_API_URL=http://localhost:8000
```

---

## 🚦 Running the Application

For a complete development experience, you need to run both the Redis server, the Python backend, and the Vite frontend.

### 1. Start Redis
Ensure your Redis server is running on the default port (`6379`).
```bash
# Example if using Docker
docker run -d --name redis-f1 -p 6379:6379 redis:alpine
```

### 2. Start the Backend Server
```bash
# Ensure venv is activated
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```
*The API documentation (Swagger UI) will be available at: http://localhost:8000/docs*

### 3. Start the Frontend Server
```bash
cd frontend
npm run dev
```
*The web app will be available at: http://localhost:5173*

---

## 🧪 Automated Testing

The project implements comprehensive unit and integration testing to ensure reliability, particularly for critical components like the `CountdownTimer` and telemetry parsing logic.

### Frontend Tests (Vitest)

We use Vitest (a Vite-native testing framework) configured with `@testing-library/react`.

```bash
cd frontend

# Run tests once
npm run test

# Run tests in watch mode (for active development)
npm run test -- --watch

# Run tests with coverage report
npm run test -- --coverage
```

### Backend Tests (Pytest)

```bash
# Ensure venv is activated
pytest
```

---

## ⚙️ CI/CD (GitHub Actions)

This repository enforces a strict continuous integration workflow. Every `push` and `pull_request` to the `main` branch triggers the GitHub Actions CI pipeline (`.github/workflows/ci.yml`).

The CI pipeline automatically performs the following:
1. **Setup Environment**: Provisions an Ubuntu runner with Node.js and Python.
2. **Install Dependencies**: Executes `npm ci` and `pip install`.
3. **Linting Check**: Runs `npm run lint` and TypeScript compiler (`tsc --noEmit`).
4. **Automated Testing**: Executes `npm run test` via Vitest.
5. **Build Verification**: Runs `npm run build` to ensure Vite bundle optimization passes without type or syntax errors.

*No code can be merged into `main` unless it successfully passes all automated checks.*

---

## 🔧 Troubleshooting

### 1. Frontend shows a blank white page
- **Cause**: Vite cache desynchronization after large `.jsx` to `.tsx` refactors.
- **Fix**: Run `npm run dev -- --force` to flush the `.vite` cache.

### 2. Backend throws Redis Connection Error
- **Cause**: Redis server is not running or accessible.
- **Fix**: Verify Redis is running locally (`redis-cli ping` should return `PONG`). Ensure the `REDIS_URL` in your `.env` is correct.

### 3. TypeScript Compilation Errors during Build
- **Cause**: Implicit `any` types or strict null check violations.
- **Fix**: Run `npx tsc --noEmit` locally to identify exact lines violating strict typing. Update `interfaces/f1.ts` to properly map nullish or generic structures.

---

*Built with passion for F1 & High-Performance Engineering.* 🏁
