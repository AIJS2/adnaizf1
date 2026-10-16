"""Chaos / edge-case probe harness for the F1 backend.

Runs the FastAPI app through TestClient against deliberately hostile
parameters and reports anything that is NOT a graceful result.
"""
from __future__ import annotations

import os
import sys
import json
import traceback

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

os.environ.setdefault("REDIS_URL", "")

from fastapi.testclient import TestClient  # noqa: E402

import main as app_module  # noqa: E402

# NOTE: do not disable slowapi here. The limiter's per-endpoint caps keep a
# full sweep from recomputing every season uncached, which exhausts FastF1's
# own 500 calls/hour budget and turns the probe into an hours-long run. The
# 429s it emits mid-sweep are a harness artefact, not an endpoint defect --
# probe() records them under NOTES rather than FAILURES.

client = TestClient(app_module.app, raise_server_exceptions=False)

FAILURES: list[tuple[str, str]] = []
NOTES: list[str] = []


def probe(label: str, url: str, expect_ok: bool = True) -> None:
    """Hit *url* and flag 5xx / unhandled tracebacks as failures."""
    try:
        r = client.get(url, follow_redirects=True)
    except Exception as e:  # noqa: BLE001
        FAILURES.append((label, f"EXCEPTION {type(e).__name__}: {e}"))
        return
    if r.status_code >= 500:
        FAILURES.append((label, f"HTTP {r.status_code} body={r.text[:400]}"))
        return
    if r.status_code == 429:
        NOTES.append(f"{label}: 429 rate-limited (skipped, not a defect)")
        return
    try:
        body = r.json()
    except Exception:
        FAILURES.append((label, f"HTTP {r.status_code} non-JSON body={r.text[:200]}"))
        return
    body_txt = json.dumps(body)[:300]
    NOTES.append(f"{label}: HTTP {r.status_code} -> {body_txt}")
    if isinstance(body, dict) and "error" in body:
        NOTES.append(f"    ^ ERROR ENVELOPE (status {r.status_code}): {body.get('error')}")
    if expect_ok and r.status_code != 200:
        FAILURES.append((label, f"unexpected HTTP {r.status_code} body={body_txt}"))


print("=" * 78)
print("PHASE 1 — BACKEND CHAOS PROBE")
print("=" * 78)

# ---------------------------------------------------------------------------
# Dashboard
# ---------------------------------------------------------------------------
for year in (2026, 2025, 2024, 1900, 3000, 9999, 0, -1):
    probe(f"GET /api/dashboard/{year}", f"/api/dashboard/{year}")

# ---------------------------------------------------------------------------
# Championship
# ---------------------------------------------------------------------------
for year in (2026, 2025, 2024, 1900, 3000, 9999, 0, -1):
    probe(f"GET /api/championship/{year}", f"/api/championship/{year}")

# ---------------------------------------------------------------------------
# Races
# ---------------------------------------------------------------------------
for year in (2026, 2025, 2024, 1900, 9999):
    probe(f"GET /api/races/{year}", f"/api/races/{year}")

# ---------------------------------------------------------------------------
# Race details — hostile rounds
# ---------------------------------------------------------------------------
for year, rnd in [
    (2025, 1), (2025, 24), (2025, 25), (2025, 0), (2025, -1),
    (2025, 9999), (2026, 1), (2026, 30), (1900, 1), (9999, 1),
]:
    probe(f"GET /api/race/{year}/{rnd}", f"/api/race/{year}/{rnd}")

# ---------------------------------------------------------------------------
# Profiles — unknown / zero-point / bogus drivers
# ---------------------------------------------------------------------------
for year, did in [
    (2025, "max_verstappen"), (2025, "VER"), (2025, "nobody"),
    (2025, ""), (2025, "ZZZ"), (2026, "max_verstappen"),
    (1900, "max_verstappen"), (9999, "max_verstappen"),
]:
    probe(f"GET /api/driver/{year}/{did}", f"/api/driver/{year}/{did}")

for year, tid in [
    (2025, "red_bull_racing"), (2025, "nobody"), (2025, ""),
    (2026, "red_bull_racing"), (1900, "red_bull_racing"),
]:
    probe(f"GET /api/team/{year}/{tid}", f"/api/team/{year}/{tid}")

# ---------------------------------------------------------------------------
# Telemetry — missing telemetry / bogus rounds
# ---------------------------------------------------------------------------
for year, rnd, drivers in [
    (2025, 1, "VER,NOR"), (2025, 1, ""), (2025, 1, ","),
    (2025, 1, "ZZZ,QQQ"), (2025, 9999, "VER"),
    (2026, 1, "VER,NOR"), (1900, 1, "VER"),
]:
    probe(
        f"GET /api/telemetry/{year}/{rnd}?drivers={drivers}",
        f"/api/telemetry/{year}/{rnd}?drivers={drivers}",
    )

probe("GET /api/telemetry-drivers/2025/9999", "/api/telemetry-drivers/2025/9999")
probe("GET /api/telemetry-drivers/2025/1", "/api/telemetry-drivers/2025/1")
probe("GET /api/telemetry-drivers/2026/1", "/api/telemetry-drivers/2026/1")

# ---------------------------------------------------------------------------
# System / misc
# ---------------------------------------------------------------------------
probe("GET /health", "/health")
probe("GET /api/clear_cache/1900", "/api/clear_cache/1900")
# `/api/team_radio` is a real endpoint (routers/team_radio.py) but is not
# mounted in main.py, so it currently 404s. Probe it to keep that visible.
probe("GET /api/team_radio", "/api/team_radio")
probe("GET /api/team_radio?driver_number=1", "/api/team_radio?driver_number=1")
probe("GET /api/team_radio?session_key=previous", "/api/team_radio?session_key=previous")
probe("GET /api/team_radio?session_key=bogus", "/api/team_radio?session_key=bogus")
probe("GET /nonexistent", "/nonexistent")

print("\n--- NOTES ------------------------------------------------------------")
for n in NOTES:
    print(n)

print("\n--- FAILURES --------------------------------------------------------")
if not FAILURES:
    print("NONE")
else:
    for label, detail in FAILURES:
        print(f"[FAIL] {label}\n       {detail}")

print("\n--- WEBSOCKET ------------------------------------------------------")
try:
    with client.websocket_connect("/ws/livetiming") as ws:
        first = ws.receive_text()
        print("first frame:", first[:300])
        try:
            ws.send_text("ping")
        except Exception as e:  # noqa: BLE001
            print("send_text raised:", e)
        try:
            second = ws.receive_text()
            print("second frame:", second[:300])
        except Exception as e:  # noqa: BLE001
            print("receive_text #2 raised:", e)
except Exception as e:  # noqa: BLE001
    print("WEBSOCKET EXCEPTION:", type(e).__name__, e)
    traceback.print_exc()
    FAILURES.append(("/ws/livetiming", f"{type(e).__name__}: {e}"))

print("\n" + "=" * 78)
print(f"RESULT: {len(FAILURES)} failure(s), {len(NOTES)} note(s)")
print("=" * 78)
sys.exit(1 if FAILURES else 0)
