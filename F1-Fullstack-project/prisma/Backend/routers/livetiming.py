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
3. **No session** – broadcast an EMPTY payload. We never fabricate telemetry,
   so when no F1 session is live the feed reports exactly what exists: nothing.

The SignalR connection is shared across all WebSocket clients (singleton).
"""
from __future__ import annotations

import asyncio
import json
import logging
import math
import random
import time
import threading
from datetime import timedelta
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
#  Mock telemetry generator (used when no real session is live)
# ======================================================================

def _generate_mock_telemetry() -> dict:
    """Generate realistic mock F1 telemetry data for development/testing."""
    # 2026 driver grid with numbers, teams, and base pace
    drivers = [
        {"number": "1", "code": "VER", "team": "Red Bull Racing", "base_pace": 92.0, "color": "#3671C6"},
        {"number": "61", "code": "HAD", "team": "Red Bull Racing", "base_pace": 94.5, "color": "#3671C6"},
        {"number": "4", "code": "NOR", "team": "McLaren", "base_pace": 92.5, "color": "#FF8000"},
        {"number": "81", "code": "PIA", "team": "McLaren", "base_pace": 93.2, "color": "#FF8000"},
        {"number": "16", "code": "LEC", "team": "Ferrari", "base_pace": 92.8, "color": "#E8002D"},
        {"number": "44", "code": "HAM", "team": "Ferrari", "base_pace": 93.0, "color": "#E8002D"},
        {"number": "63", "code": "RUS", "team": "Mercedes", "base_pace": 93.5, "color": "#27F4D2"},
        {"number": "12", "code": "ANT", "team": "Mercedes", "base_pace": 94.2, "color": "#27F4D2"},
        {"number": "14", "code": "ALO", "team": "Aston Martin", "base_pace": 94.8, "color": "#229971"},
        {"number": "18", "code": "STR", "team": "Aston Martin", "base_pace": 96.1, "color": "#229971"},
        {"number": "31", "code": "OCO", "team": "Haas F1 Team", "base_pace": 96.5, "color": "#B6BABD"},
        {"number": "87", "code": "BEA", "team": "Haas F1 Team", "base_pace": 97.0, "color": "#B6BABD"},
        {"number": "55", "code": "SAI", "team": "Williams", "base_pace": 95.2, "color": "#64C4FF"},
        {"number": "23", "code": "ALB", "team": "Williams", "base_pace": 95.8, "color": "#64C4FF"},
        {"number": "10", "code": "GAS", "team": "Alpine", "base_pace": 95.5, "color": "#0093CC"},
        {"number": "27", "code": "COL", "team": "Alpine", "base_pace": 96.8, "color": "#0093CC"},
        {"number": "20", "code": "HUL", "team": "Audi", "base_pace": 96.2, "color": "#F40000"},
        {"number": "5", "code": "BOR", "team": "Audi", "base_pace": 97.2, "color": "#F40000"},
        {"number": "22", "code": "TSU", "team": "Racing Bulls", "base_pace": 95.0, "color": "#6692FF"},
        {"number": "30", "code": "LAW", "team": "Racing Bulls", "base_pace": 96.3, "color": "#6692FF"},
        {"number": "77", "code": "BOT", "team": "Cadillac", "base_pace": 97.5, "color": "#D4AF37"},
        {"number": "11", "code": "PER", "team": "Cadillac", "base_pace": 98.0, "color": "#D4AF37"},
    ]
    
    compounds = ["S", "M", "H"]
    statuses = ["TRACK", "TRACK", "TRACK", "TRACK", "TRACK", "PIT"]
    
    # Simulate a running lap counter
    mock_time = time.monotonic()
    lap_base = int(mock_time / 30)  # New "lap" every 30 seconds of mock time
    
    lines = []
    for i, d in enumerate(drivers):
        # Add variance to simulate racing
        variance = random.uniform(-0.5, 0.5)
        pace = d["base_pace"] + variance + (i * 0.15)  # Stagger by position
        
        # Lap time around 92-98 seconds
        lap_seconds = pace + random.uniform(-0.8, 0.8)
        minutes = int(lap_seconds // 60)
        seconds = lap_seconds % 60
        last_lap = f"{minutes}:{seconds:06.3f}"
        
        # Sector times
        s1 = 28.0 + (pace - 92.0) * 0.3 + random.uniform(-0.3, 0.3)
        s2 = 41.5 + (pace - 92.0) * 0.4 + random.uniform(-0.4, 0.4)
        s3 = 22.0 + (pace - 92.0) * 0.3 + random.uniform(-0.3, 0.3)
        
        # Random sector colors (purple=best, green=personal best, yellow=slow)
        def rand_sector_color():
            r = random.random()
            if r < 0.1: return "purple"
            if r < 0.3: return "green"
            if r < 0.5: return "yellow"
            return ""
        
        # Gap calculation
        gap = "+" + f"{i * random.uniform(1.5, 3.5):.3f}" if i > 0 else "LEADER"
        interval = "-" if i == 0 else "+" + f"{random.uniform(1.0, 3.0):.3f}"
        
        # Tyre
        compound = random.choice(compounds)
        tyre_age = random.randint(1, 28)
        
        # Progress around track (0-1)
        progress = (mock_time * 0.003 + i * 0.045) % 1.0
        
        lines.append({
            "position": i + 1,
            "driver": d["code"],
            "team": d["team"],
            "tyre": compound,
            "tyre_age": tyre_age,
            "gap": gap,
            "interval": interval,
            "lastLap": last_lap,
            "lap_color": rand_sector_color(),
            "sector1": f"{s1:.3f}",
            "s1_color": rand_sector_color(),
            "sector2": f"{s2:.3f}",
            "s2_color": rand_sector_color(),
            "sector3": f"{s3:.3f}",
            "s3_color": rand_sector_color(),
            "pits": random.randint(0, 2),
            "progress": round(progress, 4),
            "status": random.choice(statuses) if random.random() < 0.05 else "TRACK",
        })
    
    # Mock weather
    weather = {
        "air": f"{random.randint(22, 35)}°C",
        "track": f"{random.randint(35, 55)}°C",
        "humidity": f"{random.randint(40, 80)}%",
        "rain": f"{random.randint(0, 10)}%",
    }
    
    # Mock track status
    track_status = random.choice(["GREEN", "GREEN", "GREEN", "YELLOW", "SC", "VSC"])
    
    # Mock race control messages
    messages = [
        {"time": time.strftime("%H:%M:%S", time.localtime(mock_time - random.randint(0, 300))), 
         "type": random.choice(["flag", "pit", ""]), 
         "msg": random.choice([
             "GREEN FLAG - TRACK CLEAR",
             "DRS ENABLED",
             f"CAR {random.randint(1, 20):02d} PIT STOP - {random.uniform(2.0, 3.5):.1f}s",
             f"LAP {lap_base} FASTEST: CAR {random.randint(1, 20):02d} 1:{random.randint(30, 38)}.{random.randint(100, 999):03d}",
             "YELLOW FLAG SECTOR 2 - DEBRIS",
             "VSC DEPLOYED",
             "VSC ENDING",
         ])}
        for _ in range(random.randint(3, 7))
    ]
    
    return {
        "type": "TimingData",
        "is_live_session": False,  # Mark as mock/simulation
        "lines": lines,
        "trackStatus": track_status,
        "weather": weather,
        "messages": messages,
    }

# ======================================================================
#  Shared state
# ======================================================================

_state = LiveTimingState()
_connected_clients: set[WebSocket] = set()
_signalr_thread: threading.Thread | None = None
_signalr_running = False
_signalr_connection: Any = None
_broadcast_task: asyncio.Task | None = None
_init_lock = asyncio.Lock()

# Schedule cache: (year, timestamp, schedule_dataframe)
_schedule_cache: tuple[int, float, pd.DataFrame] | None = None
_SCHEDULE_CACHE_TTL = 3600.0  # 1 hour


def _get_cached_schedule(year: int) -> pd.DataFrame:
    global _schedule_cache
    now = time.monotonic()
    if _schedule_cache is not None:
        c_year, c_time, c_df = _schedule_cache
        if c_year == year and (now - c_time) < _SCHEDULE_CACHE_TTL:
            return c_df
    df = fastf1.get_event_schedule(year, include_testing=False)
    _schedule_cache = (year, now, df)
    return df


def _check_live_session() -> bool:
    """Return True when an F1 session is currently in progress."""
    try:
        now_utc = pd.to_datetime("now", utc=True)
        year = now_utc.year
        schedule = _get_cached_schedule(year)

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
    Worker function running in a dedicated daemon thread.
    Maintains a persistent connection to F1 SignalR with auto-reconnect backoff
    as long as `_signalr_running` is True.
    """
    global _signalr_running, _signalr_connection

    backoff = 2.0
    while _signalr_running:
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
        _signalr_connection = connection

        is_connected = False

        def on_open():
            nonlocal is_connected, backoff
            is_connected = True
            backoff = 2.0  # reset backoff on successful connect
            logger.info("✅ Connected to F1 Live Timing SignalR")
            try:
                connection.send("Subscribe", [_TOPICS])
            except Exception as e:
                logger.warning(f"Error subscribing to topics: {e}")

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
            # Wait while connected and signalr remains requested
            while _signalr_running and is_connected:
                time.sleep(1)
        except Exception as e:
            logger.error(f"SignalR connection error: {e}")
        finally:
            try:
                connection.stop()
            except Exception:
                pass
            _signalr_connection = None

        if _signalr_running:
            logger.info(f"SignalR reconnecting in {backoff:.1f}s...")
            time.sleep(backoff)
            backoff = min(backoff * 1.5, 30.0)


def _ensure_signalr() -> None:
    """Start the SignalR thread if it isn't running yet."""
    global _signalr_thread, _signalr_running
    _signalr_running = True
    if _signalr_thread is not None and _signalr_thread.is_alive():
        return
    _signalr_thread = threading.Thread(target=_start_signalr, daemon=True)
    _signalr_thread.start()


def _stop_signalr() -> None:
    """Stop the SignalR worker and tear down active connection when all clients leave."""
    global _signalr_running, _signalr_connection
    _signalr_running = False
    if _signalr_connection is not None:
        try:
            _signalr_connection.stop()
        except Exception:
            pass
        _signalr_connection = None
    logger.info("SignalR worker stopped (no active clients)")


# ======================================================================
#  No-session state
# ======================================================================
#
# There is deliberately no synthetic/demo simulation. When no F1 session is
# live we broadcast an EMPTY payload (no lines, no weather, no messages) and
# let the UI show its "no session" state. Fabricating driver rows, sector
# times, tyre compounds and race-control messages would present invented
# numbers as if they were real telemetry, so the feed reports only what
# actually exists.


def _empty_snapshot() -> dict:
    """Payload broadcast when no real session data is available — use mock telemetry for dev."""
    return _generate_mock_telemetry()


# ======================================================================
#  Broadcast coroutine
# ======================================================================

# How often the broadcast loop re-checks whether a session is actually live.
# The mode is NOT latched on first connect: a session can start or finish while
# clients stay connected, so we re-evaluate periodically and switch modes.
_LIVE_RECHECK_SECONDS = 60.0

async def _broadcast_loop(initial_is_live: bool) -> None:
    """
    Periodically build a snapshot and send it to every connected client.
    If live, the snapshot comes from the real SignalR state; otherwise we tick
    The live/idle decision is re-evaluated every ``_LIVE_RECHECK_SECONDS``
    rather than fixed at connect time, so a session starting (or ending) while
    clients are already connected still switches the feed over.

    When no session is live the payload is EMPTY — no fabricated rows.
    """
    is_live = initial_is_live
    last_check = time.monotonic()

    def _switch_to(new_live: bool) -> None:
        nonlocal is_live
        is_live = new_live
        _state.is_live = new_live
        if new_live:
            logger.info("Live session detected – switching WS feed to live mode")
        else:
            logger.info("No live session – broadcasting an empty (real-data-only) feed")

    while _connected_clients:
        # Re-evaluate the mode periodically, not just on first connect.
        now = time.monotonic()
        if now - last_check >= _LIVE_RECHECK_SECONDS:
            last_check = now
            detected = await asyncio.to_thread(_check_live_session)
            if detected != is_live:
                if detected:
                    # Only claim live mode once SignalR data actually flows;
                    # otherwise keep reporting "no session" rather than
                    # inventing telemetry.
                    await asyncio.to_thread(_ensure_signalr)
                    if _state.timing_data:
                        _switch_to(True)
                else:
                    _switch_to(False)

        if is_live:
            payload = _state.snapshot()
        else:
            # No live session: report exactly what exists, which is nothing.
            payload = _empty_snapshot()

        msg_bytes = json.dumps(payload)
        clients = list(_connected_clients)
        if clients:
            results = await asyncio.gather(
                *[ws.send_text(msg_bytes) for ws in clients],
                return_exceptions=True
            )
            disconnected = {ws for ws, res in zip(clients, results) if isinstance(res, Exception)}
            if disconnected:
                _connected_clients.difference_update(disconnected)

        if not _connected_clients:
            _stop_signalr()
            break

        await asyncio.sleep(2.0)


# ======================================================================
#  WebSocket endpoint
# ======================================================================

@router.websocket("/ws/livetiming")
async def websocket_livetiming(websocket: WebSocket) -> None:
    global _broadcast_task

    await websocket.accept()
    _connected_clients.add(websocket)

    # On first client, decide mode and start broadcast loop under lock
    async with _init_lock:
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

                # Fallback: schedule says live but no data arrived → report no session
                if not _state.timing_data:
                    logger.info("Schedule indicates live session but no SignalR data received – reporting no session")
                    is_live = False
                    _state.is_live = False

            _broadcast_task = asyncio.create_task(_broadcast_loop(is_live))

    try:
        while True:
            # Keep alive – listen for client pings / disconnect
            await websocket.receive_text()
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        _connected_clients.discard(websocket)
        logger.info("Client disconnected from Live Timing")
        if not _connected_clients:
            _stop_signalr()

