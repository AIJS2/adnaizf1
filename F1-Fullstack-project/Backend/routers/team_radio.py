"""Team radio endpoint.

OpenF1 is the historical source here. While an F1 session is live its free
tier is paywalled (401/403 on every endpoint, including past sessions), so the
shared backoff in ``services.openf1_service`` is used instead of retrying and
logging an ERROR on every poll.

The endpoint always answers HTTP 200. When OpenF1 is paywalled, unreachable or
slow, it falls back to the last playable clips captured from the F1 SignalR
feed by ``services.livetiming_service``. That matters for the "Previous" tab:
the free live feed has already delivered real radio clips even while OpenF1
refuses to serve them.
"""

from __future__ import annotations

import asyncio
import logging
from datetime import datetime, timezone
from typing import Any, Dict, Optional

import httpx
from fastapi import APIRouter, Query

from services import openf1_service
from services.livetiming_service import get_cached_radio

router = APIRouter(prefix="/api/team_radio", tags=["Team Radio"])

logger = logging.getLogger(__name__)

OPENF1_TEAM_RADIO_URL = "https://api.openf1.org/v1/team_radio"
OPENF1_SESSIONS_URL = "https://api.openf1.org/v1/sessions"

# A stalled external request must not hold the browser's fetch open. Four
# seconds is enough for OpenF1's normal response and short enough that the UI
# can immediately fall back to the SignalR cache.
OPENF1_TIMEOUT_SECONDS = 4.0

UNAVAILABLE_WARNING = (
    "Real-time team radio requires a paid OpenF1 subscription while a session "
    "is live. Live radio is coming soon."
)


def _unavailable_response(session_used: Any, detail: str = "") -> Dict[str, Any]:
    """HTTP-200 payload for OpenF1's live-session paywall."""
    return {
        "status": "unavailable_subscription",
        "source": "openf1",
        "session_used": session_used,
        "warning": UNAVAILABLE_WARNING,
        "detail": detail or openf1_service.paywall_detail(),
        "fallback": False,
        "data": [],
    }


def _cached_radio_response(
    session_used: Any,
    driver_number: Optional[int] = None,
    reason: str = "",
) -> Optional[Dict[str, Any]]:
    """Return the last SignalR radio capture set, or None when empty.

    The cache is populated by ``LiveTimingState.snapshot()`` and deliberately
    survives ``reset()``, so it is still available after the session ends and
    OpenF1 refuses historical requests during its live-session paywall.
    """
    cached = get_cached_radio()
    data = list(cached.get("data") or [])
    if driver_number is not None:
        data = [
            item
            for item in data
            if str(item.get("driver_number")) == str(driver_number)
        ]
    if not data:
        return None

    return {
        "status": "success",
        "source": "signalr_cache",
        "session_used": session_used,
        "session_title": cached.get("session_title") or "",
        "warning": reason
        or "OpenF1 is unavailable; using the latest SignalR radio captures.",
        "fallback": True,
        "data": data,
    }


def _is_paywall(status_code: int) -> bool:
    return status_code in (401, 403)


async def _resolve_previous_session(client: httpx.AsyncClient) -> Optional[str]:
    """OpenF1 session key of the latest completed session, or ``"latest"``.

    Returns None when the session list could not be read for a non-paywall
    reason, so the caller can fall back to ``"latest"``.
    """
    try:
        response = await client.get(OPENF1_SESSIONS_URL)
        if _is_paywall(response.status_code):
            openf1_service.note_paywall(response.status_code, response.text)
            return None
        if response.status_code != 200:
            return None

        sessions = response.json()
        if not isinstance(sessions, list):
            return None

        now = datetime.now(timezone.utc)
        past_sessions = []
        for session in sessions:
            date_end_str = session.get("date_end")
            if not date_end_str:
                continue
            try:
                date_end = datetime.fromisoformat(
                    str(date_end_str).replace("Z", "+00:00")
                )
            except ValueError:
                continue
            if date_end < now:
                past_sessions.append(session)

        if past_sessions:
            return past_sessions[-1].get("session_key")
        return "latest"
    except (httpx.HTTPError, ValueError) as e:
        logger.warning(
            "OpenF1 session lookup for team_radio failed: %s: %s",
            type(e).__name__,
            e,
        )
        return None


async def _latest_session_has_ended(client: httpx.AsyncClient) -> Optional[bool]:
    """True when OpenF1's latest session has already finished.

    Returns None when the check itself could not be completed, so the caller
    proceeds to the team-radio request rather than inventing an empty answer.
    """
    try:
        response = await client.get(
            OPENF1_SESSIONS_URL, params={"session_key": "latest"}
        )
        if _is_paywall(response.status_code):
            openf1_service.note_paywall(response.status_code, response.text)
            return None
        if response.status_code != 200:
            return None

        sessions = response.json()
        if not isinstance(sessions, list) or not sessions:
            return None

        date_end_str = sessions[0].get("date_end")
        if not date_end_str:
            return None
        try:
            date_end = datetime.fromisoformat(
                str(date_end_str).replace("Z", "+00:00")
            )
        except ValueError:
            return None
        return datetime.now(timezone.utc) > date_end
    except (httpx.HTTPError, ValueError) as e:
        logger.warning(
            "OpenF1 latest-session check for team_radio failed: %s: %s",
            type(e).__name__,
            e,
        )
        return None


async def _fetch_openf1(params: Dict[str, Any]) -> Dict[str, Any]:
    """Fetch radio rows from OpenF1 using a bounded timeout.

    Kept as a separate function so tests (and future callers) can replace the
    network boundary without touching the fallback policy.
    """
    async with httpx.AsyncClient(timeout=OPENF1_TIMEOUT_SECONDS) as client:
        if params.get("session_key") == "previous":
            resolved = await _resolve_previous_session(client)
            params["session_key"] = resolved or "latest"

        if openf1_service.paywall_active():
            return {
                "status": "unavailable_subscription",
                "source": "openf1",
                "session_used": params.get("session_key"),
                "detail": openf1_service.paywall_detail(),
                "data": [],
            }

        # For "latest", stop early when the newest session has already ended:
        # there is no live radio to fetch.
        if params.get("session_key") == "latest":
            ended = await _latest_session_has_ended(client)
            if openf1_service.paywall_active():
                return {
                    "status": "unavailable_subscription",
                    "source": "openf1",
                    "session_used": params.get("session_key"),
                    "detail": openf1_service.paywall_detail(),
                    "data": [],
                }
            if ended is True:
                return {
                    "status": "success",
                    "source": "empty",
                    "session_used": "latest",
                    "warning": "No live session currently running.",
                    "data": [],
                }

        response = await client.get(OPENF1_TEAM_RADIO_URL, params=params)
        if _is_paywall(response.status_code):
            openf1_service.note_paywall(response.status_code, response.text)
            return {
                "status": "unavailable_subscription",
                "source": "openf1",
                "session_used": params.get("session_key"),
                "detail": openf1_service.paywall_detail(),
                "data": [],
            }

        response.raise_for_status()
        data = response.json()

        return {
            "status": "success",
            "source": "openf1",
            "session_used": params.get("session_key"),
            "data": data if isinstance(data, list) else [],
        }


def _empty_response(session_used: Any, warning: str) -> Dict[str, Any]:
    return {
        "status": "success",
        "source": "empty",
        "session_used": session_used,
        "warning": warning,
        "fallback": False,
        "data": [],
    }


@router.get("")
async def get_team_radio(
    driver_number: Optional[int] = Query(
        None, description="Driver number to filter by"
    ),
    session_key: Optional[str] = Query(
        None,
        description="Session key to filter by (e.g. 9158, 'latest', or 'previous')",
    ),
) -> Dict[str, Any]:
    """Fetch team radio communications from OpenF1 with a SignalR fallback.

    Always returns HTTP 200. ``source`` tells the UI whether the clips came
    from OpenF1 or from the last SignalR capture (``signalr_cache``).
    """
    params: Dict[str, Any] = {}
    if driver_number is not None:
        params["driver_number"] = driver_number
    params["session_key"] = session_key or "latest"

    if openf1_service.paywall_active():
        cached = _cached_radio_response(
            params["session_key"],
            driver_number,
            "OpenF1 live-session paywall is active; using the latest SignalR "
            "radio captures.",
        )
        if cached:
            return cached
        return _unavailable_response(params["session_key"])

    try:
        result = await asyncio.wait_for(
            _fetch_openf1(params),
            timeout=OPENF1_TIMEOUT_SECONDS,
        )
    except (asyncio.TimeoutError, httpx.RequestError, httpx.HTTPStatusError, ValueError) as e:
        logger.warning(
            "OpenF1 team_radio request failed: %s: %s. Trying SignalR cache.",
            type(e).__name__,
            e,
        )
        cached = _cached_radio_response(
            params.get("session_key"),
            driver_number,
            f"OpenF1 request failed ({type(e).__name__}); using the latest "
            "SignalR radio captures.",
        )
        if cached:
            return cached
        return _empty_response(
            params.get("session_key"),
            "External API offline or returned error.",
        )
    except Exception as e:  # noqa: BLE001 - the endpoint must never 500 here
        logger.exception("Unexpected team_radio failure: %s", e)
        cached = _cached_radio_response(
            params.get("session_key"),
            driver_number,
            "OpenF1 request failed; using the latest SignalR radio captures.",
        )
        if cached:
            return cached
        return _empty_response(
            params.get("session_key"),
            "External API offline or returned error.",
        )

    if result.get("status") == "unavailable_subscription":
        session_used = result.get("session_used") or params.get("session_key")
        cached = _cached_radio_response(
            session_used,
            driver_number,
            "OpenF1 live-session paywall is active; using the latest SignalR "
            "radio captures.",
        )
        if cached:
            return cached
        return _unavailable_response(session_used)

    return result
