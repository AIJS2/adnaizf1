"""Lap telemetry built from OpenF1 when F1's timing archive has no car data.

Why this exists
---------------
FastF1 reads F1's official timing archive. For most 2026 rounds that archive
carries lap times for only a handful of sessions, and no per-car channels at
all. OpenF1 keeps `car_data` (speed/throttle/brake/gear/DRS) and `location`
(x/y) for those same sessions, so the Lap Telemetry tab can still draw real
traces instead of greeting every round with an empty state.

OpenF1 has no distance channel, so distance is integrated from speed at the
sample rate. Both channels come from the same F1 feed and are sampled several
times per second, which is exactly the resolution the charts need.

The frames built here use FastF1's column names (`Speed`, `Throttle`, `Brake`,
`nGear`, `DRS`, `Distance`, `Time`, `X`, `Y`) so the existing assembly code in
`telemetry_service` can consume either source unchanged.

Contract
--------
`collect()` returns None only when OpenF1 has no session for the round (the
caller then reports the honest "no telemetry anywhere" message). Otherwise it
returns frames plus per-driver reasons, so one driver's missing lap never hides
another driver's data.
"""

from __future__ import annotations

import logging
import threading
import time
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from typing import Any, Optional

import pandas as pd

from services import openf1_service
from services.fastf1_safe import load_event_schedule

logger = logging.getLogger(__name__)

# OpenF1 allows 3 requests/second. Spacing calls avoids the 429 retries that
# would otherwise dominate a 10-driver comparison.
_MIN_REQUEST_SPACING = 0.4
_throttle_lock = threading.Lock()
_last_request_at = 0.0


def _throttle() -> None:
    """Keep consecutive OpenF1 calls below the 3 req/s limit."""
    global _last_request_at
    with _throttle_lock:
        wait = _MIN_REQUEST_SPACING - (time.monotonic() - _last_request_at)
        if wait > 0:
            time.sleep(wait)
        _last_request_at = time.monotonic()


def _naive_utc(raw: Any) -> Optional[datetime]:
    """Parse an OpenF1 timestamp into a naive UTC datetime.

    OpenF1 timestamps arrive either naive or with a `+00:00` offset; the
    `date>` / `date<` filters accept the naive form without URL-encoding
    surprises.
    """
    if not raw:
        return None
    try:
        parsed = datetime.fromisoformat(str(raw).replace("Z", "+00:00"))
    except ValueError:
        return None
    if parsed.tzinfo is not None:
        parsed = parsed.astimezone(timezone.utc).replace(tzinfo=None)
    return parsed


def _iso(moment: datetime) -> str:
    return moment.strftime("%Y-%m-%dT%H:%M:%S.%f")


def _circuit_for_round(year: int, round_number: int) -> Optional[str]:
    """The schedule's circuit name, which disambiguates OpenF1's 'Race' sessions."""
    schedule = load_event_schedule(year)
    if schedule is None or getattr(schedule, "empty", True):
        return None
    if "RoundNumber" not in schedule.columns:
        return None
    rows = schedule[schedule["RoundNumber"] == round_number]
    if rows.empty:
        return None
    location = rows.iloc[0].get("Location")
    return str(location) if pd.notna(location) else None


def _format_lap_time(seconds: float) -> str:
    minutes, rest = divmod(float(seconds), 60)
    return f"{int(minutes)}:{rest:06.3f}"


def _pick_lap(driver_laps: list[dict[str, Any]], lap: Optional[int]):
    """The requested lap, or the fastest clean lap when none was requested."""
    timed = [
        row for row in driver_laps
        if isinstance(row.get("lap_duration"), (int, float))
        and row.get("lap_duration")
        and row.get("date_start")
    ]
    if not timed:
        return None
    if lap is not None:
        for row in timed:
            if row.get("lap_number") == lap:
                return row
        return None
    # A pit-out lap is never the fastest, but exclude it explicitly so a
    # red-flagged session cannot pick one by accident.
    clean = [row for row in timed if not row.get("is_pit_out_lap")] or timed
    return min(clean, key=lambda row: float(row["lap_duration"]))


def _compound_for(
    stints: list[dict[str, Any]],
    driver_number: Any,
    lap_number: Any,
) -> str:
    if lap_number is None:
        return "UNKNOWN"
    try:
        lap_value = int(lap_number)
    except (TypeError, ValueError):
        return "UNKNOWN"
    for stint in stints:
        if stint.get("driver_number") != driver_number:
            continue
        try:
            first = int(stint.get("lap_start"))
            last = int(stint.get("lap_end"))
        except (TypeError, ValueError):
            continue
        if first <= lap_value <= last:
            return str(stint.get("compound") or "UNKNOWN").upper()
    return "UNKNOWN"


def _frame_from_rows(
    car_rows: list[dict[str, Any]],
    location_rows: Optional[list[dict[str, Any]]],
) -> Optional[pd.DataFrame]:
    """Turn OpenF1 samples into the FastF1-shaped car-channel frame."""
    car = pd.DataFrame(car_rows or [])
    required = {"date", "speed", "throttle", "brake", "n_gear"}
    if car.empty or not required.issubset(car.columns):
        return None

    car = car.copy()
    car["ts"] = pd.to_datetime(car["date"], utc=True, errors="coerce")
    car = car.dropna(subset=["ts", "speed"]).sort_values("ts")
    if car.empty:
        return None

    frame = pd.DataFrame(
        {
            "ts": car["ts"],
            "Speed": pd.to_numeric(car["speed"], errors="coerce"),
            "Throttle": pd.to_numeric(car["throttle"], errors="coerce"),
            "Brake": pd.to_numeric(car["brake"], errors="coerce"),
            "nGear": pd.to_numeric(car["n_gear"], errors="coerce"),
            "DRS": pd.to_numeric(car.get("drs"), errors="coerce"),
        }
    )
    frame = frame.dropna(subset=["Speed"])
    if frame.empty:
        return None

    # X/Y live in a separate stream and are sampled faster than car data.
    # Nearest-sample matching within 2s mirrors FastF1's position merge.
    if location_rows:
        loc = pd.DataFrame(location_rows)
        if {"date", "x", "y"}.issubset(loc.columns):
            loc = loc.copy()
            loc["ts"] = pd.to_datetime(loc["date"], utc=True, errors="coerce")
            loc = loc.dropna(subset=["ts", "x", "y"]).sort_values("ts")
            if not loc.empty:
                loc = loc.rename(columns={"x": "X", "y": "Y"})
                frame = pd.merge_asof(
                    frame,
                    loc[["ts", "X", "Y"]],
                    on="ts",
                    direction="nearest",
                    tolerance=pd.Timedelta("2s"),
                )

    frame["Time"] = frame["ts"] - frame["ts"].iloc[0]

    # OpenF1 has no Distance channel: integrate speed over time. The trapezoid
    # rule is accurate at these sample rates; the 2s cap stops a dropped
    # connection from inventing a straight line worth of distance.
    elapsed = frame["Time"].dt.total_seconds()
    step = elapsed.diff().fillna(0.0).clip(lower=0.0, upper=2.0)
    previous_speed = frame["Speed"].shift(1).fillna(frame["Speed"])
    frame["Distance"] = (
        (frame["Speed"] + previous_speed) / 2.0 / 3.6 * step
    ).cumsum()

    return frame


def collect(
    year: int,
    round_number: int,
    abbreviations: list[str],
    lap: Optional[int] = None,
) -> Optional[dict[str, Any]]:
    """Build car-channel frames for `abbreviations` from OpenF1.

    Returns None when OpenF1 has no race session for this round, otherwise a
    dict with:
      - `frames`: [(abbreviation, driver_info, DataFrame), ...]
      - `missing`: {abbreviation: reason} for drivers that have no usable data
      - `no_laps`: set of abbreviations with no timed lap at all
      - `session_key`: the resolved OpenF1 session key
    """
    _throttle()
    session_key = openf1_service.session_key_for(
        year, round_number, "R", circuit=_circuit_for_round(year, round_number),
    )
    if session_key is None:
        logger.info("OpenF1 has no race session for %s round %s", year, round_number)
        return None

    _throttle()
    all_laps = openf1_service.get_laps(session_key)
    if not all_laps:
        reason = "OpenF1 has no lap data for this race."
        return {
            "frames": [],
            "missing": {abbr: reason for abbr in abbreviations},
            "no_laps": set(),
            "session_key": session_key,
        }

    _throttle()
    roster_rows = openf1_service.get_drivers(session_key) or []
    roster: dict[str, dict[str, Any]] = {}
    for row in roster_rows:
        acronym = str(row.get("name_acronym") or "").upper()
        if acronym:
            roster[acronym] = row

    _throttle()
    stints = openf1_service.get_stints(session_key) or []

    laps_by_driver: dict[Any, list[dict[str, Any]]] = defaultdict(list)
    for row in all_laps:
        laps_by_driver[row.get("driver_number")].append(row)

    frames: list[tuple[str, dict[str, Any], pd.DataFrame]] = []
    missing: dict[str, str] = {}
    no_laps: set[str] = set()

    for abbreviation in abbreviations:
        drv = abbreviation.upper()
        entry = roster.get(drv)
        if entry is None:
            missing[drv] = "OpenF1 has no entry for this driver in this race."
            continue

        number = entry.get("driver_number")
        target = _pick_lap(laps_by_driver.get(number, []), lap)
        if target is None:
            no_laps.add(drv)
            continue

        start = _naive_utc(target.get("date_start"))
        if start is None:
            no_laps.add(drv)
            continue
        end = start + timedelta(seconds=float(target["lap_duration"]))

        _throttle()
        car_rows = openf1_service.get_car_data(
            session_key, number, _iso(start), _iso(end),
        )
        if not car_rows:
            missing[drv] = "OpenF1 has no car telemetry for this driver's lap."
            continue

        # The track map only needs one driver's X/Y (the first valid driver's
        # positions become the map's geometry), so later drivers skip the
        # location request entirely.
        location_rows = []
        if not frames:
            _throttle()
            location_rows = openf1_service.get_location(
                session_key, number, _iso(start), _iso(end),
            ) or []

        frame = _frame_from_rows(car_rows, location_rows)
        if frame is None or frame.empty or len(frame) < 5:
            missing[drv] = "OpenF1 has no car telemetry for this driver's lap."
            continue

        moving = frame.loc[frame["Speed"] > 30, "Speed"]
        min_speed = (
            round(float(moving.min()), 1)
            if not moving.empty
            else round(float(frame["Speed"].min()), 1)
        )
        frames.append(
            (
                drv,
                {
                    "name": str(entry.get("full_name") or drv).title(),
                    "team": entry.get("team_name") or "",
                    "lap_time": _format_lap_time(float(target["lap_duration"])),
                    "compound": _compound_for(
                        stints, number, target.get("lap_number"),
                    ),
                    "max_speed": round(float(frame["Speed"].max()), 1),
                    "min_speed": min_speed,
                    "avg_speed": round(float(frame["Speed"].mean()), 1),
                },
                frame,
            )
        )

    return {
        "frames": frames,
        "missing": missing,
        "no_laps": no_laps,
        "session_key": session_key,
    }


def _status_label(result: dict[str, Any]) -> str:
    """The telemetry picker's status vocabulary, matching FastF1's wording."""
    if result.get("dns"):
        return "Did not start"
    if result.get("dsq"):
        return "Disqualified"
    if result.get("dnf"):
        return "DNF"
    return "Finished"


def driver_options(year: int, round_number: int) -> list[dict[str, Any]]:
    """OpenF1's entry list, used when FastF1 has no results frame at all."""
    _throttle()
    session_key = openf1_service.session_key_for(
        year, round_number, "R", circuit=_circuit_for_round(year, round_number),
    )
    if session_key is None:
        return []

    _throttle()
    roster = openf1_service.get_drivers(session_key) or []
    if not roster:
        return []

    _throttle()
    results = openf1_service.get_session_result(session_key) or []
    by_number = {
        row.get("driver_number"): row
        for row in results
        if row.get("driver_number") is not None
    }

    options = []
    for row in roster:
        acronym = str(row.get("name_acronym") or "").upper()
        if not acronym:
            continue
        result = by_number.get(row.get("driver_number"), {})
        options.append(
            {
                "abbreviation": acronym,
                "full_name": str(row.get("full_name") or acronym).title(),
                "team_name": row.get("team_name") or "",
                "status": _status_label(result),
            }
        )
    return options
