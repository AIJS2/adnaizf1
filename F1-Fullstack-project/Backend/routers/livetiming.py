"""
WebSocket endpoint for F1 Live Timing.

Architecture
------------
1. When a client connects, we check the FastF1 schedule to see if there's
   a live session right now.
2. **Live mode** – spin up a SignalR connection (in a background thread so
   it doesn't block asyncio), parse every incoming message into the
   LiveTimingState, and broadcast a snapshot to all connected WebSocket
   clients every ~2 s.
3. **Demo mode** – run a lightweight random-walk simulation so the UI
   always has something to display.

The SignalR connection is shared across all WebSocket clients (singleton).
"""
from __future__ import annotations

import asyncio
import json
import logging
import random
import time
import threading
from datetime import datetime, timedelta
from typing import Any

import pandas as pd
import fastf1
import requests
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from signalrcore.hub_connection_builder import HubConnectionBuilder
from signalrcore.messages.completion_message import CompletionMessage

from services.livetiming_service import LiveTimingState

logger = logging.getLogger(__name__)
router = APIRouter()

# ======================================================================
#  Shared state
# ======================================================================

_state = LiveTimingState()
_connected_clients: set[WebSocket] = set()
_signalr_thread: threading.Thread | None = None
_signalr_running = False
_broadcast_task: asyncio.Task | None = None

# ======================================================================
#  Schedule check  – is there a live session right now?
# ======================================================================

def _check_live_session() -> bool:
    """Return True when an F1 session is currently in progress."""
    try:
        now_utc = pd.to_datetime("now", utc=True)
        year = now_utc.year
        schedule = fastf1.get_event_schedule(year, include_testing=False)

        for _, event in schedule.iterrows():
            for i in range(1, 6):
                col = f"Session{i}DateUtc"
                if col in event and pd.notna(event[col]):
                    start = pd.to_datetime(event[col], utc=True)
                    end = start + timedelta(hours=3)
                    if start <= now_utc <= end:
                        return True
    except Exception as e:
        logger.error(f"Error checking live session: {e}")
    return False


# ======================================================================
#  SignalR connection (runs in a dedicated daemon thread)
# ======================================================================

_NEGOTIATE_URL = "https://livetiming.formula1.com/signalrcore/negotiate"
_CONNECTION_URL = "wss://livetiming.formula1.com/signalrcore"

_TOPICS = [
    "Heartbeat", "DriverList", "ExtrapolatedClock",
    "RaceControlMessages", "SessionInfo", "SessionStatus",
    "TimingAppData", "TimingStats", "TrackStatus",
    "WeatherData", "SessionData", "TimingData",
    "TopThree", "LapCount",
]


def _start_signalr() -> None:
    """
    Blocking function that connects to the F1 SignalR server.
    Intended to be run inside ``threading.Thread``.
    """
    global _signalr_running

    headers: dict[str, str] = {}
    try:
        r = requests.options(_NEGOTIATE_URL, headers=headers, timeout=10)
        if "AWSALBCORS" in r.cookies:
            headers["Cookie"] = f"AWSALBCORS={r.cookies['AWSALBCORS']}"
    except Exception as e:
        logger.warning(f"SignalR negotiate failed: {e}")

    try:
        from fastf1.internals.f1auth import get_auth_token
        token_factory = get_auth_token
    except ImportError:
        token_factory = None

    options = {
        "verify_ssl": True,
        "access_token_factory": token_factory,
        "headers": headers,
    }

    connection = (
        HubConnectionBuilder()
        .with_url(_CONNECTION_URL, options=options)
        .configure_logging(logging.WARNING)
        .build()
    )

    is_connected = False

    def on_open():
        nonlocal is_connected
        is_connected = True
        logger.info("✅ Connected to F1 Live Timing SignalR")
        connection.send("Subscribe", [_TOPICS])

    def on_close():
        nonlocal is_connected
        is_connected = False
        logger.info("❌ Disconnected from F1 Live Timing")

    def on_message(msg: list | CompletionMessage) -> None:
        """Called from the signalrcore receive-thread."""
        if isinstance(msg, CompletionMessage) and msg.result:
            for topic, payload in msg.result.items():
                _state.update(topic, payload)
        elif isinstance(msg, list) and len(msg) >= 2:
            topic = msg[0] if isinstance(msg[0], str) else ""
            payload = msg[1] if len(msg) > 1 else {}
            _state.update(topic, payload)

    connection.on_open(on_open)
    connection.on_close(on_close)
    connection.on("feed", on_message)

    try:
        connection.start()
        _signalr_running = True

        # Block until the main app shuts down or connection drops
        while _signalr_running and is_connected:
            time.sleep(1)
    except Exception as e:
        logger.error(f"SignalR thread error: {e}")
    finally:
        _signalr_running = False
        try:
            connection.stop()
        except Exception:
            pass


def _ensure_signalr() -> None:
    """Start the SignalR thread if it isn't running yet."""
    global _signalr_thread
    if _signalr_thread is not None and _signalr_thread.is_alive():
        return
    _signalr_thread = threading.Thread(target=_start_signalr, daemon=True)
    _signalr_thread.start()


# ======================================================================
#  Demo / simulation mode
# ======================================================================

_DRIVERS_2026 = [
    "VER", "HAD", "NOR", "PIA", "LEC", "HAM", "RUS", "ANT",
    "ALO", "STR", "OCO", "BEA", "SAI", "ALB", "GAS", "COL",
    "HUL", "BOR", "TSU", "LAW", "BOT", "PER",
]
_TEAMS_2026 = {
    "VER": "Red Bull Racing", "HAD": "Red Bull Racing",
    "NOR": "McLaren", "PIA": "McLaren",
    "LEC": "Ferrari", "HAM": "Ferrari",
    "RUS": "Mercedes", "ANT": "Mercedes",
    "ALO": "Aston Martin", "STR": "Aston Martin",
    "OCO": "Haas F1 Team", "BEA": "Haas F1 Team",
    "SAI": "Williams", "ALB": "Williams",
    "GAS": "Alpine", "COL": "Alpine",
    "HUL": "Audi", "BOR": "Audi",
    "TSU": "Racing Bulls", "LAW": "Racing Bulls",
    "BOT": "Cadillac", "PER": "Cadillac",
}
_COMPOUNDS = ["S", "M", "H"]


def _build_demo_state() -> list[dict]:
    """Build initial demo driver rows."""
    rows: list[dict] = []
    for i, d in enumerate(_DRIVERS_2026):
        s1 = 30.0 + i * 0.1
        s2 = 30.0 + i * 0.1
        s3 = 30.0 + i * 0.1
        lap = s1 + s2 + s3
        progress = 1.0 - i * 0.04
        if progress < 0:
            progress += 1.0
        rows.append({
            "driver": d,
            "team": _TEAMS_2026.get(d, "Unknown"),
            "position": i + 1,
            "gap": "LEADER" if i == 0 else f"+{lap - 90.0:.3f}s",
            "interval": "-" if i == 0 else "+0.300s",
            "lastLap": f"1:{int(lap // 60):02d}.{int((lap % 60) * 1000):03d}",
            "lap_time_num": lap,
            "bestLapNum": lap,
            "sector1": f"{s1:.3f}", "sector2": f"{s2:.3f}", "sector3": f"{s3:.3f}",
            "s1_num": s1, "s2_num": s2, "s3_num": s3,
            "s1_color": "green", "s2_color": "green", "s3_color": "green",
            "lap_color": "green",
            "tyre": random.choice(_COMPOUNDS),
            "tyre_age": random.randint(1, 15),
            "pits": random.randint(0, 2),
            "status": "TRACK",
            "progress": progress,
            "stints": [],
        })
    return rows


def _tick_demo(state: list[dict], overall_best: dict, messages: list, track_status: str):
    """Advance the demo simulation by one tick (~2 s)."""
    for s in state:
        speed_factor = 1.0 / s["lap_time_num"]
        s["progress"] += speed_factor * 2.0
        if s["progress"] >= 1.0:
            s["progress"] -= 1.0

        if s["status"] == "PIT":
            s["status"] = "OUT"
            s["stints"].append({"tyre": s["tyre"], "laps": s["tyre_age"]})
            s["tyre"] = random.choice(_COMPOUNDS)
            s["tyre_age"] = 0
            s["pits"] += 1
            s["lap_time_num"] += 20.0
            continue
        if s["status"] == "OUT":
            s["status"] = "TRACK"
            continue

        if random.random() > 0.98:
            s["status"] = "PIT"
            s["progress"] = 0.95
            s["s1_color"] = s["s2_color"] = s["s3_color"] = "yellow"
            messages.insert(0, {
                "time": datetime.now().strftime("%H:%M:%S"),
                "msg": f"{s['driver']} IN PIT", "type": "pit",
            })
            continue

        if random.random() > 0.4:
            s["tyre_age"] += 1
            deg = s["tyre_age"] * 0.05
            s1 = 29.5 + random.uniform(0, 0.8) + deg
            s2 = 29.5 + random.uniform(0, 0.8) + deg
            s3 = 29.5 + random.uniform(0, 0.8) + deg
            lap = s1 + s2 + s3
            s["lap_time_num"] = lap

            s["s1_color"] = "purple" if s1 < overall_best["s1"] else ("green" if s1 < s["s1_num"] else "yellow")
            s["s2_color"] = "purple" if s2 < overall_best["s2"] else ("green" if s2 < s["s2_num"] else "yellow")
            s["s3_color"] = "purple" if s3 < overall_best["s3"] else ("green" if s3 < s["s3_num"] else "yellow")
            s["lap_color"] = "purple" if lap < overall_best["lap"] else ("green" if lap < s["bestLapNum"] else "yellow")

            if s1 < s["s1_num"]: s["s1_num"] = s1
            if s2 < s["s2_num"]: s["s2_num"] = s2
            if s3 < s["s3_num"]: s["s3_num"] = s3
            if lap < s["bestLapNum"]: s["bestLapNum"] = lap

            overall_best["s1"] = min(overall_best["s1"], s1)
            overall_best["s2"] = min(overall_best["s2"], s2)
            overall_best["s3"] = min(overall_best["s3"], s3)
            overall_best["lap"] = min(overall_best["lap"], lap)

            s["lastLap"] = f"{int(lap // 60)}:{lap % 60:06.3f}"
            s["sector1"] = f"{s1:.3f}"
            s["sector2"] = f"{s2:.3f}"
            s["sector3"] = f"{s3:.3f}"

    # Re-rank by lap time
    sorted_state = sorted(state, key=lambda x: x["lap_time_num"] if x["status"] == "TRACK" else 999.0)
    leader_time = sorted_state[0]["lap_time_num"]
    for i, ss in enumerate(sorted_state):
        orig = next(x for x in state if x["driver"] == ss["driver"])
        orig["position"] = i + 1
        if orig["status"] == "PIT":
            orig["gap"] = "IN PIT"
            orig["interval"] = "-"
            orig["lastLap"] = "PIT"
        elif i == 0:
            orig["gap"] = "LEADER"
            orig["interval"] = "-"
        else:
            gap_v = ss["lap_time_num"] - leader_time
            orig["gap"] = f"+{gap_v:.3f}s"
            intv = ss["lap_time_num"] - sorted_state[i - 1]["lap_time_num"]
            orig["interval"] = f"+{intv:.3f}s"

    if random.random() > 0.96:
        track_status = random.choice(["GREEN", "YELLOW (SECTOR 2)"])
        if track_status != "GREEN":
            messages.insert(0, {
                "time": datetime.now().strftime("%H:%M:%S"),
                "msg": f"TRACK STATUS: {track_status}", "type": "flag",
            })
        else:
            messages.insert(0, {
                "time": datetime.now().strftime("%H:%M:%S"),
                "msg": "CLEAR", "type": "system",
            })

    return track_status


# ======================================================================
#  Broadcast coroutine
# ======================================================================

# How often the broadcast loop re-checks whether a session is actually live.
# The mode is NOT latched on first connect: a session can start or finish while
# clients stay connected, so we re-evaluate periodically and switch modes.
_LIVE_RECHECK_SECONDS = 60.0

# Demo state is rebuilt when switching modes; keep one instance per direction
# so a live -> demo transition starts from a clean simulation.
async def _broadcast_loop(initial_is_live: bool) -> None:
    """
    Periodically build a snapshot and send it to every connected client.
    If live, the snapshot comes from the real SignalR state; otherwise we tick
    the demo simulation.

    The live/demo decision is re-evaluated every ``_LIVE_RECHECK_SECONDS``
    rather than fixed at connect time, so a session starting (or ending) while
    clients are already connected still switches the feed over.
    """
    is_live = initial_is_live
    demo_state = None if is_live else _build_demo_state()
    overall_best = {"s1": 999.0, "s2": 999.0, "s3": 999.0, "lap": 999.0}
    demo_messages: list[dict] = [
        {"time": "14:00:00", "msg": "DEMO SESSION ACTIVE", "type": "system"},
    ]
    demo_track_status = "GREEN"
    last_check = time.monotonic()

    def _switch_to(new_live: bool) -> None:
        """Enter *new_live* mode, resetting whatever the other mode owns."""
        nonlocal demo_state, overall_best, demo_messages, demo_track_status
        if new_live:
            _state.is_live = True
            demo_state = None
            logger.info("Live session detected – switching WS feed to live mode")
        else:
            _state.is_live = False
            demo_state = _build_demo_state()
            overall_best = {"s1": 999.0, "s2": 999.0, "s3": 999.0, "lap": 999.0}
            demo_messages = [{"time": "14:00:00", "msg": "DEMO SESSION ACTIVE", "type": "system"}]
            demo_track_status = "GREEN"
            logger.info("No live session – switching WS feed to demo mode")

    while _connected_clients:
        # Re-evaluate the mode periodically, not just on first connect.
        now = time.monotonic()
        if now - last_check >= _LIVE_RECHECK_SECONDS:
            last_check = now
            detected = await asyncio.to_thread(_check_live_session)
            if detected != is_live:
                if detected:
                    # Only claim live mode once SignalR data actually flows;
                    # otherwise stay in demo so clients keep seeing something.
                    await asyncio.to_thread(_ensure_signalr)
                    if _state.timing_data:
                        is_live = True
                        _switch_to(True)
                else:
                    is_live = False
                    _switch_to(False)

        if is_live:
            payload = _state.snapshot()
        else:
            # Invariant: demo mode always has a live simulation to tick.
            if demo_state is None:
                demo_state = _build_demo_state()
            demo_track_status = _tick_demo(
                demo_state, overall_best, demo_messages, demo_track_status,
            )
            payload = {
                "type": "TimingData",
                "is_live_session": False,
                "lines": demo_state,
                "trackStatus": demo_track_status,
                "weather": {
                    "air": f"{28 + random.uniform(-1, 1):.1f}°C",
                    "track": f"{42 + random.uniform(-2, 2):.1f}°C",
                    "humidity": f"{60 + random.randint(-5, 5)}%",
                    "rain": "0%",
                },
                "messages": demo_messages[:20],
            }

        msg_bytes = json.dumps(payload)
        disconnected: set[WebSocket] = set()
        for ws in list(_connected_clients):
            try:
                await ws.send_text(msg_bytes)
            except Exception:
                disconnected.add(ws)
        _connected_clients.difference_update(disconnected)

        await asyncio.sleep(2.0)


# ======================================================================
#  WebSocket endpoint
# ======================================================================

@router.websocket("/ws/livetiming")
async def websocket_livetiming(websocket: WebSocket) -> None:
    global _broadcast_task

    await websocket.accept()
    _connected_clients.add(websocket)

    # On first client, decide mode and start broadcast loop
    if _broadcast_task is None or _broadcast_task.done():
        is_live = await asyncio.to_thread(_check_live_session)

        if is_live:
            _state.is_live = True
            await asyncio.to_thread(_ensure_signalr)
            # Give SignalR up to 8 seconds to receive initial driver data
            for _ in range(16):
                await asyncio.sleep(0.5)
                if _state.timing_data:
                    break

            # Fallback: schedule says live but no data arrived → demo mode
            if not _state.timing_data:
                logger.info("Schedule indicates live session but no SignalR data received – falling back to demo mode")
                is_live = False
                _state.is_live = False

        _broadcast_task = asyncio.create_task(_broadcast_loop(is_live))

    try:
        while True:
            # Keep alive – listen for client pings / disconnect
            await websocket.receive_text()
    except WebSocketDisconnect:
        _connected_clients.discard(websocket)
        logger.info("Client disconnected from Live Timing")

