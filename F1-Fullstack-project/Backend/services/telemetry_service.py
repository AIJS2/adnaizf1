import fastf1
import pandas as pd
import logging
import os
import threading
from typing import Optional

from services.fastf1_safe import (
    has_rows,
    is_valid_year,
    load_session_safe,
    safe_getattr,
)

TELEMETRY_LOAD_KWARGS = dict(telemetry=True, laps=True, weather=False, messages=False)

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


def process_telemetry_compare(year: int, round_number: int, driver_list: list, lap: Optional[int] = None):
    # Validate before spending a network round-trip on an impossible request.
    if not is_valid_year(year) or not isinstance(round_number, int) or round_number < 1:
        return _build_empty_payload(
            f"Round {round_number} is not a valid race round for {year}.",
            driver_list,
        )

    # Concurrency lock for FastF1 session.load() per (year, round_number).
    lock = _get_session_lock(year, round_number)
    with lock:
        session = load_session_safe(year, round_number, "R", **TELEMETRY_LOAD_KWARGS)

    if session is None:
        return _build_empty_payload(
            f"No race session exists for {year} round {round_number}.",
            driver_list,
        )

    laps = safe_getattr(session, "laps")
    if laps is None or getattr(laps, "empty", True):
        return _build_empty_payload(
            "No lap data is available for this session yet.",
            driver_list,
        )

    driver_data = {}
    binned_dfs = []
    unavailable = {}

    all_drivers_set = set(laps["Driver"]) if "Driver" in laps.columns else set()

    # ── Per-driver isolation: one driver's failure never breaks another's ──
    for drv in driver_list:
        try:
            drv_laps = laps[laps["Driver"] == drv] if drv in all_drivers_set else None
            if drv_laps is None or drv_laps.empty:
                unavailable[drv] = "No lap data for this driver in this session."
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
                    unavailable[drv] = "No lap data for this driver in this session."
                    continue
                fastest_idx = valid_laps["LapTime"].idxmin()
                target_lap = valid_laps.loc[fastest_idx]

            target_lap, err = _validate_lap(target_lap, drv)
            if err:
                unavailable[drv] = err
                continue

            drv_info = session.get_driver(drv)
            team = str(drv_info.get("TeamName", "")) if drv_info is not None else ""
            name = (
                f"{drv_info.get('FirstName', '')} {drv_info.get('LastName', '')}".strip()
                if drv_info is not None
                else drv
            )

            # Get car data with distance added. Fall back to get_telemetry() if needed.
            tel = None
            tel_err = None
            try:
                tel = target_lap.get_car_data().add_distance()
                tel, tel_err = _validate_car_data(tel, drv)
            except Exception as e:  # noqa: BLE001
                logging.warning(
                    f"get_car_data() unavailable for {drv} at {year}/{round_number}: {e}"
                )
                tel_err = "get_car_data() raised"

            if tel is None or tel_err:
                try:
                    tel = target_lap.get_telemetry()
                    tel, tel_err = _validate_car_data(tel, drv)
                except Exception as e2:  # noqa: BLE001
                    logging.warning(
                        f"get_telemetry() unavailable for {drv} at {year}/{round_number}: {e2}"
                    )
                    unavailable[drv] = "No lap data for this driver in this session."
                    continue

            if tel_err:
                unavailable[drv] = tel_err
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

            binned = tel.groupby(tel["Distance"] // 10 * 10).mean(numeric_only=True).reset_index(names="BinnedDist")
            binned.columns = [c if c == "BinnedDist" else f"{c}_{drv}" for c in binned.columns]
            binned_dfs.append(binned)

        except Exception as e:  # noqa: BLE001
            logging.warning(
                f"Unexpected error processing {drv} at {year}/{round_number}: {e}",
                exc_info=True,
            )
            unavailable[drv] = "No lap data for this driver in this session."
            continue

    if not binned_dfs:
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
        merged = pd.merge(merged, df, on="BinnedDist", how="outer").sort_values("BinnedDist")

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

    data_points = []
    for _, row in merged.iterrows():
        pt = {"distance": int(row["BinnedDist"])}
        ref_elapsed = float(row.get(f"Elapsed_{ref_driver}", 0))

        max_speed = -1
        dominant = valid_drivers[0]

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
        pt["dominant_driver"] = chunk_winners.get(
            c_idx, valid_drivers[0]
        )

    return {
        "drivers": valid_drivers,
        "driver_info": driver_data,
        "telemetry": data_points,
        "unavailable_drivers": list(unavailable.keys()),
        "unavailable_reasons": unavailable,
    }


def get_telemetry_drivers_list(year: int, round_number: int):
    """Drivers who contested a race. Returns [] when the session has no data."""
    if not is_valid_year(year) or not isinstance(round_number, int) or round_number < 1:
        return []

    lock = _get_session_lock(year, round_number)
    with lock:
        session = load_session_safe(
            year, round_number, "R",
            telemetry=False, laps=False, weather=False, messages=False,
        )
    if session is None or not has_rows(session, "results"):
        return []

    drivers_list = []
    for _, row in safe_getattr(session, "results").iterrows():
        abbr = row.get("Abbreviation")
        if pd.notna(abbr) and abbr:
            drivers_list.append(
                {
                    "abbreviation": str(abbr),
                    "full_name": f"{row.get('FirstName', '')} {row.get('LastName', '')}".strip(),
                    "team_name": row.get("TeamName", ""),
                }
            )
    return drivers_list
