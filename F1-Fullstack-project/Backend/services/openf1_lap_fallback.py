"""Rebuild the lap-derived race-detail blocks from OpenF1 data.

FastF1 reads F1's official timing archive. For many 2026 rounds that archive
holds only session metadata: every timing request answers
`SessionNotAvailableError("No data for this session!")`, and FastF1 backfills
the classification from Ergast/Jolpica. The result is a race page whose
results tables work while every lap-derived view (tyre strategy, speed &
sectors, weather, the lap charts) stays empty.

OpenF1 publishes laps, stints and weather for those sessions, so this module
rebuilds the exact block shapes `race_details_service` derives from
`session.laps`:

    fastest_lap, tyre_strategy, speed_traps, sector_matrix,
    weather_info, lap_chart, gap_chart, lap_times_chart

plus the fastest-lap tables used by sessions without a FastF1 classification
(practices and sprint qualifying) and the starting grid, rebuilt from the
opening samples of OpenF1's position stream.

The caller runs this only for blocks that stayed empty, so FastF1 output is
never replaced — rounds its archive can serve keep their original data.

Documented approximations (user-visible, hence called out here):
- OpenF1 laps carry no `Position` column, so the lap chart orders drivers by
  the timestamp they crossed the start/finish line for that lap
  (`date_start`), which is the running order at the line. A pit stop can
  shift a single lap's sample.
- The gap chart uses the same `date_start` deltas (gap at the line) instead
  of FastF1's gap at lap end.
"""

from __future__ import annotations

import logging
import math
import time
from datetime import datetime
from typing import Any, Optional

from services import openf1_service

logger = logging.getLogger(__name__)

# OpenF1 enforces ~3 requests/second. One enrichment pass makes up to four
# requests per session, so a small pause between them avoids 429 retries on
# a cold race page.
_REQUEST_PAUSE_SECONDS = 0.35

# Sanity bounds mirroring the FastF1 path in race_details_service: gaps over
# three minutes and "lap times" over five minutes are data artifacts (pit
# loops, red flags), not values the charts should plot.
_MAX_GAP_SECONDS = 180.0
_MAX_LAP_SECONDS = 300.0

# A driver's first /position sample lands inside the same second as the
# session's first (all 22 drivers at +0.0s in both probed races). The window
# tolerates a slow feed without ever admitting a mid-race sample, which would
# move a driver who pitted or retired early out of their starting slot.
_GRID_WINDOW_SECONDS = 8.0


def _pause() -> None:
    time.sleep(_REQUEST_PAUSE_SECONDS)


# --- value helpers -----------------------------------------------------------


def _as_float(value: Any) -> Optional[float]:
    """A finite float, or None for None/bool/NaN/unparseable input."""
    if value is None or isinstance(value, bool):
        return None
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    if math.isnan(number):
        return None
    return number


def _as_int(value: Any) -> Optional[int]:
    number = _as_float(value)
    return None if number is None else int(number)


def _fmt_lap_time(seconds: Optional[float]) -> str:
    """Seconds -> '1:23.456', matching the FastF1 path's format."""
    if seconds is None or seconds <= 0:
        return ""
    minutes, rest = divmod(seconds, 60)
    return f"{int(minutes)}:{rest:06.3f}"


def _fmt_sector(seconds: Optional[float]) -> str:
    """Seconds -> '12.345'; '-' when the driver has no sector time."""
    if seconds is None:
        return "-"
    return f"{seconds:.3f}"


def _parse_dt(raw: Any) -> Optional[datetime]:
    if not isinstance(raw, str):
        return None
    try:
        return datetime.fromisoformat(raw)
    except ValueError:
        return None


# --- roster ------------------------------------------------------------------


def _build_roster(driver_rows: Optional[list[dict[str, Any]]]) -> dict[int, dict[str, str]]:
    """`/drivers` rows -> {driver_number: {full_name, team_name, abbreviation}}."""
    roster: dict[int, dict[str, str]] = {}
    for row in driver_rows or []:
        number = _as_int(row.get("driver_number"))
        if number is None:
            continue
        roster[number] = {
            "full_name": str(row.get("full_name") or ""),
            "team_name": str(row.get("team_name") or ""),
            "abbreviation": str(row.get("name_acronym") or "").upper(),
        }
    return roster


def _meta(roster: dict[int, dict[str, str]], number: int) -> tuple[str, str, str]:
    info = roster.get(number) or {}
    return (
        info.get("full_name") or "",
        info.get("team_name") or "",
        info.get("abbreviation") or "",
    )


# --- fastest-lap tables (practices, sprint qualifying) -----------------------


def build_fastest_lap_rows(session_key: Optional[int]) -> list[dict[str, Any]]:
    """Practice-style result rows for a session with no FastF1 classification.

    One row per driver, ranked by their fastest clean lap — the same shape
    `process_practice_session` returns for FastF1 data.
    """
    if session_key is None:
        return []

    roster = _build_roster(openf1_service.get_drivers(session_key))
    _pause()
    laps = openf1_service.get_laps(session_key)
    if not laps:
        return []

    best: dict[int, float] = {}
    lap_counts: dict[int, int] = {}
    for row in laps:
        number = _as_int(row.get("driver_number"))
        if number is None:
            continue
        lap_counts[number] = lap_counts.get(number, 0) + 1
        duration = _as_float(row.get("lap_duration"))
        if duration is None or duration <= 0 or row.get("is_pit_out_lap"):
            continue
        if number not in best or duration < best[number]:
            best[number] = duration

    rows: list[dict[str, Any]] = []
    for number, _duration in sorted(best.items(), key=lambda item: item[1]):
        full_name, team_name, _abbr = _meta(roster, number)
        if not full_name:
            continue
        rows.append({
            "position": len(rows) + 1,
            "driver_number": number,
            "full_name": full_name,
            "team_name": team_name,
            "time": _fmt_lap_time(best[number]),
            "laps": lap_counts.get(number, 0),
        })
    return rows


def build_starting_grid(session_key: Optional[int]) -> list[dict[str, Any]]:
    """Starting grid from OpenF1's opening `/position` samples.

    OpenF1 has no `/starting_grid` endpoint — every 2026 session answers 404 —
    but its position stream opens on the grid itself: in both probed races all
    22 drivers reported their slot within the first second, matching the
    qualifying order plus any penalties. Each driver's first sample therefore
    is their starting position. Rows come back in the same shape
    `race_details_service` builds from FastF1's `GridPosition`.
    """
    if session_key is None:
        return []

    roster = _build_roster(openf1_service.get_drivers(session_key))
    if not roster:
        return []
    _pause()
    rows = openf1_service.get_positions(session_key)
    if not rows:
        return []

    samples: dict[int, list[tuple[datetime, int]]] = {}
    opening_moment: Optional[datetime] = None
    for row in rows:
        number = _as_int(row.get("driver_number"))
        moment = _parse_dt(row.get("date"))
        position = _as_int(row.get("position"))
        if number is None or moment is None or position is None:
            continue
        samples.setdefault(number, []).append((moment, position))
        if opening_moment is None or moment < opening_moment:
            opening_moment = moment
    if not samples or opening_moment is None:
        return []

    chosen_samples: list[tuple[int, datetime, int]] = []
    for number, driver_samples in samples.items():
        driver_samples.sort(key=lambda sample: sample[0])
        in_window = next(
            (
                sample for sample in driver_samples
                if (sample[0] - opening_moment).total_seconds() <= _GRID_WINDOW_SECONDS
            ),
            None,
        )
        # A driver with no sample inside the window (a late feed, a pit-lane
        # start) still gets a slot from their own first sample.
        moment, position = in_window or driver_samples[0]
        chosen_samples.append((number, moment, position))

    # Sort by the position read at the start, breaking ties on sample time, and
    # renumber so a duplicate from a late sample cannot produce two "P7"s.
    chosen_samples.sort(key=lambda sample: (sample[2], sample[1]))
    grid: list[dict[str, Any]] = []
    for index, (number, _moment, _position) in enumerate(chosen_samples, start=1):
        full_name, team_name, abbreviation = _meta(roster, number)
        if not full_name:
            continue
        grid.append({
            "grid_position": index,
            "driver_number": number,
            "full_name": full_name,
            "team_name": team_name,
            "abbreviation": abbreviation,
        })
    return grid


# --- race blocks -------------------------------------------------------------


def _fastest_lap(laps: list[dict[str, Any]], roster: dict[int, dict[str, str]]) -> Optional[dict[str, Any]]:
    best_number: Optional[int] = None
    best_duration: Optional[float] = None
    best_lap_number: Optional[int] = None
    for row in laps:
        number = _as_int(row.get("driver_number"))
        duration = _as_float(row.get("lap_duration"))
        if number is None or duration is None or duration <= 0 or row.get("is_pit_out_lap"):
            continue
        if best_duration is None or duration < best_duration:
            best_number, best_duration = number, duration
            best_lap_number = _as_int(row.get("lap_number"))
    if best_number is None or best_duration is None:
        return None
    full_name, team_name, _abbr = _meta(roster, best_number)
    if not full_name:
        return None
    formatted = _fmt_lap_time(best_duration)
    return {
        "full_name": full_name,
        "team_name": team_name,
        "time": formatted,
        "lap_time": formatted,
        "lap_number": best_lap_number,
    }


def _tyre_strategy(
    stints: list[dict[str, Any]],
    roster: dict[int, dict[str, str]],
    position_by_number: dict[int, int],
    status_by_number: Optional[dict[int, str]] = None,
) -> list[dict[str, Any]]:
    status_by_number = status_by_number or {}
    by_driver: dict[int, list[dict[str, Any]]] = {}
    for row in stints:
        number = _as_int(row.get("driver_number"))
        if number is None:
            continue
        by_driver.setdefault(number, []).append(row)

    entries: list[dict[str, Any]] = []
    for number, rows in by_driver.items():
        ordered = sorted(rows, key=lambda r: _as_int(r.get("stint_number")) or 1)
        stints_out: list[dict[str, Any]] = []
        for row in ordered:
            start = _as_int(row.get("lap_start")) or 0
            end = _as_int(row.get("lap_end")) or 0
            stints_out.append({
                "stint": _as_int(row.get("stint_number")) or 1,
                "compound": str(row.get("compound") or "UNKNOWN").upper(),
                "start_lap": start,
                "end_lap": end,
                "laps": max(1, end - start + 1),
            })
        if not stints_out:
            continue

        full_name, team_name, abbr = _meta(roster, number)
        if not abbr:
            continue

        # A stint's last lap is the lap the driver entered the pits on; the
        # mirror of FastF1's PitInTime-derived pit_laps.
        pit_laps = [s["end_lap"] for s in stints_out[:-1]]

        entries.append({
            "driver": abbr,
            "full_name": full_name,
            "team_name": team_name,
            "driver_number": number,
            "position": position_by_number.get(number, 0),
            "status": status_by_number.get(number, ""),
            "total_laps": max(s["end_lap"] for s in stints_out),
            "stints": stints_out,
            "pit_laps": pit_laps,
        })

    # Finishers first in classification order; unclassified cars (position 0,
    # status DNF/DNS/DSQ) last, the one that completed the most laps first. A
    # plain position sort put every retirement on the top row as "P0".
    def _strategy_order(entry: dict[str, Any]) -> tuple[int, int, int, str]:
        position = entry["position"]
        if position > 0:
            return (0, position, 0, entry["driver"])
        return (1, 0, -entry["total_laps"], entry["driver"])

    entries.sort(key=_strategy_order)
    return entries


def _speed_and_sectors(
    laps: list[dict[str, Any]],
    roster: dict[int, dict[str, str]],
    position_by_number: dict[int, int],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]]]:
    best_sectors: dict[int, list[Optional[float]]] = {}
    best_lap: dict[int, Optional[float]] = {}
    top_speed: dict[int, float] = {}

    for row in laps:
        number = _as_int(row.get("driver_number"))
        if number is None:
            continue
        sectors = [_as_float(row.get(f"duration_sector_{i}")) for i in (1, 2, 3)]
        current = best_sectors.setdefault(number, [None, None, None])
        for index, value in enumerate(sectors):
            if value is not None and (current[index] is None or value < current[index]):
                current[index] = value

        duration = _as_float(row.get("lap_duration"))
        if (
            duration is not None and duration > 0
            and (best_lap.get(number) is None or duration < best_lap[number])
        ):
            best_lap[number] = duration

        speeds = [
            _as_float(row.get("st_speed")) or 0.0,
            _as_float(row.get("i1_speed")) or 0.0,
            _as_float(row.get("i2_speed")) or 0.0,
        ]
        fastest_speed = max(speeds)
        if fastest_speed > top_speed.get(number, 0.0):
            top_speed[number] = fastest_speed

    # Session bests for the purple flags, over drivers we can render.
    overall_best = [None, None, None]
    for number, sectors in best_sectors.items():
        if not _meta(roster, number)[2]:
            continue
        for index, value in enumerate(sectors):
            if value is not None and (overall_best[index] is None or value < overall_best[index]):
                overall_best[index] = value

    speed_traps: list[dict[str, Any]] = []
    sector_matrix: list[dict[str, Any]] = []
    for number in set(best_sectors) | set(top_speed):
        full_name, team_name, abbr = _meta(roster, number)
        if not abbr:
            continue
        position = position_by_number.get(number, 0)
        speed = round(top_speed.get(number, 0.0), 1)

        speed_traps.append({
            "driver": abbr,
            "full_name": full_name,
            "team_name": team_name,
            "driver_number": number,
            "speed": speed,
            "position": position,
        })

        sectors = best_sectors.get(number, [None, None, None])
        ideal = sum(value for value in sectors if value is not None)
        actual = best_lap.get(number)
        potential_gain = 0.0
        if actual is not None and ideal > 0:
            potential_gain = round(actual - ideal, 3)

        sector_matrix.append({
            "driver": abbr,
            "full_name": full_name,
            "team_name": team_name,
            "driver_number": number,
            "position": position,
            "s1": _fmt_sector(sectors[0]),
            "s1_purple": sectors[0] is not None and sectors[0] == overall_best[0],
            "s2": _fmt_sector(sectors[1]),
            "s2_purple": sectors[1] is not None and sectors[1] == overall_best[1],
            "s3": _fmt_sector(sectors[2]),
            "s3_purple": sectors[2] is not None and sectors[2] == overall_best[2],
            "ideal_lap": _fmt_lap_time(ideal if ideal > 0 else None),
            "actual_lap": _fmt_lap_time(actual),
            "potential_gain": potential_gain,
            "top_speed": speed,
        })

    speed_traps.sort(key=lambda entry: entry["speed"], reverse=True)
    for rank, entry in enumerate(speed_traps):
        entry["rank"] = rank + 1
    sector_matrix.sort(key=lambda entry: (entry["position"] <= 0, entry["position"]))
    return speed_traps, sector_matrix


def _weather(weather_rows: list[dict[str, Any]]) -> list[dict[str, Any]]:
    dated = [row for row in weather_rows if _parse_dt(row.get("date")) is not None]
    if not dated:
        return []
    dated.sort(key=lambda row: _parse_dt(row.get("date")))

    # Offsets are minutes from the first sample, mirroring FastF1's
    # session-relative `Time` axis on the same chart.
    anchor = _parse_dt(dated[0].get("date"))
    samples: list[dict[str, Any]] = []
    for row in dated:
        moment = _parse_dt(row.get("date"))
        offset_minutes = (moment - anchor).total_seconds() / 60.0
        samples.append({
            "time_offset": round(offset_minutes, 1),
            "air_temp": round(_as_float(row.get("air_temperature")) or 0.0, 1),
            "track_temp": round(_as_float(row.get("track_temperature")) or 0.0, 1),
            "humidity": round(_as_float(row.get("humidity")) or 0.0, 1),
            "rainfall": bool(_as_float(row.get("rainfall")) or 0),
        })
    return samples


def _series_charts(
    laps: list[dict[str, Any]],
    roster: dict[int, dict[str, str]],
) -> tuple[list[dict[str, Any]], list[dict[str, Any]], list[dict[str, Any]]]:
    by_lap: dict[int, list[tuple[int, Optional[datetime], Optional[float]]]] = {}
    for row in laps:
        lap_number = _as_int(row.get("lap_number"))
        number = _as_int(row.get("driver_number"))
        if lap_number is None or number is None:
            continue
        by_lap.setdefault(lap_number, []).append((
            number,
            _parse_dt(row.get("date_start")),
            _as_float(row.get("lap_duration")),
        ))

    lap_chart: list[dict[str, Any]] = []
    gap_chart: list[dict[str, Any]] = []
    lap_times_chart: list[dict[str, Any]] = []

    for lap_number in sorted(by_lap):
        entries = by_lap[lap_number]
        times_entry: dict[str, Any] = {"lap": lap_number}
        order_entry: dict[str, Any] = {"lap": lap_number}
        gap_entry: dict[str, Any] = {"lap": lap_number}

        for number, _moment, duration in entries:
            abbr = _meta(roster, number)[2]
            if abbr and duration is not None and 0 < duration < _MAX_LAP_SECONDS:
                times_entry[abbr] = round(duration, 3)

        timed = sorted(
            (entry for entry in entries if entry[1] is not None),
            key=lambda entry: entry[1],
        )
        if timed:
            leader_moment = timed[0][1]
            for index, (number, moment, _duration) in enumerate(timed):
                abbr = _meta(roster, number)[2]
                if not abbr:
                    continue
                order_entry[abbr] = index + 1
                gap = (moment - leader_moment).total_seconds()
                if 0 <= gap < _MAX_GAP_SECONDS:
                    gap_entry[abbr] = round(gap, 3)

        # Same guards as the FastF1 path: a lap needs more than one driver
        # for a line to be meaningful.
        if len(times_entry) > 1:
            lap_times_chart.append(times_entry)
        if len(order_entry) > 1:
            lap_chart.append(order_entry)
        if len(gap_entry) > 1:
            gap_chart.append(gap_entry)

    return lap_chart, gap_chart, lap_times_chart


def build_race_blocks(
    session_key: Optional[int],
    position_by_number: dict[int, int],
    status_by_number: Optional[dict[int, str]] = None,
) -> dict[str, Any]:
    """Fetch OpenF1 data for a race session and build every lap-derived block.

    Returns a dict with any of: fastest_lap, tyre_strategy, speed_traps,
    sector_matrix, weather_info, lap_chart, gap_chart, lap_times_chart.
    An empty dict means OpenF1 had nothing usable for this session.
    """
    if session_key is None:
        return {}

    roster = _build_roster(openf1_service.get_drivers(session_key))
    if not roster:
        logger.info("OpenF1 fallback: no driver roster for session %s", session_key)
        return {}

    _pause()
    laps = openf1_service.get_laps(session_key) or []
    _pause()
    stints = openf1_service.get_stints(session_key) or []
    _pause()
    weather_rows = openf1_service.get_weather(session_key) or []

    if not laps:
        logger.info("OpenF1 fallback: no laps for session %s", session_key)
        return {}

    blocks: dict[str, Any] = {}

    fastest = _fastest_lap(laps, roster)
    if fastest:
        blocks["fastest_lap"] = fastest

    strategy = _tyre_strategy(stints, roster, position_by_number, status_by_number)
    if strategy:
        blocks["tyre_strategy"] = strategy

    speed_traps, sector_matrix = _speed_and_sectors(laps, roster, position_by_number)
    if speed_traps:
        blocks["speed_traps"] = speed_traps
    if sector_matrix:
        blocks["sector_matrix"] = sector_matrix

    samples = _weather(weather_rows)
    if samples:
        blocks["weather_info"] = samples

    lap_chart, gap_chart, lap_times_chart = _series_charts(laps, roster)
    if lap_chart:
        blocks["lap_chart"] = lap_chart
    if gap_chart:
        blocks["gap_chart"] = gap_chart
    if lap_times_chart:
        blocks["lap_times_chart"] = lap_times_chart

    return blocks


__all__ = ["build_fastest_lap_rows", "build_starting_grid", "build_race_blocks"]
