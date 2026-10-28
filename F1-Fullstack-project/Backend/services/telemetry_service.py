import logging
import json
import os
import threading
import time
from typing import Optional

import numpy as np
import pandas as pd

from services import openf1_telemetry
from services.fastf1_safe import (
    has_rows,
    is_valid_year,
    load_session_safe,
    safe_getattr,
)
from services.spline_smooth import apply_smoothed_position
from services.canonical_circuits import interpolate_canonical_coords

TELEMETRY_LOAD_KWARGS = dict(telemetry=True, laps=True, weather=False, messages=False)

# F1's archive has no lap timing for most 2026 rounds, and every FastF1
# session.load() pays the failed network requests again (FastF1 does not cache
# negative results). Remember that verdict for a day so a second driver
# comparison for the same round goes straight to OpenF1 instead of waiting out
# the same timeouts.
_FASTF1_GAP_TTL_SECONDS = 24 * 60 * 60
_FASTF1_GAP_DIR = "cache"


def _fastf1_gap_path(year: int, round_number: int) -> str:
    return os.path.join(
        _FASTF1_GAP_DIR,
        f"fastf1_no_laps_{year}_{round_number}.json",
    )


def _read_fastf1_gap(year: int, round_number: int) -> Optional[dict]:
    """The cached "no timing archive" verdict, or None when absent/expired."""
    path = _fastf1_gap_path(year, round_number)
    try:
        if not os.path.exists(path):
            return None
        if time.time() - os.path.getmtime(path) > _FASTF1_GAP_TTL_SECONDS:
            return None
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception:  # noqa: BLE001 - a broken marker must not break telemetry
        return None


def _write_fastf1_gap(year: int, round_number: int, statuses: dict) -> None:
    try:
        os.makedirs(_FASTF1_GAP_DIR, exist_ok=True)
        with open(
            _fastf1_gap_path(year, round_number), "w", encoding="utf-8"
        ) as handle:
            json.dump({"statuses": statuses, "saved_at": time.time()}, handle)
    except Exception:  # noqa: BLE001
        pass


def _clear_fastf1_gap(year: int, round_number: int) -> None:
    try:
        os.remove(_fastf1_gap_path(year, round_number))
    except OSError:
        pass


# ---------------------------------------------------------------------------
# Concurrency lock per (year, round_number) so concurrent FastF1 session.load()
# calls cannot race on the same in-memory session object.
# ---------------------------------------------------------------------------
_session_locks: dict[tuple[int, int], threading.Lock] = {}
_session_locks_guard = threading.Lock()


def _get_session_lock(year: int, round_number: int) -> threading.Lock:
    key = (year, round_number)
    with _session_locks_guard:
        if key not in _session_locks:
            _session_locks[key] = threading.Lock()
        return _session_locks[key]


def _no_lap_reason(status: str, laps_done: Optional[int]) -> str:
    """Why a driver has no lap to analyse, in the driver's own terms.

    FastF1 keeps the classification (Status + Laps) even for sessions whose
    timing data is missing, so a DNS, a disqualification or a retirement can be
    named instead of falling back to a vague "no lap data".
    """
    normalized = (status or "").strip().lower()
    if "did not start" in normalized:
        return "Did not start this race - no lap telemetry exists for this driver."
    if "disqualif" in normalized or "excluded" in normalized:
        return "Disqualified from this race - no lap telemetry exists for this driver."
    finished = (
        not normalized
        or normalized.startswith("finished")
        or normalized.startswith("lapped")
        or normalized.startswith("+")  # lapped finishers: "+1 Lap"
    )
    if not finished:
        lap_text = f" on lap {laps_done}" if laps_done else ""
        return f"Retired{lap_text} ({status}) - no completed lap to analyse."
    return "No lap data for this driver in this session."


def _build_empty_payload(reason: str, driver_list: list) -> dict:
    """The honest payload when no telemetry could be produced."""
    return {
        "drivers": [],
        "driver_info": {},
        "telemetry": [],
        "unavailable_drivers": list(driver_list),
        "unavailable_reasons": {d: reason for d in driver_list},
    }


def _validate_lap(target_lap: Optional[pd.Series], drv: str) -> tuple:
    """Validate that a lap has a usable LapTime. Returns (lap, error_or_None)."""
    if target_lap is None:
        return None, "No lap data for this driver in this session."
    try:
        lap_time = target_lap.get("LapTime")
        if lap_time is None or pd.isna(lap_time):
            return None, "No lap data for this driver in this session."
    except Exception:
        return None, "No lap data for this driver in this session."
    return target_lap, None


def _validate_car_data(car_data: Optional[pd.DataFrame], drv: str) -> tuple:
    """Validate car data has Distance & Speed columns with real values."""
    if car_data is None or car_data.empty:
        return None, "No lap data for this driver in this session."
    required_cols = {"Distance", "Speed"}
    if not required_cols.issubset(set(car_data.columns)):
        return None, "No lap data for this driver in this session."
    if car_data["Distance"].isna().all() or car_data["Speed"].isna().all():
        return None, "No lap data for this driver in this session."
    return car_data, None


def _attach_position_data(target_lap, tel: pd.DataFrame, drv: str) -> pd.DataFrame:
    """Merge the X/Y position stream onto the car-channel timeline.

    ``get_car_data()`` has no position channels, so without this merge every
    track-map point collapsed to (0, 0) and the map rendered as a dot. The
    nearest position sample within 1s is attached to each car-data row.
    """
    if {"X", "Y"}.issubset(set(tel.columns)):
        return tel
    try:
        pos = target_lap.get_pos_data()
    except Exception as e:  # noqa: BLE001
        logging.warning(f"get_pos_data() unavailable for {drv}: {e}")
        return tel
    if (
        pos is None
        or getattr(pos, "empty", True)
        or not {"X", "Y"}.issubset(set(pos.columns))
    ):
        return tel

    try:
        merged = pd.merge_asof(
            tel.sort_values("Time"),
            pos.loc[:, ["Time", "X", "Y"]].sort_values("Time"),
            on="Time",
            direction="nearest",
            tolerance=pd.Timedelta("1s"),
        )
    except Exception as e:  # noqa: BLE001
        logging.warning(f"Position merge failed for {drv}: {e}")
        return tel
    if merged.empty:
        return tel
    # The 1 s nearest-merge leaves X/Y as a handful of repeated coordinate
    # pairs (not NaN), so a plain ffill() collapses the outline to a jagged
    # polygon.  Fit a closed parametric B-spline to the unique waypoints and
    # resample it densely so every row gets a smooth circuit position.
    return apply_smoothed_position(merged)


def _interpolate_position_by_distance(
    tel: pd.DataFrame, round_number: Optional[int] = None
) -> pd.DataFrame:
    """Return *tel* with smooth X/Y positions for a circuit outline.

    FastF1 car-channel + position merges typically yield ~100+ distinct
    coordinate samples per lap, so a linear interpolation against the
    monotonic ``Distance`` column is smooth enough.  When the source is
    OpenF1 (or a sparse archive) the raw merge leaves only a handful of
    unique waypoints with many consecutive duplicates; in that case canonical
    circuit geometry (or a closed parametric B-spline) produces the smooth
    circuit shape.

    This helper detects the sparse-duplicate case and falls back to
    canonical geometry / ``apply_smoothed_position`` automatically.
    """
    if tel is None or tel.empty:
        return tel
    if "Distance" not in tel.columns or not {"X", "Y"}.issubset(tel.columns):
        return tel

    tel = tel.copy()

    # Count how many *consecutive-duplicate-free* waypoint pairs exist.
    x_vals = tel["X"].values.astype(float, copy=False)
    y_vals = tel["Y"].values.astype(float, copy=False)
    unique_count = 1
    for i in range(1, len(x_vals)):
        if not (np.isnan(x_vals[i]) or np.isnan(y_vals[i])):
            if x_vals[i] != x_vals[i - 1] or y_vals[i] != y_vals[i - 1]:
                unique_count += 1

    if round_number:
        dist = tel["Distance"].values.astype(float, copy=False)
        d_min = np.nanmin(dist)
        d_max = np.nanmax(dist)
        if d_max > d_min:
            norm_d = (dist - d_min) / (d_max - d_min)
            canonical_coords = interpolate_canonical_coords(round_number, norm_d)
            if canonical_coords is not None:
                tel["X"] = canonical_coords[0]
                tel["Y"] = canonical_coords[1]
                return tel

    if unique_count < 150:
        # Sparse waypoint set → spline smoothing gives a smooth curve.
        return apply_smoothed_position(tel)

    # Dense enough → linear interpolation against Distance.
    for col in ("X", "Y"):
        s = tel[col]
        s_masked = s.mask(s == s.shift(1))
        tel[col] = (
            s_masked.interpolate(method="linear", limit_direction="both")
            .ffill()
            .bfill()
        )
    return tel


def _extract_lap_telemetry(target_lap, drv: str) -> tuple:
    """Return (frame with Speed+Distance[+X/Y], error_or_None) for one lap."""
    candidates = []

    # Primary: dedicated car-channel stream.
    try:
        car = target_lap.get_car_data()
        if car is not None and not getattr(car, "empty", True):
            if "Distance" not in car.columns:
                car = car.add_distance()
            candidates.append(_attach_position_data(target_lap, car, drv))
    except Exception as e:  # noqa: BLE001
        logging.warning(f"get_car_data() unavailable for {drv}: {e}")

    # Fallback: legacy merged stream that also carries position channels.
    try:
        legacy = target_lap.get_telemetry()
        if legacy is not None and not getattr(legacy, "empty", True):
            if "Distance" not in legacy.columns:
                legacy = legacy.add_distance()
            legacy["Distance"] = legacy["Distance"].ffill().bfill()
            candidates.append(legacy)
    except Exception as e:  # noqa: BLE001
        logging.warning(f"get_telemetry() unavailable for {drv}: {e}")

    for frame in candidates:
        validated, _err = _validate_car_data(frame, drv)
        if validated is not None:
            # Interpolate X/Y against Distance so the 10 m bins trace a
            # smooth circuit outline instead of a collapsed polygon.
            return _interpolate_position_by_distance(validated), None
    return None, "No lap data for this driver in this session."


def _assemble_payload(
    driver_data: dict,
    binned_dfs: list,
    unavailable: dict,
    driver_list: list,
    round_number: Optional[int] = None,
) -> dict:
    """Merge per-driver binned frames into the API payload.

    Shared by the FastF1 and OpenF1 paths: whichever source produced the
    frames, the charts consume the same distance-keyed records.
    """
    if not binned_dfs or not driver_data:
        # Nobody produced telemetry. Return per-driver reasons instead of raising.
        return {
            "drivers": [],
            "driver_info": {},
            "telemetry": [],
            "unavailable_drivers": list(driver_list),
            "unavailable_reasons": unavailable
            or {d: "No telemetry data for the selected drivers." for d in driver_list},
        }

    merged = binned_dfs[0]
    for df in binned_dfs[1:]:
        merged = pd.merge(merged, df, on="BinnedDist", how="outer").sort_values(
            "BinnedDist"
        )

    merged = merged.ffill().bfill().fillna(0)

    # Reference driver MUST come from drivers with successful telemetry extraction.
    valid_drivers = list(driver_data.keys())
    if not valid_drivers:
        return {
            "drivers": [],
            "driver_info": {},
            "telemetry": [],
            "unavailable_drivers": list(driver_list),
            "unavailable_reasons": unavailable
            or {d: "No telemetry data for the selected drivers." for d in driver_list},
        }

    ref_driver = valid_drivers[0]

    # Check if canonical circuit coordinates are available to align with CIRCUIT LAYOUT
    canonical_coords = None
    if round_number and valid_drivers:
        total_dist = merged["BinnedDist"].max()
        if total_dist > 0:
            norm_dists = merged["BinnedDist"].values / total_dist
            canonical_coords = interpolate_canonical_coords(round_number, norm_dists)

    data_points = []
    for idx, (_, row) in enumerate(merged.iterrows()):
        pt = {"distance": int(row["BinnedDist"])}
        ref_elapsed = float(row.get(f"Elapsed_{ref_driver}", 0))

        max_speed = -1
        dominant = valid_drivers[0]

        if canonical_coords is not None:
            pt["x"] = float(canonical_coords[0][idx])
            pt["y"] = float(canonical_coords[1][idx])
        else:
            pt["x"] = float(row.get(f"X_{valid_drivers[0]}", 0))
            pt["y"] = float(row.get(f"Y_{valid_drivers[0]}", 0))

        for drv in valid_drivers:
            speed = round(float(row.get(f"Speed_{drv}", 0)), 1)
            elapsed = float(row.get(f"Elapsed_{drv}", 0))
            g = row.get(f"nGear_{drv}", 0)

            pt[f"speed_{drv}"] = speed
            pt[f"throttle_{drv}"] = round(float(row.get(f"Throttle_{drv}", 0)), 1)
            pt[f"brake_{drv}"] = 1 if row.get(f"Brake_{drv}", 0) > 0 else 0
            pt[f"gear_{drv}"] = int(g) if pd.notna(g) else 0
            pt[f"drs_{drv}"] = 1 if row.get(f"DRSActive_{drv}", 0) >= 0.5 else 0

            if drv != ref_driver:
                pt[f"delta_{drv}"] = round(elapsed - ref_elapsed, 3)

            if speed > max_speed:
                max_speed = speed
                dominant = drv

        pt["dominant_driver"] = dominant
        data_points.append(pt)

    # --- Smooth Dominant Driver (Mini-Sectors) ---
    chunk_size = 250
    chunks = {}
    for pt in data_points:
        c_idx = pt["distance"] // chunk_size
        if c_idx not in chunks:
            chunks[c_idx] = {drv: [] for drv in valid_drivers}
        for drv in valid_drivers:
            chunks[c_idx][drv].append(pt.get(f"speed_{drv}", 0))

    chunk_winners = {}
    for c_idx, drv_speeds in chunks.items():
        best_drv = valid_drivers[0]
        best_avg = -1
        for drv, speeds in drv_speeds.items():
            if speeds:
                avg = sum(speeds) / len(speeds)
                if avg > best_avg:
                    best_avg = avg
                    best_drv = drv
        chunk_winners[c_idx] = best_drv

    for pt in data_points:
        c_idx = pt["distance"] // chunk_size
        pt["dominant_driver"] = chunk_winners.get(c_idx, valid_drivers[0])

    return {
        "drivers": valid_drivers,
        "driver_info": driver_data,
        "telemetry": data_points,
        "unavailable_drivers": list(unavailable.keys()),
        "unavailable_reasons": unavailable,
    }


def _ingest_openf1_frames(
    collected: dict,
    driver_data: dict,
    binned_dfs: list,
    round_number: Optional[int] = None,
) -> dict:
    """Add OpenF1 frames to the running driver/binned collections.

    Returns {driver: failure_reason} for frames that could not be processed.
    Frames already in `driver_data` (FastF1 output) are never touched.
    """
    failed = {}
    for drv, info, frame in collected.get("frames") or []:
        try:
            frame = frame.copy()
            frame["Elapsed"] = (
                frame["Time"] - frame["Time"].iloc[0]
            ).dt.total_seconds()
            frame["DRSActive"] = (
                frame["DRS"].apply(lambda x: 1 if x in [10, 12, 14, 1] else 0)
                if "DRS" in frame.columns
                else 0
            )
            # Smooth X/Y before binning (canonical/spline for sparse OpenF1 data,
            # linear for dense FastF1 data).
            if {"X", "Y"}.issubset(frame.columns):
                frame = _interpolate_position_by_distance(
                    frame, round_number=round_number
                )
            binned = (
                frame.groupby(frame["Distance"] // 10 * 10)
                .mean(numeric_only=True)
                .reset_index(names="BinnedDist")
            )
            binned.columns = [
                c if c == "BinnedDist" else f"{c}_{drv}" for c in binned.columns
            ]
            driver_data[drv] = info
            binned_dfs.append(binned)
        except Exception as e:  # noqa: BLE001
            logging.warning(
                f"Unexpected error processing OpenF1 telemetry for {drv}: {e}",
                exc_info=True,
            )
            failed[drv] = "Lap telemetry could not be processed for this driver."
    return failed


def _telemetry_from_openf1(
    year: int, round_number: int, driver_list: list, lap, reason_for
) -> Optional[dict]:
    """Build the payload from OpenF1 when FastF1 has no lap timing.

    Returns None only when OpenF1 has no race session for the round, so the
    caller can tell "both sources are empty" from "OpenF1 answered and named
    each driver's gap".
    """
    try:
        collected = openf1_telemetry.collect(
            year,
            round_number,
            driver_list,
            lap=lap,
        )
    except Exception as e:  # noqa: BLE001 - a fallback must never break the page
        logging.warning(
            f"OpenF1 telemetry fallback failed for {year}/{round_number}: "
            f"{type(e).__name__}: {e}",
        )
        return None
    if collected is None:
        return None

    driver_data = {}
    binned_dfs = []
    unavailable = dict(
        _ingest_openf1_frames(
            collected, driver_data, binned_dfs, round_number=round_number
        )
    )

    for drv in driver_list:
        if drv in driver_data or drv in unavailable:
            continue
        reason = collected["missing"].get(drv)
        if reason is None and drv in collected["no_laps"]:
            reason = reason_for(drv)
        unavailable[drv] = reason or "No lap data for this driver in this session."

    return _assemble_payload(
        driver_data, binned_dfs, unavailable, driver_list, round_number=round_number
    )


def process_telemetry_compare(
    year: int, round_number: int, driver_list: list, lap: Optional[int] = None
):
    # Validate before spending a network round-trip on an impossible request.
    if not is_valid_year(year) or not isinstance(round_number, int) or round_number < 1:
        return _build_empty_payload(
            f"Round {round_number} is not a valid race round for {year}.",
            driver_list,
        )

    # Concurrency lock for FastF1 session.load() per (year, round_number).
    # When a previous attempt already found no lap timing, skip it: FastF1
    # does not cache failed requests, so retrying costs the same timeouts.
    gap_marker = _read_fastf1_gap(year, round_number)
    if gap_marker is not None:
        session = None
        laps = None
    else:
        lock = _get_session_lock(year, round_number)
        with lock:
            session = load_session_safe(
                year, round_number, "R", **TELEMETRY_LOAD_KWARGS
            )
        laps = safe_getattr(session, "laps") if session is not None else None

    laps_missing = session is None or laps is None or getattr(laps, "empty", True)

    # A driver with no timed lap still deserves a specific answer: "did not
    # start"/"disqualified"/"retired" beats a vague "no lap data". FastF1 keeps
    # Status + Laps for every result it can read, even when the timing data is
    # missing, so a DNS or a lap-1 retirement can be named.
    status_by_driver: dict[str, tuple[str, Optional[int]]] = {}
    if gap_marker is not None:
        for abbr, entry in (gap_marker.get("statuses") or {}).items():
            try:
                status, laps_done = entry
            except (TypeError, ValueError):
                continue
            status_by_driver[str(abbr)] = (str(status or ""), laps_done)
    else:
        results = safe_getattr(session, "results") if session is not None else None
        if results is not None and not getattr(results, "empty", True):
            for _, row in results.iterrows():
                abbr = row.get("Abbreviation")
                if pd.isna(abbr) or not abbr:
                    continue
                status = str(row.get("Status", "") or "").strip()
                raw_laps = row.get("Laps")
                try:
                    laps_done = int(raw_laps) if pd.notna(raw_laps) else None
                except (TypeError, ValueError):
                    laps_done = None
                status_by_driver[str(abbr)] = (status, laps_done)

    def no_lap_reason_for(drv: str) -> str:
        """Why `drv` has no lap to analyse, in the driver's own terms."""
        return _no_lap_reason(*status_by_driver.get(drv, ("", None)))

    # The session classification was actually read (results present). This is
    # the trustworthy signal that the archive genuinely has no laps, as opposed
    # to a get_session failure or a load() timeout that left everything empty.
    _results = safe_getattr(session, "results") if session is not None else None
    results_loaded = _results is not None and not getattr(_results, "empty", True)

    if laps_missing:
        # F1's archive has no laps for most 2026 rounds, but OpenF1 keeps
        # car_data/location for those same sessions. Only answer with the
        # honest empty payload when OpenF1 has nothing either.
        #
        # Pin the 24h "no timing archive" verdict ONLY when the session loaded
        # and its classification is readable. A load failure/timeout leaves
        # results empty too and must not be pinned, or one transient outage
        # would suppress FastF1 for a whole day.
        if gap_marker is None and results_loaded:
            _write_fastf1_gap(year, round_number, status_by_driver)
        payload = _telemetry_from_openf1(
            year,
            round_number,
            driver_list,
            lap,
            no_lap_reason_for,
        )
        if payload is not None:
            return payload
        if session is None and gap_marker is None:
            return _build_empty_payload(
                f"No race session exists for {year} round {round_number}.",
                driver_list,
            )
        return _build_empty_payload(
            "No lap telemetry is available for this race from F1's timing "
            "archive or OpenF1.",
            driver_list,
        )

    _clear_fastf1_gap(year, round_number)

    driver_data = {}
    binned_dfs = []
    unavailable = {}
    openf1_fallback: list[str] = []

    all_drivers_set = set(laps["Driver"]) if "Driver" in laps.columns else set()

    # ── Per-driver isolation: one driver's failure never breaks another's ──
    for drv in driver_list:
        no_lap_reason = no_lap_reason_for(drv)
        try:
            drv_laps = laps[laps["Driver"] == drv] if drv in all_drivers_set else None
            if drv_laps is None or drv_laps.empty:
                unavailable[drv] = no_lap_reason
                continue

            if lap is not None:
                lap_df = drv_laps.loc[drv_laps["LapNumber"] == lap]
                target_lap = lap_df.iloc[0] if not lap_df.empty else None
            else:
                # Fastest *valid* lap: exclude rows with NaN LapTime first.
                valid_laps = (
                    drv_laps.dropna(subset=["LapTime"])
                    if "LapTime" in drv_laps.columns
                    else drv_laps
                )
                if valid_laps.empty:
                    unavailable[drv] = no_lap_reason
                    continue
                fastest_idx = valid_laps["LapTime"].idxmin()
                target_lap = valid_laps.loc[fastest_idx]

            target_lap, err = _validate_lap(target_lap, drv)
            if err:
                unavailable[drv] = no_lap_reason
                continue

            drv_info = session.get_driver(drv)
            team = str(drv_info.get("TeamName", "")) if drv_info is not None else ""
            name = (
                f"{drv_info.get('FirstName', '')} {drv_info.get('LastName', '')}".strip()
                if drv_info is not None
                else drv
            )

            # Car channels + distance + X/Y. See _extract_lap_telemetry().
            tel, tel_err = _extract_lap_telemetry(target_lap, drv)
            if tel is None or tel_err:
                # The lap exists, so this is not a DNS/DNF story: the archive
                # simply has no car channels for it. OpenF1 sometimes does,
                # so remember the driver for the fallback pass below.
                openf1_fallback.append(drv)
                continue

            tel = tel.copy()
            tel["Elapsed"] = (tel["Time"] - tel["Time"].iloc[0]).dt.total_seconds()
            tel["DRSActive"] = (
                tel["DRS"].apply(lambda x: 1 if x in [10, 12, 14, 1] else 0)
                if "DRS" in tel.columns
                else 0
            )

            s_filtered = tel[tel["Speed"] > 30]["Speed"]
            min_speed = (
                round(float(s_filtered.min()), 1)
                if not s_filtered.empty
                else round(float(tel["Speed"].min()), 1)
            )

            driver_data[drv] = {
                "name": name,
                "team": team,
                "lap_time": (
                    str(target_lap["LapTime"]).split("0 days ")[-1]
                    if pd.notna(target_lap.get("LapTime"))
                    else None
                ),
                "compound": str(target_lap.get("Compound", "UNKNOWN")),
                "max_speed": round(float(tel["Speed"].max()), 1),
                "min_speed": min_speed,
                "avg_speed": round(float(tel["Speed"].mean()), 1),
            }

            # Smooth X/Y before binning. FastF1 position data is usually
            # dense enough for linear interpolation; when the archive is
            # sparse the spline fallback kicks in automatically.
            if {"X", "Y"}.issubset(tel.columns):
                tel = _interpolate_position_by_distance(tel, round_number=round_number)

            binned = (
                tel.groupby(tel["Distance"] // 10 * 10)
                .mean(numeric_only=True)
                .reset_index(names="BinnedDist")
            )
            binned.columns = [
                c if c == "BinnedDist" else f"{c}_{drv}" for c in binned.columns
            ]
            binned_dfs.append(binned)

        except Exception as e:  # noqa: BLE001
            logging.warning(
                f"Unexpected error processing {drv} at {year}/{round_number}: {e}",
                exc_info=True,
            )
            unavailable[drv] = "Lap telemetry could not be processed for this driver."
            continue

    if openf1_fallback:
        # FastF1 kept the lap times but no car channels (R17 Singapore serves
        # exactly this way). OpenF1 has the channels for those sessions, so
        # fill only those drivers. FastF1 output is never replaced.
        collected = None
        try:
            collected = openf1_telemetry.collect(
                year,
                round_number,
                openf1_fallback,
                lap=lap,
            )
        except Exception as e:  # noqa: BLE001
            logging.warning(
                f"OpenF1 car-channel fallback failed for {year}/{round_number}: "
                f"{type(e).__name__}: {e}",
            )
        if collected is not None:
            failures = _ingest_openf1_frames(
                collected, driver_data, binned_dfs, round_number=round_number
            )
            for drv in openf1_fallback:
                if drv in driver_data:
                    continue
                reason = failures.get(drv) or collected["missing"].get(drv)
                if reason is None and drv in collected["no_laps"]:
                    reason = no_lap_reason_for(drv)
                unavailable[drv] = (
                    reason
                    or "Lap telemetry is not published for this driver in this session."
                )

    return _assemble_payload(
        driver_data, binned_dfs, unavailable, driver_list, round_number=round_number
    )


def get_telemetry_drivers_list(year: int, round_number: int):
    """Drivers who contested a race. Returns [] when the session has no data."""
    if not is_valid_year(year) or not isinstance(round_number, int) or round_number < 1:
        return []

    lock = _get_session_lock(year, round_number)
    with lock:
        session = load_session_safe(
            year,
            round_number,
            "R",
            telemetry=False,
            laps=False,
            weather=False,
            messages=False,
        )
    if session is None or not has_rows(session, "results"):
        # FastF1's event/results frame can be missing for a round whose timing
        # archive is absent; OpenF1's roster still names the entrants.
        try:
            return openf1_telemetry.driver_options(year, round_number)
        except Exception as e:  # noqa: BLE001 - the picker must never break
            logging.warning(
                f"OpenF1 driver list fallback failed for {year}/{round_number}: "
                f"{type(e).__name__}: {e}",
            )
            return []

    drivers_list = []
    for _, row in safe_getattr(session, "results").iterrows():
        abbr = row.get("Abbreviation")
        if pd.notna(abbr) and abbr:
            status = row.get("Status")
            drivers_list.append(
                {
                    "abbreviation": str(abbr),
                    "full_name": f"{row.get('FirstName', '')} {row.get('LastName', '')}".strip(),
                    "team_name": row.get("TeamName", ""),
                    # Official race status ("Lapped", "Did not start", ...) so the
                    # UI can flag drivers who will never have lap telemetry.
                    "status": str(status) if pd.notna(status) else "",
                }
            )
    return drivers_list
