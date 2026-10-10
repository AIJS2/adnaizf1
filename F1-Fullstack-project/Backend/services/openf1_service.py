"""OpenF1 REST API access layer.

Two parts:
  1. Raw fetchers for OpenF1's endpoints (sessions, position, session_result,
     drivers), each returning None instead of raising.
  2. `fetch_classification`, which maps OpenF1's finalized classification into
     the list-of-dicts shape the app's result tables already render.

Why the fallback exists
-----------------------
FastF1 reads F1's official timing archive, which keeps `Laps` / `Time` /
`Points` empty while a session's results are not finalised (the Singapore 2026
Sprint sat that way for hours even after the stewards had ruled). OpenF1
publishes its own `session_result` that was already complete in the same
window, so it fills the gap.

The fallback is a bridge, not a replacement. FastF1 remains the primary source
and everything derived from it — tyre strategy, speed traps, sectors, lap
charts — is untouched. Only the classification rows come from OpenF1.

Contract
--------
Every function here returns `None` instead of raising, so a caller can treat
"OpenF1 unreachable" the same way it already treats "FastF1 has no data".
Use `openf1_status()` for the connection detail that `/health` can surface.
"""

from __future__ import annotations

import logging
import time
from typing import Any, Optional

import httpx

logger = logging.getLogger(__name__)

# OpenF1 has no published SLA and enforces a hard 3 requests/second; exceeding
# it returns 429. Keep the timeout short so a hang cannot stall a request
# handler. The app already runs these calls in a worker thread (see
# routers/race_details.py), so a blocking client is fine — an async client
# would gain nothing without a caller change.
BASE_URL = "https://api.openf1.org/v1"
DEFAULT_TIMEOUT = 10.0

# 429 is transient, so retry it. Retry-After is honoured when present.
MAX_RETRIES = 3
RETRY_BACKOFF = 0.6

# A browser-ish UA: OpenF1 sits behind a CDN that answers bare script UAs
# with a challenge page, which surfaces as a JSON decode error rather than a
# clean HTTP status.
DEFAULT_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
        "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
    ),
    "Accept": "application/json",
}

_client: Optional[httpx.Client] = None


def _get_client() -> httpx.Client:
    """One pooled client for the process; rebuilt if the first call fails.

    Module-level reuse matters because each `httpx.Client` holds its own
    connection pool — constructing one per call throws away keep-alive and
    makes every request pay a fresh TLS handshake.
    """
    global _client
    if _client is not None:
        return _client
    _client = httpx.Client(
        base_url=BASE_URL,
        timeout=DEFAULT_TIMEOUT,
        headers=DEFAULT_HEADERS,
        follow_redirects=True,
    )
    return _client


def _get(path: str, params: Optional[dict[str, Any]] = None) -> Optional[Any]:
    """GET `path` and return the decoded JSON, or None on any failure.

    Returns the raw decoded value (OpenF1 hands back a bare JSON array for
    these endpoints, not an object), so callers must handle "a list" and
    "an error dict" themselves.

    Retries on 429 (rate limit) and on connection errors, since both are
    transient. A 404 is NOT retried: for `/position` it legitimately means
    "no data for this session yet".
    """
    last_error: Optional[str] = None

    for attempt in range(MAX_RETRIES):
        try:
            response = _get_client().get(path, params=params)
            if response.status_code == 429:
                last_error = "HTTP 429 rate limited"
                delay = _retry_delay(response, attempt)
                logger.info(
                    "OpenF1 %s rate limited, retrying in %.1fs (attempt %d/%d)",
                    path, delay, attempt + 1, MAX_RETRIES,
                )
                time.sleep(delay)
                continue

            response.raise_for_status()
        except httpx.HTTPStatusError as e:
            # 4xx other than 429 is a permanent answer for this request.
            logger.warning(
                "OpenF1 %s -> HTTP %s: %s",
                path, e.response.status_code, e.response.text[:200],
            )
            return None
        except httpx.HTTPError as e:
            # Covers timeouts, connection resets and TLS failures.
            last_error = f"{type(e).__name__}: {e}"
            logger.warning(
                "OpenF1 %s failed (%s), retrying (attempt %d/%d)",
                path, last_error, attempt + 1, MAX_RETRIES,
            )
            time.sleep(RETRY_BACKOFF * (attempt + 1))
            continue

        try:
            return response.json()
        except ValueError as e:
            # A CDN challenge page parses as HTML, so this is the symptom you
            # see when the UA is refused rather than a genuine server error.
            logger.warning(
                "OpenF1 %s returned non-JSON (status %s): %s",
                path, response.status_code, e,
            )
            return None

    logger.warning("OpenF1 %s gave up after %d attempts: %s", path, MAX_RETRIES, last_error)
    return None


def _retry_delay(response: httpx.Response, attempt: int) -> float:
    """Sleep length for a 429: the server's Retry-After if it sent one."""
    raw = response.headers.get("Retry-After")
    if raw:
        try:
            return float(raw)
        except ValueError:
            pass  # HTTP-date form; fall back to backoff
    return RETRY_BACKOFF * (attempt + 1)


def get_sessions(year: int) -> Optional[list[dict[str, Any]]]:
    """Every session OpenF1 has for `year`, or None if the request failed.

    Returns the list in the order the API sends it (chronological), so
    `sessions[-1]` is the most recent session of the season.
    """
    data = _get("/sessions", params={"year": year})
    if not isinstance(data, list):
        logger.warning("OpenF1 /sessions?year=%s did not return a list", year)
        return None
    return data


def get_latest_session(year: int, with_data: bool = True) -> Optional[dict[str, Any]]:
    """The most recent session of `year` that OpenF1 actually has data for.

    `with_data=True` walks backwards from the newest session until one returns
    a non-empty position stream. This matters because the schedule includes
    future races: sorting by `date_start` alone returns a race that has not
    happened yet (and a 404 on `/position`), which is useless as a data source.

    Set `with_data=False` for the plain "newest on the calendar" answer.
    """
    sessions = get_sessions(year)
    if not sessions:
        return None

    dated = [s for s in sessions if s.get("date_start")]
    if not dated:
        logger.warning("OpenF1 /sessions?year=%s has no dated sessions", year)
        return None

    newest_first = sorted(dated, key=lambda s: s["date_start"], reverse=True)
    if not with_data:
        return newest_first[0]

    # Walk back through the calendar. OpenF1's 2026 schedule runs to December,
    # but its position data only extends to Madrid (Sep 12) — everything after
    # that is future races that 404. Scanning the whole season costs one
    # request per session; at 3 req/sec with a throttle that is up to ~45s, so
    # prefer calling get_positions() directly when you already know the key.
    for session in newest_first:
        key = session.get("session_key")
        if key is not None and get_positions(key):
            return session
        time.sleep(0.35)  # stay under the 3 req/sec limit

    logger.info("OpenF1: no %s session has position data", year)
    return None


def get_latest_session_key(year: int, with_data: bool = True) -> Optional[int]:
    """`session_key` of the most recent session of `year`, or None."""
    session = get_latest_session(year, with_data=with_data)
    if session is None:
        return None
    return session.get("session_key")


def get_positions(session_key: int) -> Optional[list[dict[str, Any]]]:
    """Raw position samples for `session_key`, or None.

    NOTE: this is a time-series of samples, not a classification — a driver
    appears many times, once per sample. Use `session_result` for standings.
    """
    return _get("/position", params={"session_key": session_key})


def get_session_result(session_key: int) -> Optional[list[dict[str, Any]]]:
    """Finalized classification for `session_key`, or None.

    This is the endpoint that had data while FastF1's own results frame was
    still empty. It is fetched here so the payload shape can be compared, but
    nothing consumes it yet.
    """
    return _get("/session_result", params={"session_key": session_key})


def get_drivers(session_key: int) -> Optional[list[dict[str, Any]]]:
    """Driver roster for `session_key` (name, team, number), or None.

    Needed to turn a `driver_number` into a displayable name, since the
    position/session_result payloads carry only the number.
    """
    return _get("/drivers", params={"session_key": session_key})


def openf1_status() -> dict[str, Any]:
    """Connection probe for the /health endpoint.

    Deliberately uses ONE request. An earlier version probed several
    endpoints, which tripped OpenF1's 3/sec limit and made /health flaky.
    """
    sessions = get_sessions(2026)
    return {
        "connected": sessions is not None,
        "base_url": BASE_URL,
    }


# ===========================================================================
# Fallback mapping: OpenF1 classification -> the app's result-row shape
# ===========================================================================

# FastF1 session code -> OpenF1 session_name. OpenF1 has no round number, so
# resolving a session needs the circuit too (see session_key_for).
SESSION_CODE_TO_NAME = {
    "FP1": "Practice 1",
    "FP2": "Practice 2",
    "FP3": "Practice 3",
    "SQ": "Sprint Qualifying",
    "Q": "Qualifying",
    "S": "Sprint",
    "R": "Race",
}

# Sessions where `duration` is a cumulative race time (so a gap is derivable).
# Qualifying-type sessions report per-segment times instead.
RACE_LIKE_SESSION_CODES = frozenset({"S", "R"})


def _classify_position(row: dict[str, Any]) -> int:
    """A sortable finishing position.

    Retired cars arrive with `position: None`, so they are pushed to the end in
    the order the API returned them rather than dropped or sorted ahead of
    finishers.
    """
    position = row.get("position")
    if position is None:
        return 10_000
    try:
        return int(position)
    except (TypeError, ValueError):
        return 10_000


def _status_for(row: dict[str, Any]) -> str:
    """Map OpenF1's retirement flags onto the frontend's status vocabulary."""
    if row.get("dnf"):
        return "DNF"
    if row.get("dns"):
        return "DNS"
    if row.get("dsq"):
        return "DSQ"
    return ""


def _int_or_zero(raw: Any) -> int:
    if raw is None:
        return 0
    try:
        return int(float(raw))
    except (TypeError, ValueError):
        return 0


def _format_gap(seconds: Optional[float]) -> str:
    """Seconds -> "+1:02.591", matching the FastF1 path's gap format."""
    if seconds is None or seconds <= 0:
        return ""
    minutes, rest = divmod(seconds, 60)
    if minutes >= 1:
        return f"+{int(minutes)}:{rest:06.3f}"
    return f"+{rest:.3f}s"


def fetch_classification(
    session_key: Optional[int],
    year: int,
    round_number: int,
    session_type: str,
) -> Optional[list[dict[str, Any]]]:
    """Fetch OpenF1's classification and map it to the app's result-row shape.

    Returns None when OpenF1 has no data for this session, so the caller keeps
    whatever FastF1 produced. Returns a list on success.

    `session_type` is the FastF1 code ('S', 'R', 'Q', ...). It decides whether
    a gap is derivable: race-like sessions get one from the duration field,
    qualifying sessions do not.

    Rows deliberately leave `time` empty and only fill `gap_to_leader` /
    `interval` when a gap is genuinely derivable. OpenF1's `duration` is not
    FastF1's `Time` — on race-like sessions it is a total race time, on
    qualifying sessions it is a list of per-segment times. Fabricating a
    plausible-looking race time would be worse than the honest empty string
    the frontend already renders as an "Awaiting Official Results" badge.
    """
    if session_key is None:
        return None

    rows = get_session_result(session_key)
    if not rows:
        logger.info(
            "OpenF1 has no session_result for %s/%s/%s (key=%s)",
            year, round_number, session_type, session_key,
        )
        return None

    # OpenF1 payloads carry only driver_number, so the roster is the only way
    # to get a displayable name and team.
    roster = {
        d.get("driver_number"): d
        for d in (get_drivers(session_key) or [])
        if d.get("driver_number") is not None
    }

    is_race_like = session_type in RACE_LIKE_SESSION_CODES

    # The leader's duration is the baseline every gap is measured against.
    leader_duration: Optional[float] = None
    if is_race_like:
        for row in rows:
            raw = row.get("duration")
            if row.get("position") == 1 and isinstance(raw, (int, float)):
                leader_duration = float(raw)
                break

    mapped: list[dict[str, Any]] = []
    for row in sorted(rows, key=_classify_position):
        info = roster.get(row.get("driver_number"), {})

        gap = ""
        if is_race_like and leader_duration is not None:
            raw = row.get("duration")
            if isinstance(raw, (int, float)):
                gap = _format_gap(float(raw) - leader_duration)
            # else: retired car with no time recorded -> gap stays ""

        position = row.get("position")
        mapped.append({
            "position": _classify_position(row) if position is not None else 0,
            "driver_number": _int_or_zero(row.get("driver_number")),
            "full_name": info.get("full_name") or "Unknown driver",
            "team_name": info.get("team_name") or "",
            "abbreviation": info.get("name_acronym", ""),
            "status": _status_for(row),
            "points": _int_or_zero(row.get("points")),
            "laps": _int_or_zero(row.get("number_of_laps")),
            "time": "",
            "gap_to_leader": gap,
            "interval": gap,
        })

    logger.info(
        "OpenF1 fallback supplied %d rows for %s/%s/%s (key=%s)",
        len(mapped), year, round_number, session_type, session_key,
    )
    return mapped


def session_key_for(
    year: int,
    round_number: int,
    session_type: str,
    circuit: Optional[str] = None,
) -> Optional[int]:
    """Resolve an OpenF1 `session_key` for a FastF1 session code.

    OpenF1 keys sessions by meeting (circuit), not by round number, so the
    circuit must be supplied to disambiguate: a season has 20+ sessions named
    "Race". Without it, any name match is ambiguous and this returns None
    rather than silently picking the wrong race.

    Costs one request. Callers should cache the result.
    """
    wanted = SESSION_CODE_TO_NAME.get(session_type)
    if wanted is None:
        return None

    sessions = get_sessions(year)
    if not sessions:
        return None

    matches = [
        s for s in sessions
        if s.get("session_name") == wanted and s.get("session_key")
    ]
    if circuit:
        needle = circuit.strip().lower()
        narrowed = [
            s for s in matches
            if needle in str(s.get("location", "")).lower()
            or needle in str(s.get("circuit_short_name", "")).lower()
        ]
        if len(narrowed) == 1:
            return narrowed[0]["session_key"]
        if len(narrowed) > 1:
            logger.warning(
                "OpenF1: %d '%s' sessions match circuit %r in %s",
                len(narrowed), wanted, circuit, year,
            )
        matches = narrowed or matches

    if len(matches) != 1:
        logger.debug(
            "OpenF1: %d '%s' sessions in %s (need circuit to disambiguate)",
            len(matches), wanted, year,
        )
        return None
    return matches[0]["session_key"]


__all__ = [
    "get_sessions",
    "get_latest_session",
    "get_latest_session_key",
    "get_positions",
    "get_session_result",
    "get_drivers",
    "openf1_status",
    "fetch_classification",
    "session_key_for",
]
