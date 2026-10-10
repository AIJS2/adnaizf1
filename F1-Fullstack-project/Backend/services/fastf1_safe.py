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

`safe_getattr` turns (1) into "attribute absent", and the loaders below turn
(2) into `None`. Callers decide whether that means "empty payload" or
"pre-season", so no endpoint has to invent data to fill the gap.
"""
from __future__ import annotations

import logging
from typing import Any, Optional

import fastf1
from fastf1.exceptions import DataNotLoadedError

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


def load_session_safe(year: int, round_number: int, session_type: str,
                      **load_kwargs: Any) -> Optional[Any]:
    """
    Build and load a FastF1 session, or return None on any failure.

    Returns None for a session type absent from that event (no Sprint at a
    non-sprint weekend), an out-of-range round, or an upstream data outage.
    Callers treat None as "this session contributes nothing", which is the
    honest payload when the data genuinely does not exist.
    """
    try:
        session = fastf1.get_session(year, round_number, session_type)
    except ValueError as e:
        # Expected: 'Sprint' missing at that event, or an invalid round.
        logger.info(
            f"Session {year}/{round_number}/{session_type} not available: {e}"
        )
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
    events".
    """
    try:
        return fastf1.get_event_schedule(year, include_testing=include_testing)
    except Exception as e:  # noqa: BLE001
        logger.warning(f"get_event_schedule({year}) failed: {type(e).__name__}: {e}")
        return None


def is_valid_year(year: Any) -> bool:
    """
    True when `year` is an integer FastF1 could plausibly answer for.

    Formula 1 has existed since 1950, so anything outside a generous window is
    rejected before it costs a network round-trip and a confusing error.
    """
    if isinstance(year, bool) or not isinstance(year, int):
        return False
    return 1950 <= year <= 2100
