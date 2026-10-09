"""
Service layer that parses raw F1 SignalR messages into the structured
format expected by the LiveTimingPage frontend component.
"""
from __future__ import annotations

import json
import logging
from datetime import datetime
from typing import Any

logger = logging.getLogger(__name__)

# 2026 grid – kept in sync with the frontend teamColors map
TEAM_LOOKUP: dict[str, str] = {
    "1": "Red Bull Racing", "61": "Red Bull Racing",      # VER, HAD
    "4": "McLaren", "81": "McLaren",                       # NOR, PIA
    "16": "Ferrari", "44": "Ferrari",                      # LEC, HAM
    "63": "Mercedes", "12": "Mercedes",                    # RUS, ANT
    "14": "Aston Martin", "18": "Aston Martin",            # ALO, STR
    "31": "Haas F1 Team", "87": "Haas F1 Team",            # OCO, BEA
    "55": "Williams", "23": "Williams",                    # SAI, ALB
    "10": "Alpine", "27": "Alpine",                        # GAS, COL (placeholder)
    "20": "Audi", "5": "Audi",                             # HUL, BOR (placeholder)
    "22": "Racing Bulls", "30": "Racing Bulls",            # TSU, LAW
    "77": "Cadillac", "11": "Cadillac",                    # BOT, PER
}

TYRE_COMPOUND_MAP: dict[int, str] = {
    1: "S", 2: "M", 3: "H", 4: "I", 5: "W",
    # Also accept string keys from some feeds
}


class LiveTimingState:
    """
    Accumulates incremental SignalR updates and produces a full snapshot
    in the shape the frontend expects.
    """

    def __init__(self) -> None:
        self.driver_list: dict[str, dict] = {}     # keyed by racing number str
        self.timing_data: dict[str, dict] = {}      # keyed by racing number str
        self.timing_stats: dict[str, dict] = {}
        self.timing_app_data: dict[str, dict] = {}
        self.weather_data: dict[str, Any] = {}
        self.track_status: str = "GREEN"
        self.session_info: dict[str, Any] = {}
        self.session_status: str = ""
        self.race_control_messages: list[dict] = []
        self.lap_count: dict[str, Any] = {}
        self.is_live: bool = True

    # ------------------------------------------------------------------
    # Ingest helpers – called when a SignalR message arrives
    # ------------------------------------------------------------------

    def update(self, topic: str, payload: Any) -> None:
        """Route an incoming SignalR topic+payload to the right handler."""
        handler = {
            "TimingData": self._handle_timing_data,
            "TimingStats": self._handle_timing_stats,
            "TimingAppData": self._handle_timing_app_data,
            "DriverList": self._handle_driver_list,
            "WeatherData": self._handle_weather,
            "TrackStatus": self._handle_track_status,
            "SessionInfo": self._handle_session_info,
            "SessionStatus": self._handle_session_status,
            "RaceControlMessages": self._handle_race_control,
            "LapCount": self._handle_lap_count,
        }.get(topic)

        if handler:
            try:
                handler(payload)
            except Exception:
                logger.exception(f"Error handling topic {topic}")

    def _deep_merge(self, base: dict, update: dict) -> dict:
        """Recursively merge *update* into *base*, mutating base in place."""
        for k, v in update.items():
            if isinstance(v, dict) and isinstance(base.get(k), dict):
                self._deep_merge(base[k], v)
            else:
                base[k] = v
        return base

    # ---- topic handlers ----

    def _handle_timing_data(self, payload: Any) -> None:
        if not isinstance(payload, dict):
            return
        lines = payload.get("Lines", payload)
        if isinstance(lines, dict):
            for num, info in lines.items():
                if num not in self.timing_data:
                    self.timing_data[num] = {}
                self._deep_merge(self.timing_data[num], info)

    def _handle_timing_stats(self, payload: Any) -> None:
        if not isinstance(payload, dict):
            return
        lines = payload.get("Lines", payload)
        if isinstance(lines, dict):
            for num, info in lines.items():
                if num not in self.timing_stats:
                    self.timing_stats[num] = {}
                self._deep_merge(self.timing_stats[num], info)

    def _handle_timing_app_data(self, payload: Any) -> None:
        if not isinstance(payload, dict):
            return
        lines = payload.get("Lines", payload)
        if isinstance(lines, dict):
            for num, info in lines.items():
                if num not in self.timing_app_data:
                    self.timing_app_data[num] = {}
                self._deep_merge(self.timing_app_data[num], info)

    def _handle_driver_list(self, payload: Any) -> None:
        if isinstance(payload, dict):
            for num, info in payload.items():
                if num not in self.driver_list:
                    self.driver_list[num] = {}
                self._deep_merge(self.driver_list[num], info)

    def _handle_weather(self, payload: Any) -> None:
        if isinstance(payload, dict):
            self._deep_merge(self.weather_data, payload)

    def _handle_track_status(self, payload: Any) -> None:
        if isinstance(payload, dict):
            status_val = payload.get("Status", "1")
            msg = payload.get("Message", "")
            status_map = {
                "1": "GREEN", "2": "YELLOW", "4": "SC",
                "5": "RED", "6": "VSC", "7": "VSC ENDING",
            }
            self.track_status = status_map.get(str(status_val), msg or "GREEN")

    def _handle_session_info(self, payload: Any) -> None:
        if isinstance(payload, dict):
            self._deep_merge(self.session_info, payload)

    def _handle_session_status(self, payload: Any) -> None:
        if isinstance(payload, dict):
            self.session_status = payload.get("Status", "")

    def _handle_race_control(self, payload: Any) -> None:
        if isinstance(payload, dict):
            msgs = payload.get("Messages", {})
            if isinstance(msgs, dict):
                for _, m in msgs.items():
                    self.race_control_messages.insert(0, {
                        "time": m.get("Utc", datetime.utcnow().strftime("%H:%M:%S")),
                        "msg": m.get("Message", ""),
                        "type": self._classify_rc_msg(m),
                    })
                # Keep last 30
                self.race_control_messages = self.race_control_messages[:30]

    def _handle_lap_count(self, payload: Any) -> None:
        if isinstance(payload, dict):
            self._deep_merge(self.lap_count, payload)

    @staticmethod
    def _classify_rc_msg(m: dict) -> str:
        cat = str(m.get("Category", "")).lower()
        msg_text = str(m.get("Message", "")).upper()
        if "flag" in cat or "FLAG" in msg_text:
            return "flag"
        if "pit" in cat or "PIT" in msg_text:
            return "pit"
        return "system"

    # ------------------------------------------------------------------
    # Snapshot builder – produces the dict the frontend expects
    # ------------------------------------------------------------------

    def snapshot(self) -> dict:
        """
        Build a full TimingData payload matching the frontend contract:
        {type, is_live_session, lines[], trackStatus, weather{}, messages[]}
        """
        lines: list[dict] = []

        for num in self.timing_data:
            td = self.timing_data.get(num, {})
            dl = self.driver_list.get(num, {})
            ts = self.timing_stats.get(num, {})
            ta = self.timing_app_data.get(num, {})

            abbr = dl.get("Tla", dl.get("RacingNumber", num))
            team = dl.get("TeamName", TEAM_LOOKUP.get(num, "Unknown"))

            # Sectors
            sectors = td.get("Sectors", {})
            s0 = sectors.get("0", {})
            s1 = sectors.get("1", {})
            s2 = sectors.get("2", {})

            # Best lap from TimingStats
            best_lap_time = ts.get("PersonalBestLapTime", {})

            # Current stint / tyre from TimingAppData
            stints_raw = ta.get("Stints", {})
            current_compound = "M"
            tyre_age = 0
            pits = 0
            stints_list = []
            if isinstance(stints_raw, dict):
                sorted_stints = sorted(stints_raw.items(), key=lambda x: int(x[0]) if x[0].isdigit() else 0)
                pits = max(0, len(sorted_stints) - 1)
                for _, stint in sorted_stints:
                    comp = stint.get("Compound", "M")
                    if comp:
                        current_compound = comp[0].upper() if len(comp) > 0 else "M"
                    total_laps = stint.get("TotalLaps", 0)
                    tyre_age = total_laps
                    stints_list.append({"tyre": current_compound, "laps": total_laps})

            # Position
            position = td.get("Position", td.get("Line", 0))

            # Status
            in_pit = td.get("InPit", False)
            pit_out = td.get("PitOut", False)
            status = "PIT" if in_pit else ("OUT" if pit_out else "TRACK")

            # Gap & Interval
            gap_to_leader = td.get("GapToLeader", "")
            interval = td.get("IntervalToPositionAhead", {})
            interval_val = interval.get("Value", "") if isinstance(interval, dict) else str(interval)

            # Last lap time
            last_lap = td.get("LastLapTime", {})
            last_lap_value = last_lap.get("Value", "") if isinstance(last_lap, dict) else str(last_lap)

            lines.append({
                "driver": abbr,
                "team": team,
                "position": int(position) if str(position).isdigit() else 99,
                "gap": gap_to_leader if gap_to_leader else "LEADER",
                "interval": interval_val if interval_val else "-",
                "lastLap": last_lap_value or "-",
                "lap_time_num": 0,
                "bestLapNum": 0,
                "sector1": s0.get("Value", "-"),
                "sector2": s1.get("Value", "-"),
                "sector3": s2.get("Value", "-"),
                "s1_num": 0, "s2_num": 0, "s3_num": 0,
                "s1_color": self._segment_color(s0),
                "s2_color": self._segment_color(s1),
                "s3_color": self._segment_color(s2),
                "lap_color": self._segment_color(last_lap if isinstance(last_lap, dict) else {}),
                "tyre": current_compound,
                "tyre_age": tyre_age,
                "pits": pits,
                "status": status,
                "progress": 0,
                "stints": stints_list,
            })

        # Sort by position
        lines.sort(key=lambda x: x["position"])

        # Weather
        wd = self.weather_data
        weather = {
            "air": f"{wd.get('AirTemp', '--')}°C",
            "track": f"{wd.get('TrackTemp', '--')}°C",
            "humidity": f"{wd.get('Humidity', '--')}%",
            "rain": f"{wd.get('Rainfall', '0')}%",
        }

        return {
            "type": "TimingData",
            "is_live_session": self.is_live,
            "lines": lines,
            "trackStatus": self.track_status,
            "weather": weather,
            "messages": self.race_control_messages[:20],
        }

    @staticmethod
    def _segment_color(segment: dict) -> str:
        """Map F1 OverallFastest / PersonalFastest flags to color names."""
        if not isinstance(segment, dict):
            return "yellow"
        if segment.get("OverallFastest", False):
            return "purple"
        if segment.get("PersonalFastest", False):
            return "green"
        return "yellow"
