"""Shared FastF1 access helpers.

Every service in this app needs to load a session and then read attributes
that are only valid once `Session.load()` has actually populated them. FastF1
behaves in three ways that each used to surface as a 500 / bogus error
envelope, so they are handled once here:

1. `session.load()` completes but leaves `laps` / `weather_data` unpopulated
   (upstream data not yet mirrored for a recently-finished session). Accessing
   the attribute then raises `DataNotLoadedError`.
2. `fastf1.get_session()` raises `ValueError` for a session type that does
   not exist at that event ("Session type 'Sprint' does not exist for this
   event") or for an out-of-range round ("Invalid round: 9999").
3. `fastf1.get_event_schedule()` raises `ValueError` for a year it has no
   data for at all ("Failed to load any schedule data.").
4. FastF1's HTTP layer calls `requests` with no timeout at all, so a stalled
   livetiming.formula1.com connection leaves `session.load()` reading
   forever — the worker thread and the request that triggered it never
   finish. `_patch_fastf1_http_timeouts` bounds that once per process.

`safe_getattr` turns (1) into "attribute absent", and the loaders below turn
(2) into `None`. Callers decide whether that means "empty payload" or
"pre-season", so no endpoint has to invent data to fill the gap.
"""

from __future__ import annotations

import functools
import logging
from typing import Any, Optional

import fastf1
from fastf1.core import DataNotLoadedError

logger = logging.getLogger(__name__)

# Optional import: fastf1 exposes SessionNotAvailableError from `_api` only in
# newer releases, so resolve it defensively and fall back to a tuple that
# still matches the base Exception.
try:  # pragma: no cover - depends on the installed fastf1 version
    from fastf1._api import SessionNotAvailableError as _SNA

    SESSION_NOT_AVAILABLE: tuple[type[BaseException], ...] = (_SNA,)
except Exception:  # pragma: no cover
    SESSION_NOT_AVAILABLE = ()


def safe_getattr(obj: Any, name: str, default: Any = None) -> Any:
    """
    Read `obj.name`, returning `default` when the value is unloaded.

    `hasattr(session, 'laps')` is True even before load, so the old
    `hasattr(...) or .empty` guard raised `DataNotLoadedError` instead of
    short-circuiting. This reads the attribute and swallows exactly that
    failure.
    """
    try:
        value = getattr(obj, name)
    except DataNotLoadedError:
        return default
    except Exception as e:  # noqa: BLE001 - defensive: never crash on a probe
        logger.warning(f"safe_getattr({name}) failed: {type(e).__name__}: {e}")
        return default
    if value is None:
        return default
    return value


def has_rows(obj: Any, name: str) -> bool:
    """True when `obj.name` is loaded AND non-empty."""
    value = safe_getattr(obj, name)
    if value is None:
        return False
    try:
        return not value.empty
    except AttributeError:
        try:
            return len(value) > 0
        except TypeError:
            return bool(value)


# --- Event metadata sanitisation -------------------------------------------
# Upstream ships one corrupt event in the 2026 schedule: round 16 is the
# Bahrain Grand Prix, but its Location reads "Kuala Lumpur" and its official
# name "... BAHRAIN GRAND PRIX IN MALAYSIA 2026". Every service reads the
# schedule through `load_event_schedule`, so the metadata is normalised once
# here and all consumers (dashboard, races, championship, race details) serve
# the same sane event.
_CORRUPT_EVENT_FIXES: tuple[dict[str, str], ...] = (
    {
        "name_contains": "bahrain grand prix",
        "location_contains": "kuala lumpur",
        "EventName": "Bahrain Grand Prix",
        "Location": "Sakhir",
        "Country": "Bahrain",
        "official_name_strip": r"(?i)\s+in\s+malaysia",
    },
)


def sanitize_event_schedule(schedule: Any) -> Any:
    """Fix known-corrupt event metadata on a FastF1 schedule frame."""
    if schedule is None or getattr(schedule, "empty", True):
        return schedule

    for fix in _CORRUPT_EVENT_FIXES:
        try:
            rows = schedule["EventName"].astype(str).str.lower().str.contains(
                fix["name_contains"], na=False
            ) & schedule["Location"].astype(str).str.lower().str.contains(
                fix["location_contains"], na=False
            )
            if not rows.any():
                continue
            for column in ("EventName", "Location", "Country"):
                if column in schedule.columns:
                    schedule.loc[rows, column] = fix[column]
            if "OfficialEventName" in schedule.columns and fix.get(
                "official_name_strip"
            ):
                schedule.loc[rows, "OfficialEventName"] = (
                    schedule.loc[rows, "OfficialEventName"]
                    .astype(str)
                    .str.replace(fix["official_name_strip"], "", regex=True)
                )
            logger.warning(
                "Sanitised corrupt event metadata for round(s) %s: location "
                "'%s' -> '%s', event '%s'.",
                schedule.loc[rows, "RoundNumber"].tolist(),
                fix["location_contains"],
                fix["Location"],
                fix["EventName"],
            )
        except Exception as e:  # noqa: BLE001 - never fail a load over a fixup
            logger.warning(f"Could not sanitise schedule metadata: {e}")
    return schedule


_CACHE_ENSURE_DONE = False

# FastF1's request wrappers take no timeout; inject a bounded (connect, read)
# one wherever FastF1 set none of its own. The read timeout applies to each
# read of the response body, so large-but-alive downloads are unaffected.
_FASTF1_HTTP_TIMEOUT = (10, 30)
_HTTP_TIMEOUTS_PATCHED = False


def _patch_fastf1_http_timeouts() -> None:
    """Give FastF1's `requests_get`/`requests_post` a default HTTP timeout.

    Without one, a single stalled upstream connection hangs `session.load()`
    indefinitely (observed live: a cold race-details compute was stuck in a
    chunked read for 10+ minutes until the server was restarted). With the
    timeout a stall fails like any other missing endpoint — data the app is
    already built to tolerate. Idempotent; runs once per process.
    """
    global _HTTP_TIMEOUTS_PATCHED
    if _HTTP_TIMEOUTS_PATCHED:
        return
    try:
        import fastf1.req

        for name in ("requests_get", "requests_post"):
            original = fastf1.req.Cache.__dict__[name].__func__

            @functools.wraps(original)
            def patched(cls, url, _original=original, **kwargs):
                kwargs.setdefault("timeout", _FASTF1_HTTP_TIMEOUT)
                return _original(cls, url, **kwargs)

            setattr(fastf1.req.Cache, name, classmethod(patched))
    except Exception as e:  # noqa: BLE001 - a missing knob must never break loads
        logger.warning(f"Could not add FastF1 HTTP timeouts: {type(e).__name__}: {e}")
    _HTTP_TIMEOUTS_PATCHED = True


def _ensure_fastf1_cache() -> None:
    """Point FastF1 at the app's cache dir even in scripts that never import
    `config.cache` (which normally enables it at import time).

    Without this, FastF1 falls back to its default %TEMP%\\fastf1 cache, whose
    req.py opens directories with `os.makedirs` (no exist_ok) — raising
    FileExistsError on Windows and hanging every request.
    """
    _patch_fastf1_http_timeouts()
    global _CACHE_ENSURE_DONE
    if _CACHE_ENSURE_DONE:
        return
    try:
        from config.cache import _FASTF1_CACHE_DIR  # local import avoids cycles

        fastf1.Cache.enable_cache(_FASTF1_CACHE_DIR)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"Could not enable the FastF1 cache: {e}")
    _CACHE_ENSURE_DONE = True


def load_session_safe(
    year: int, round_number: int, session_type: str, **load_kwargs: Any
) -> Optional[Any]:
    """
    Build and load a FastF1 session, or return None on any failure.

    Returns None for a session type absent from that event (no Sprint at a
    non-sprint weekend), an out-of-range round, or an upstream data outage.
    Callers treat None as "this session contributes nothing", which is the
    honest payload when the data genuinely does not exist.
    """
    _ensure_fastf1_cache()
    try:
        session = fastf1.get_session(year, round_number, session_type)
    except ValueError as e:
        # Expected: 'Sprint' missing at that event, or an invalid round.
        logger.info(f"Session {year}/{round_number}/{session_type} not available: {e}")
        return None
    except Exception as e:  # noqa: BLE001
        logger.warning(
            f"get_session({year}, {round_number}, {session_type}) failed: "
            f"{type(e).__name__}: {e}"
        )
        return None

    try:
        session.load(**load_kwargs)
    except Exception as e:  # noqa: BLE001
        # SessionNotAvailableError and friends land here. The session object
        # still exists, so return it and let safe_getattr/has_rows decide what
        # is actually populated — a partial load still yields results.
        logger.warning(
            f"load({year}, {round_number}, {session_type}) "
            f"{dict(load_kwargs)} failed: {type(e).__name__}: {e}"
        )
    return session


def load_event_schedule(year: int, include_testing: bool = False):
    """
    Load a season schedule, returning None when FastF1 has no schedule data.

    An empty-but-valid frame (0 rows) is returned as-is; only an exception
    yields None, so callers can tell "no such season" from "season with no
    events". Known-corrupt upstream event metadata is sanitised before the
    schedule is handed to callers.
    """
    _ensure_fastf1_cache()
    try:
        schedule = fastf1.get_event_schedule(year, include_testing=include_testing)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"get_event_schedule({year}) failed: {type(e).__name__}: {e}")
        return None
    return sanitize_event_schedule(schedule)


def is_valid_year(year: Any) -> bool:
    """
    True when `year` is an integer FastF1 could plausibly answer for.

    Formula 1 has existed since 1950, so anything outside a generous window is
    rejected before it costs a network round-trip and a confusing error.
    """
    if isinstance(year, bool) or not isinstance(year, int):
        return False
    return 1950 <= year <= 2100
