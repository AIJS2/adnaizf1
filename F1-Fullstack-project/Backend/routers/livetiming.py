"""
WebSocket endpoint for F1 Live Timing.

Architecture
------------
1. When a client connects, we check the FastF1 schedule to see if there's
   a live session right now.
2. **Live mode** – maintain a SignalR connection (in a background thread so
   it doesn't block asyncio), parse every incoming message into the
   LiveTimingState, and broadcast a snapshot to all connected WebSocket
   clients every ~2 s.
3. **No session** – broadcast an EMPTY payload. We never fabricate telemetry,
   so when no F1 session is live the feed reports exactly what exists: nothing.
4. **Unavailable** – the schedule says a session is live, but the upstream
   feed rejected us (401/403) or sent no timing data before the timeout.
   Broadcast a distinct ``status: "unavailable_subscription"`` so the UI can
   explain the paywall instead of pretending it is an off-weekend.

Why we speak the SignalR protocol directly
------------------------------------------
The ``signalrcore`` client bundled with FastF1 3.7.0 reads a WebSocket frame
with a single ``sock.recv(payload_len)`` and explicitly says it only supports
"single-frame, unfragmented" messages. F1's initial snapshot is ~80 KB, so it
arrives in multiple frames/partial reads; signalrcore then fails with
``Unterminated string`` and discards the whole snapshot. We use the
``websockets`` library instead (already a FastF1 dependency), which reassembles
fragments and partial reads correctly. We also send an ``invocationId`` with
``Subscribe`` because F1 only returns the initial snapshot as a Completion
message when one is present.

No F1TV token is required for the public live-timing feed. The old code always
passed FastF1's ``get_auth_token`` as ``access_token_factory``; that function
requires an F1TV subscription and otherwise opens an interactive auth flow.
Anonymous access is both free and sufficient.

The SignalR connection is shared across all WebSocket clients (singleton).
"""

from __future__ import annotations

import asyncio
import json
import logging
import os
import threading
import time
from datetime import timedelta
from typing import Any

import fastf1
import pandas as pd
import requests
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
from websockets.exceptions import (
    ConnectionClosed,
    InvalidHandshake,
    InvalidStatus,
    WebSocketException,
)
from websockets.sync.client import connect as ws_connect

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
_signalr_connected = False
_signalr_auth_failed = False
_signalr_last_error = ""
_signalr_error_logged = False
_state_session_key: Any = None
_broadcast_task: asyncio.Task | None = None
_init_lock = asyncio.Lock()

# Schedule cache: (year, timestamp, schedule_dataframe)
_schedule_cache: tuple[int, float, pd.DataFrame] | None = None
_SCHEDULE_CACHE_TTL = 3600.0  # 1 hour

# A cold FastF1 schedule load can block for ~20s (two upstream APIs time out
# before the bundled schedule is used). The first WebSocket client must not
# wait that long, so the load runs in the background and the feed decides in
# the meantime. Once loaded, the fast path below takes microseconds.
_schedule_lock = threading.Lock()
_schedule_loading = False

# Keep the SignalR feed alive briefly after the last client leaves. A page
# reload then reuses the live connection instead of paying a fresh handshake,
# and a reconnect still has a current snapshot to send immediately.
_SIGNALR_IDLE_GRACE_SECONDS = 60.0
_signalr_idle_lock = threading.Lock()
_signalr_idle_timer: threading.Timer | None = None

# Wire status values consumed by the frontend. Keep them distinct: an empty
# feed has two very different meanings.
STATUS_LIVE = "live"
STATUS_NO_SESSION = "no_session"
STATUS_UNAVAILABLE = "unavailable_subscription"

# How long the first client waits for the initial SignalR snapshot before we
# conclude that the upstream feed is unavailable. F1 normally sends the full
# snapshot in well under a second.
_LIVE_DATA_WAIT_SECONDS = 8.0


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


def _load_schedule_in_background(year: int) -> None:
    """Warm the FastF1 schedule without blocking a request handler."""
    global _schedule_loading

    try:
        _get_cached_schedule(year)
    except Exception as e:  # noqa: BLE001 - a schedule failure must not kill the app
        logger.error(f"Error loading the {year} schedule: {e}")
    finally:
        with _schedule_lock:
            _schedule_loading = False


def _check_live_session() -> bool:
    """Return True when an F1 session is currently in progress.

    When the schedule has not been loaded yet, kick off the load in the
    background and answer ``True`` immediately. The SignalR feed is the source
    of truth for what is actually live; waiting ~20s for FastF1 would leave the
    first WebSocket frame blank, which is worse than briefly showing the last
    session until the schedule arrives.
    """
    global _schedule_loading

    try:
        now_utc = pd.to_datetime("now", utc=True)
        year = now_utc.year

        cached = _schedule_cache
        current_year = cached is not None and cached[0] == year
        fresh = current_year and (time.monotonic() - cached[1]) < _SCHEDULE_CACHE_TTL
        if not fresh:
            with _schedule_lock:
                if not _schedule_loading:
                    _schedule_loading = True
                    threading.Thread(
                        target=_load_schedule_in_background,
                        args=(year,),
                        daemon=True,
                    ).start()
            if not current_year:
                return True
            # A stale cache is still a usable answer while the refresh runs;
            # never block the WebSocket handshake on the reload.
            schedule = cached[2]
        else:
            schedule = cached[2]

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
_RECORD_SEPARATOR = "\x1e"

_TOPICS = [
    "Heartbeat",
    "DriverList",
    "ExtrapolatedClock",
    "RaceControlMessages",
    "SessionInfo",
    "SessionStatus",
    "ArchiveStatus",
    "TeamRadio",
    "TimingAppData",
    "TimingStats",
    "TrackStatus",
    "WeatherData",
    "SessionData",
    "TimingData",
    "TopThree",
    "LapCount",
]


def _note_signalr_failure(message: str, *, auth: bool = False) -> None:
    """Remember the latest feed failure and log it once per outage.

    Reconnect attempts happen every few seconds. Logging each one produced a
    wall of ERROR lines for a condition that is not actionable from inside the
    process (a paywall or an upstream outage), so only the first failure of a
    streak is a warning; later attempts stay at debug level.
    """
    global _signalr_auth_failed, _signalr_last_error, _signalr_error_logged

    _signalr_last_error = message
    if auth:
        _signalr_auth_failed = True

    if not _signalr_error_logged:
        logger.warning("F1 live timing feed unavailable: %s", message)
        _signalr_error_logged = True
    else:
        logger.debug("F1 live timing feed still unavailable: %s", message)


def _negotiate_headers() -> dict[str, str]:
    """Get the sticky-load-balancer cookie F1's SignalR endpoint expects."""
    headers: dict[str, str] = {}
    try:
        response = requests.options(_NEGOTIATE_URL, timeout=10)
        if response.status_code in (401, 403):
            _note_signalr_failure(
                f"negotiate rejected with HTTP {response.status_code}",
                auth=True,
            )
        cookie = response.cookies.get("AWSALBCORS")
        if cookie:
            headers["Cookie"] = f"AWSALBCORS={cookie}"
    except requests.RequestException as e:
        _note_signalr_failure(f"negotiate failed: {type(e).__name__}: {e}")
    return headers


def _handle_signalr_record(record: str) -> None:
    """Parse one JSON record from a SignalR ``\\x1e``-delimited message."""
    global _state_session_key

    if not record.strip():
        return
    try:
        message = json.loads(record)
    except json.JSONDecodeError as e:
        logger.debug("Discarding malformed SignalR record: %s", e)
        return
    if not isinstance(message, dict):
        return

    message_type = message.get("type")

    if message_type == 3:
        # Completion of the Subscribe invocation: the full initial snapshot.
        result = message.get("result")
        if isinstance(result, dict):
            # A backend that stays up across sessions must not merge a new
            # session's snapshot into the previous session's state.
            session_info = result.get("SessionInfo")
            incoming_key = (
                session_info.get("Key")
                if isinstance(session_info, dict)
                else None
            )
            previous_key = _state_session_key or _state.session_info.get("Key")
            if (
                incoming_key is not None
                and previous_key is not None
                and incoming_key != previous_key
            ):
                _state.reset()
            if incoming_key is not None:
                _state_session_key = incoming_key

            for topic, payload in result.items():
                _state.update(topic, payload)
            if _state.timing_data:
                _state.is_live = True
    elif message_type == 1 and message.get("target") == "feed":
        # Live update: arguments = [topic, payload, timestamp?]
        arguments = message.get("arguments") or []
        if len(arguments) >= 2 and isinstance(arguments[0], str):
            _state.update(arguments[0], arguments[1])
    elif message_type == 7:
        logger.warning(
            "F1 SignalR closed the connection: %s",
            message.get("error") or "no reason supplied",
        )


def _consume_signalr(raw: str) -> None:
    for record in raw.split(_RECORD_SEPARATOR):
        _handle_signalr_record(record)


def _start_signalr() -> None:
    """
    Worker function running in a dedicated daemon thread.
    Maintains a persistent connection to F1 SignalR with auto-reconnect backoff
    as long as `_signalr_running` is True.
    """
    global _signalr_running, _signalr_connected
    global _signalr_auth_failed, _signalr_error_logged

    backoff = 2.0
    while _signalr_running:
        headers = _negotiate_headers()

        try:
            # max_size=None: the initial snapshot is ~80 KB and can grow.
            with ws_connect(
                _CONNECTION_URL,
                additional_headers=headers,
                open_timeout=15,
                close_timeout=5,
                max_size=None,
            ) as connection:
                # SignalR JSON protocol handshake.
                connection.send(
                    json.dumps({"protocol": "json", "version": 1})
                    + _RECORD_SEPARATOR
                )
                handshake = connection.recv(timeout=15)
                handshake_record = next(
                    (
                        record
                        for record in handshake.split(_RECORD_SEPARATOR)
                        if record.strip()
                    ),
                    "",
                )
                if handshake_record:
                    handshake_data = json.loads(handshake_record)
                    if isinstance(handshake_data, dict) and handshake_data.get(
                        "error"
                    ):
                        raise RuntimeError(
                            f"SignalR handshake failed: {handshake_data['error']}"
                        )

                # invocationId is required for F1 to send the initial snapshot
                # as a Completion message.
                connection.send(
                    json.dumps(
                        {
                            "type": 1,
                            "invocationId": "1",
                            "target": "Subscribe",
                            "arguments": [_TOPICS],
                        }
                    )
                    + _RECORD_SEPARATOR
                )

                _signalr_connected = True
                _signalr_auth_failed = False
                _signalr_error_logged = False
                backoff = 2.0
                logger.info("✅ Connected to F1 Live Timing SignalR (anonymous)")

                while _signalr_running:
                    try:
                        raw = connection.recv(timeout=1.0)
                    except TimeoutError:
                        continue
                    _consume_signalr(raw)
        except InvalidStatus as e:
            status_code = getattr(getattr(e, "response", None), "status_code", None)
            _note_signalr_failure(
                f"websocket handshake rejected with HTTP {status_code}",
                auth=status_code in (401, 403),
            )
        except (ConnectionClosed, InvalidHandshake, WebSocketException) as e:
            _note_signalr_failure(f"{type(e).__name__}: {e}")
        except (OSError, RuntimeError, ValueError) as e:
            _note_signalr_failure(f"{type(e).__name__}: {e}")
        except Exception as e:  # noqa: BLE001 - a feed error must not kill the thread
            _note_signalr_failure(f"{type(e).__name__}: {e}")
        finally:
            _signalr_connected = False

        if _signalr_running:
            logger.debug("SignalR reconnecting in %.1fs...", backoff)
            time.sleep(backoff)
            backoff = min(backoff * 1.5, 30.0)


def _ensure_signalr() -> None:
    """Start the SignalR thread if it isn't running yet."""
    global _signalr_thread, _signalr_running, _signalr_error_logged

    _signalr_running = True
    if _signalr_thread is not None and _signalr_thread.is_alive():
        return
    _signalr_error_logged = False
    _signalr_thread = threading.Thread(target=_start_signalr, daemon=True)
    _signalr_thread.start()


def _stop_signalr() -> None:
    """Stop the SignalR worker when all clients leave or the session ends."""
    global _signalr_running

    _cancel_signalr_stop()
    was_running = _signalr_running
    _signalr_running = False
    if was_running:
        logger.info("SignalR worker stopped")


def _cancel_signalr_stop() -> None:
    """Cancel a pending idle shutdown (a client reconnected)."""
    global _signalr_idle_timer

    with _signalr_idle_lock:
        if _signalr_idle_timer is not None:
            _signalr_idle_timer.cancel()
            _signalr_idle_timer = None


def _schedule_signalr_stop() -> None:
    """Stop the feed after a short grace period instead of immediately."""
    global _signalr_idle_timer

    with _signalr_idle_lock:
        if _signalr_idle_timer is not None:
            _signalr_idle_timer.cancel()
        timer = threading.Timer(_SIGNALR_IDLE_GRACE_SECONDS, _stop_signalr)
        timer.daemon = True
        _signalr_idle_timer = timer
        timer.start()


# ======================================================================
#  Empty / unavailable state
# ======================================================================
#
# There is deliberately no synthetic/demo simulation. When no F1 session is
# live we broadcast an EMPTY payload (no lines, no weather, no messages) and
# let the UI show its "no session" state. Fabricating driver rows, sector
# times, tyre compounds and race-control messages would present invented
# numbers as if they were real telemetry, so the feed reports only what
# actually exists.


def _empty_snapshot(status: str, reason: str | None = None) -> dict:
    """Payload broadcast when no real session data is available — empty feed.

    ``status`` distinguishes an off-weekend (``no_session``) from a live
    session whose feed is gated (``unavailable_subscription``). No fabricated
    driver rows, sector times, tyre compounds, weather, or race-control
    messages are ever included.
    """
    payload: dict[str, Any] = {
        "type": "TimingData",
        "status": status,
        "is_live_session": False,
        "session_state": (
            STATUS_NO_SESSION if status == STATUS_NO_SESSION else "live"
        ),
        "session_title": "",
        "circuit": None,
        "lap": None,
        "total_laps": None,
        "lines": [],
        "trackStatus": "GREEN",
        "weather": {
            "air": "--",
            "track": "--",
            "humidity": "--",
            "rain": "--",
        },
        "messages": [],
        "radio": [],
    }
    if status == STATUS_NO_SESSION:
        payload["last_session"] = _state.last_session_snapshot()
    if reason:
        payload["reason"] = reason
    return payload


def _live_payload() -> dict:
    payload = _state.snapshot()
    payload["status"] = STATUS_LIVE
    return payload


# ======================================================================
#  Broadcast coroutine
# ======================================================================

# How often the broadcast loop re-checks whether a session is actually live.
# The mode is NOT latched on first connect: a session can start or finish while
# clients stay connected, so we re-evaluate periodically and switch modes.
_LIVE_RECHECK_SECONDS = 15.0


async def _broadcast_loop(initial_status: str) -> None:
    """
    Periodically build a snapshot and send it to every connected client.
    If live, the snapshot comes from the real SignalR state; otherwise we
    send an empty payload with an explicit status.
    """
    status = initial_status
    last_check = time.monotonic()

    def _set_status(new_status: str) -> None:
        nonlocal status
        if new_status == status:
            return
        status = new_status
        if new_status == STATUS_LIVE:
            _state.is_live = True
            logger.info("Live session detected – switching WS feed to live mode")
        elif new_status == STATUS_UNAVAILABLE:
            _state.is_live = False
            logger.info(
                "Live session in schedule but no SignalR data – reporting "
                "unavailable_subscription"
            )
        else:
            _state.is_live = False
            _state.reset()
            logger.info(
                "No live session – broadcasting an empty (real-data-only) feed"
            )

    while _connected_clients:
        # Re-evaluate the mode periodically, not just on first connect.
        now = time.monotonic()
        if now - last_check >= _LIVE_RECHECK_SECONDS:
            last_check = now
            detected = await asyncio.to_thread(_check_live_session)
            if detected:
                if status != STATUS_LIVE:
                    await asyncio.to_thread(_ensure_signalr)
                    if _state.timing_data:
                        _set_status(STATUS_LIVE)
                    else:
                        _set_status(STATUS_UNAVAILABLE)
            elif status != STATUS_NO_SESSION:
                _set_status(STATUS_NO_SESSION)
                await asyncio.to_thread(_stop_signalr)

        if status == STATUS_LIVE:
            payload = _live_payload()
        else:
            reason = None
            if status == STATUS_UNAVAILABLE:
                reason = "auth" if _signalr_auth_failed else "no_data"
            payload = _empty_snapshot(status, reason)

        msg_bytes = json.dumps(payload)
        clients = list(_connected_clients)
        if clients:
            results = await asyncio.gather(
                *[ws.send_text(msg_bytes) for ws in clients], return_exceptions=True
            )
            disconnected = {
                ws
                for ws, res in zip(clients, results, strict=False)
                if isinstance(res, Exception)
            }
            if disconnected:
                _connected_clients.difference_update(disconnected)

        if not _connected_clients:
            # Keep the upstream feed alive for the grace period; the endpoint's
            # finally block schedules the shutdown. This makes a page reload
            # reuse the live connection instead of re-handshaking.
            break

        await asyncio.sleep(2.0)


# ======================================================================
#  WebSocket endpoint
# ======================================================================

MAX_WS_CLIENTS = 100
MAX_WS_CONNECTIONS = MAX_WS_CLIENTS


def _get_allowed_ws_origins() -> set[str]:
    raw = (
        os.environ.get("ALLOWED_ORIGINS")
        or os.environ.get("CORS_ORIGINS")
        or ""
    )
    extra = {o.strip().rstrip("/") for o in raw.split(",") if o.strip()}
    return {
        "http://localhost:5173",
        "http://localhost:5174",
        "http://127.0.0.1:5173",
        "http://127.0.0.1:5174",
        "http://localhost:8000",
        "http://127.0.0.1:8000",
        "http://localhost",
        "http://127.0.0.1",
        "http://testserver",
        "https://testserver",
        "testserver",
        *extra,
    }


def _is_allowed_ws_origin(websocket: WebSocket) -> bool:
    origin = (websocket.headers.get("origin") or "").strip().rstrip("/")
    env = os.getenv("ENVIRONMENT", "development").lower()
    if not origin:
        return env != "production"
    if origin in _get_allowed_ws_origins():
        return True
    if origin.startswith(
        (
            "http://localhost:",
            "http://127.0.0.1:",
            "https://localhost:",
            "https://127.0.0.1:",
        )
    ):
        return True
    return False


@router.websocket("/ws/livetiming")
async def websocket_livetiming(websocket: WebSocket) -> None:
    global _broadcast_task

    if not _is_allowed_ws_origin(websocket):
        await websocket.close(code=1008, reason="Origin not allowed")
        return

    if len(_connected_clients) >= MAX_WS_CLIENTS:
        await websocket.close(code=1013, reason="Try Again Later")
        return

    await websocket.accept()
    _cancel_signalr_stop()
    _connected_clients.add(websocket)

    # On first client, decide mode and start broadcast loop under lock
    async with _init_lock:
        if _broadcast_task is None or _broadcast_task.done():
            is_live = await asyncio.to_thread(_check_live_session)

            if is_live:
                # Starting a fresh broadcast: never reuse the previous
                # session's rows while the new snapshot is in flight. During
                # the idle grace period the feed is still connected, so its
                # state is current and can be sent immediately.
                feed_alive = (
                    _signalr_thread is not None and _signalr_thread.is_alive()
                )
                if not feed_alive:
                    _state.reset()
                _state.is_live = True
                await asyncio.to_thread(_ensure_signalr)

                # Give SignalR up to _LIVE_DATA_WAIT_SECONDS to receive the
                # initial driver/timing snapshot.
                deadline = time.monotonic() + _LIVE_DATA_WAIT_SECONDS
                while time.monotonic() < deadline and not _state.timing_data:
                    await asyncio.sleep(0.25)

                if _state.timing_data:
                    status = STATUS_LIVE
                else:
                    # Schedule says live but the feed is gated or silent.
                    # This is NOT an off-weekend: report it explicitly.
                    status = STATUS_UNAVAILABLE
                    _state.is_live = False
                    logger.info(
                        "Live session in schedule but no SignalR data after "
                        "%.0fs – reporting unavailable_subscription",
                        _LIVE_DATA_WAIT_SECONDS,
                    )
            else:
                status = STATUS_NO_SESSION
                _state.is_live = False
                _state.reset()

            _broadcast_task = asyncio.create_task(_broadcast_loop(status))

    try:
        while True:
            # Keep alive – listen for client pings / disconnect
            msg = await websocket.receive_text()
            if len(msg) > 1024:
                await websocket.close(code=1009, reason="Message Too Big")
                break
    except (WebSocketDisconnect, Exception):
        pass
    finally:
        _connected_clients.discard(websocket)
        logger.info("Client disconnected from Live Timing")
        if not _connected_clients:
            _schedule_signalr_stop()
