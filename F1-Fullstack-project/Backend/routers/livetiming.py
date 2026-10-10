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
    """Payload broadcast when no real session data is available."""
    return {
        "type": "TimingData",
        "is_live_session": False,
        "lines": [],
        "trackStatus": "",
        "weather": {},
        "messages": [],
    }


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
    except WebSocketDisconnect:
        _connected_clients.discard(websocket)
        logger.info("Client disconnected from Live Timing")

