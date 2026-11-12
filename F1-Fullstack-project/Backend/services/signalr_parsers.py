"""Pure stateless parsers and transformers for F1 SignalR payloads.

Extracted from ``livetiming_service.py`` so topic parsing, gap/sector maths,
tyre compound normalisation, and team-radio URL construction can be tested and
maintained independently of the stateful ``LiveTimingState`` lock container.
"""

from __future__ import annotations

import re
from typing import Any

# 2026 grid – kept in sync with the frontend teamColors map
TEAM_LOOKUP: dict[str, str] = {
    "1": "Red Bull Racing",
    "61": "Red Bull Racing",  # VER, HAD
    "4": "McLaren",
    "81": "McLaren",  # NOR, PIA
    "16": "Ferrari",
    "44": "Ferrari",  # LEC, HAM
    "63": "Mercedes",
    "12": "Mercedes",  # RUS, ANT
    "14": "Aston Martin",
    "18": "Aston Martin",  # ALO, STR
    "31": "Haas F1 Team",
    "87": "Haas F1 Team",  # OCO, BEA
    "55": "Williams",
    "23": "Williams",  # SAI, ALB
    "10": "Alpine",
    "27": "Alpine",  # GAS, COL (placeholder)
    "20": "Audi",
    "5": "Audi",  # HUL, BOR (placeholder)
    "22": "Racing Bulls",
    "30": "Racing Bulls",  # TSU, LAW
    "77": "Cadillac",
    "11": "Cadillac",  # BOT, PER
}

TYRE_COMPOUND_MAP: dict[int, str] = {
    1: "S",
    2: "M",
    3: "H",
    4: "I",
    5: "W",
}

TRACK_STATUS_MAP: dict[str, str] = {
    "1": "GREEN",
    "2": "YELLOW",
    "4": "SC",
    "5": "RED",
    "6": "VSC",
    "7": "VSC ENDING",
}

FINISHED_SESSION_STATUSES = {
    "finalised",
    "finalized",
    "ends",
    "aborted",
    "inactive",
    "finished",
}

AVERAGE_LAP_SECONDS = 98.0


def parse_compound(comp: Any) -> str:
    """Normalize numeric or string tyre compound to standard single-letter code."""
    if comp is None:
        return "M"
    if isinstance(comp, int):
        return TYRE_COMPOUND_MAP.get(comp, "M")
    if isinstance(comp, str) and comp:
        if comp.isdigit():
            return TYRE_COMPOUND_MAP.get(int(comp), "M")
        return comp[0].upper()
    return "M"


def deep_merge(base: dict, update: dict) -> dict:
    """Recursively merge *update* into *base*, mutating base in place.

    Handles F1 SignalR's convention where initial snapshots send collections
    (``Stints``, ``Sectors``, ``Stats``, ``BestLapTimes``) as a ``list`` and
    subsequent delta frames send index-keyed ``dict``s (``{"0": {...}}``).
    """
    if not isinstance(update, dict):
        return base
    for k, v in update.items():
        existing = base.get(k)
        if isinstance(v, dict) and isinstance(existing, dict):
            deep_merge(existing, v)
        elif isinstance(v, dict) and isinstance(existing, list):
            as_dict = {str(idx): item for idx, item in enumerate(existing)}
            deep_merge(as_dict, v)
            base[k] = as_dict
        elif isinstance(v, list) and isinstance(existing, dict):
            as_dict = {str(idx): item for idx, item in enumerate(v)}
            deep_merge(existing, as_dict)
        else:
            base[k] = v
    return base


def classify_rc_msg(m: dict) -> str:
    """Classify a RaceControl message into 'flag', 'pit', or 'system'."""
    cat = str(m.get("Category", "")).lower()
    msg_text = str(m.get("Message", "")).upper()
    if "flag" in cat or "FLAG" in msg_text:
        return "flag"
    if "pit" in cat or "PIT" in msg_text:
        return "pit"
    return "system"


def to_int(value: Any) -> int | None:
    """Safely convert a value to int, returning None when conversion fails."""
    try:
        return int(str(value))
    except (TypeError, ValueError):
        return None


def parse_gap_seconds(value: Any) -> float | None:
    """Parse ``+12.345`` / ``1 LAP`` / ``1L`` into seconds, or None for leader rows."""
    if value is None:
        return None
    text = str(value).strip().upper()
    if not text or text in {"LEADER", "-", "--"}:
        return None
    if text.startswith("LAP "):
        return None

    lap_match = re.search(r"^\+?(\d+)\s*(?:LAPS?|L)\b", text)
    if lap_match:
        return float(lap_match.group(1)) * AVERAGE_LAP_SECONDS

    cleaned = text.replace("+", "").replace("S", "").strip()
    try:
        return float(cleaned)
    except ValueError:
        return None


def segment_color(segment: dict) -> str:
    """Map F1 OverallFastest / PersonalFastest flags to color names."""
    if not isinstance(segment, dict):
        return "yellow"
    if segment.get("OverallFastest", False):
        return "purple"
    if segment.get("PersonalFastest", False):
        return "green"
    return "yellow"


def resolve_track_status(payload: dict) -> str:
    """Map SignalR TrackStatus payload to frontend status string."""
    status_val = payload.get("Status", "1")
    msg = payload.get("Message", "")
    return TRACK_STATUS_MAP.get(str(status_val), msg or "GREEN")


def extract_driver_sectors(td: dict) -> tuple[dict, dict, dict]:
    """Normalize list or dict Sectors payload into a 3-tuple of sector dicts."""
    sectors_raw = td.get("Sectors", [])
    if isinstance(sectors_raw, list):
        sector_items = sectors_raw
    elif isinstance(sectors_raw, dict):
        sector_items = [
            sectors_raw.get("0", {}),
            sectors_raw.get("1", {}),
            sectors_raw.get("2", {}),
        ]
    else:
        sector_items = []
    s0 = sector_items[0] if len(sector_items) > 0 and isinstance(sector_items[0], dict) else {}
    s1 = sector_items[1] if len(sector_items) > 1 and isinstance(sector_items[1], dict) else {}
    s2 = sector_items[2] if len(sector_items) > 2 and isinstance(sector_items[2], dict) else {}
    return s0, s1, s2


def format_sector_value(sector: dict) -> str:
    """Return active sector Value, falling back to PreviousValue or '-'."""
    if not isinstance(sector, dict):
        return "-"
    val = str(sector.get("Value") or "").strip()
    if val:
        return val
    prev = str(sector.get("PreviousValue") or "").strip()
    return prev if prev else "-"


def extract_driver_gap_and_interval(td: dict, position_int: int) -> tuple[str, str]:
    """Extract gap-to-leader and interval for Race, Practice, and Qualifying."""
    if position_int == 1:
        return "LEADER", "-"

    gap_val = str(td.get("GapToLeader") or "").strip()
    if not gap_val:
        gap_val = str(td.get("TimeDiffToFastest") or "").strip()

    interval_raw = td.get("IntervalToPositionAhead", {})
    interval_val = (
        str(interval_raw.get("Value") or "").strip()
        if isinstance(interval_raw, dict)
        else str(interval_raw or "").strip()
    )
    if not interval_val:
        interval_val = str(
            td.get("TimeDifftoPositionAhead")
            or td.get("TimeDiffToPositionAhead")
            or ""
        ).strip()

    if not gap_val or not interval_val:
        stats_raw = td.get("Stats")
        stats_list: list[dict] = []
        if isinstance(stats_raw, list):
            stats_list = [s for s in stats_raw if isinstance(s, dict)]
        elif isinstance(stats_raw, dict):
            stats_list = [
                stats_raw[k]
                for k in sorted(
                    stats_raw,
                    key=lambda x: int(x) if str(x).isdigit() else 0,
                )
                if isinstance(stats_raw[k], dict)
            ]
        for stat in reversed(stats_list):
            if not gap_val:
                cand_gap = str(stat.get("TimeDiffToFastest") or "").strip()
                if cand_gap:
                    gap_val = cand_gap
            if not interval_val:
                cand_int = str(
                    stat.get("TimeDifftoPositionAhead")
                    or stat.get("TimeDiffToPositionAhead")
                    or ""
                ).strip()
                if cand_int:
                    interval_val = cand_int

    return (gap_val if gap_val else "-"), (interval_val if interval_val else "-")


def extract_driver_lap_time(td: dict) -> tuple[dict, str]:
    """Return the active lap dict (for colour flags) and best available lap string."""
    last_lap = td.get("LastLapTime", {})
    last_lap_dict = last_lap if isinstance(last_lap, dict) else {}
    last_lap_val = (
        str(last_lap_dict.get("Value") or "").strip()
        if isinstance(last_lap, dict)
        else str(last_lap or "").strip()
    )
    if last_lap_val:
        return last_lap_dict, last_lap_val

    best_lap = td.get("BestLapTime", {})
    best_lap_val = (
        str(best_lap.get("Value") or "").strip()
        if isinstance(best_lap, dict)
        else str(best_lap or "").strip()
    )
    if best_lap_val:
        return last_lap_dict, best_lap_val

    best_laps_raw = td.get("BestLapTimes")
    best_laps_list: list[dict] = []
    if isinstance(best_laps_raw, list):
        best_laps_list = [b for b in best_laps_raw if isinstance(b, dict)]
    elif isinstance(best_laps_raw, dict):
        best_laps_list = [
            best_laps_raw[k]
            for k in sorted(
                best_laps_raw,
                key=lambda x: int(x) if str(x).isdigit() else 0,
            )
            if isinstance(best_laps_raw[k], dict)
        ]
    for entry in reversed(best_laps_list):
        cand = str(entry.get("Value") or "").strip()
        if cand:
            return last_lap_dict, cand

    return last_lap_dict, "-"


def extract_driver_stints(ta: dict) -> tuple[str, int, list[dict], int]:
    """Extract current compound, tyre age, stint list, and raw stint count."""
    stints_raw = ta.get("Stints", [])
    if isinstance(stints_raw, dict):
        stints = [
            stints_raw[k]
            for k in sorted(
                stints_raw,
                key=lambda x: int(x) if str(x).isdigit() else 0,
            )
            if isinstance(stints_raw[k], dict)
        ]
    elif isinstance(stints_raw, list):
        stints = [s for s in stints_raw if isinstance(s, dict)]
    else:
        stints = []

    current_compound = "M"
    tyre_age = 0
    stints_list: list[dict] = []
    for stint in stints:
        raw_comp = stint.get("Compound")
        if raw_comp is not None and str(raw_comp).strip() and str(raw_comp).strip().upper() != "UNKNOWN":
            current_compound = parse_compound(raw_comp)
        stint_laps = stint.get("TotalLaps", stint.get("LapNumber", 0))
        try:
            stint_laps = int(stint_laps)
        except (TypeError, ValueError):
            stint_laps = 0
        tyre_age = stint_laps
        stints_list.append({"tyre": current_compound, "laps": stint_laps})

    return current_compound, tyre_age, stints_list, len(stints)


def format_weather(wd: dict) -> dict[str, str]:
    """Format SignalR WeatherData into display strings."""
    return {
        "air": f"{wd.get('AirTemp', '--')}°C",
        "track": f"{wd.get('TrackTemp', '--')}°C",
        "humidity": f"{wd.get('Humidity', '--')}%",
        "rain": f"{wd.get('Rainfall', '0')}%",
    }


def build_radio_entries(
    team_radio: list[dict], session_info: dict
) -> tuple[str, Any, Any, list[dict]]:
    """Build playable static F1 team-radio entries from relative capture paths."""
    session_path = str(session_info.get("Path") or "").strip("/")
    meeting = session_info.get("Meeting") or {}
    meeting_key = meeting.get("Key") if isinstance(meeting, dict) else None
    session_key = session_info.get("Key")
    radio: list[dict] = []
    for capture in team_radio:
        path = str(capture.get("Path") or "").lstrip("/")
        if not path:
            continue
        if path.startswith("http"):
            url = path
        elif session_path:
            url = f"https://livetiming.formula1.com/static/{session_path}/{path}"
        else:
            continue
        number = capture.get("RacingNumber")
        radio.append(
            {
                "session_key": session_key,
                "meeting_key": meeting_key,
                "date": capture.get("Utc") or "",
                "driver_number": int(number) if str(number).isdigit() else 0,
                "recording_url": url,
            }
        )
    return session_path, session_key, meeting_key, radio
