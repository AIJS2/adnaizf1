"""
Service layer that parses raw F1 SignalR messages into the structured
format expected by the LiveTimingPage frontend component.
"""

from __future__ import annotations

import logging
import re
import threading
from datetime import datetime, timezone
from typing import Any

from services import circuit_map_service

logger = logging.getLogger(__name__)

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
    # Also accept string keys from some feeds
}

# The live feed reports the end of a session in several places depending on
# how far the archive has progressed. Any of these means the classification on
# screen is final, even when TrackStatus still says GREEN.
FINISHED_SESSION_STATUSES = {
    "finalised",
    "finalized",
    "ends",
    "aborted",
    "inactive",
    "finished",
}

# Used only to spread the dots along the real circuit outline when the feed
# exposes a gap in seconds. A representative dry lap keeps the spacing stable
# without pretending it is a measured lap time.
AVERAGE_LAP_SECONDS = 98.0

# Last non-empty radio capture published by any LiveTimingState instance.
# Team radio is intentionally kept across ``reset()`` so the REST fallback can
# still answer when OpenF1 is paywalled or unreachable after a session ends.
_radio_cache_lock = threading.Lock()
_radio_cache: dict[str, Any] = {}


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


class LiveTimingState:
    """
    Accumulates incremental SignalR updates and produces a full snapshot
    in the shape the frontend expects.
    """

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self.driver_list: dict[str, dict] = {}  # keyed by racing number str
        self.timing_data: dict[str, dict] = {}  # keyed by racing number str
        self.timing_stats: dict[str, dict] = {}
        self.timing_app_data: dict[str, dict] = {}
        self.weather_data: dict[str, Any] = {}
        self.track_status: str = "GREEN"
        self.session_info: dict[str, Any] = {}
        self.session_status: str = ""
        self.session_started: str = ""
        self.archive_status: str = ""
        self.last_session: dict[str, Any] | None = None
        self.race_control_messages: list[dict] = []
        # Composite (Utc|Message) keys already buffered, so SignalR retries
        # that re-send the whole list cannot duplicate entries.
        self._race_control_keys: set[str] = set()
        self.lap_count: dict[str, Any] = {}
        self.team_radio: list[dict] = []
        self._team_radio_keys: set[str] = set()
        self.is_live: bool = True

    # ------------------------------------------------------------------
    # Ingest helpers – called when a SignalR message arrives
    # ------------------------------------------------------------------

    def reset(self) -> None:
        """Drop all accumulated data when a session is no longer live.

        Without this, a backend that stays up across race weekends would keep
        serving the previous session's drivers and timing rows. Only called
        when the schedule says no session is active; reconnects during a live
        session keep the accumulated state.
        """
        with self._lock:
            # Preserve a compact record of the session that just ended so the
            # no-session payload can still tell the user what they were
            # watching. It is deliberately not cleared below.
            if self.session_info and self.timing_data and self._is_finished_locked():
                self.last_session = self._build_last_session_locked()

            self.driver_list.clear()
            self.timing_data.clear()
            self.timing_stats.clear()
            self.timing_app_data.clear()
            self.weather_data.clear()
            self.track_status = "GREEN"
            self.session_info.clear()
            self.session_status = ""
            self.session_started = ""
            self.archive_status = ""
            self.race_control_messages.clear()
            self._race_control_keys.clear()
            self.lap_count.clear()
            self.team_radio.clear()
            self._team_radio_keys.clear()
            self.is_live = False

    def update(self, topic: str, payload: Any) -> None:
        """Route an incoming SignalR topic+payload to the right handler under lock."""
        handler = self._get_topic_handler(topic)
        if handler:
            try:
                with self._lock:
                    handler(payload)
            except Exception:
                logger.exception(f"Error handling topic {topic}")

    def update_batch(self, result: dict[str, Any]) -> None:
        """Ingest a full SignalR initial snapshot atomically under lock."""
        if not isinstance(result, dict):
            return
        ordered_topics = [
            "SessionInfo",
            "DriverList",
            "WeatherData",
            "TrackStatus",
            "SessionStatus",
            "ArchiveStatus",
            "LapCount",
            "TimingStats",
            "TimingAppData",
            "RaceControlMessages",
            "TeamRadio",
            "TimingData",
        ]
        seen = set(ordered_topics)
        extra_topics = [t for t in result.keys() if t not in seen]

        with self._lock:
            for topic in ordered_topics + extra_topics:
                if topic not in result:
                    continue
                handler = self._get_topic_handler(topic)
                if handler:
                    try:
                        handler(result[topic])
                    except Exception:
                        logger.exception(f"Error handling topic {topic}")

            if self.session_info and self.timing_data and self._is_finished_locked():
                self.last_session = self._build_last_session_locked()

    def _get_topic_handler(self, topic: str):
        return {
            "TimingData": self._handle_timing_data,
            "TimingStats": self._handle_timing_stats,
            "TimingAppData": self._handle_timing_app_data,
            "DriverList": self._handle_driver_list,
            "WeatherData": self._handle_weather,
            "TrackStatus": self._handle_track_status,
            "SessionInfo": self._handle_session_info,
            "SessionStatus": self._handle_session_status,
            "ArchiveStatus": self._handle_archive_status,
            "RaceControlMessages": self._handle_race_control,
            "LapCount": self._handle_lap_count,
            "TeamRadio": self._handle_team_radio,
        }.get(topic)

    def _deep_merge(self, base: dict, update: dict) -> dict:
        """Recursively merge *update* into *base*, mutating base in place."""
        # SignalR payloads occasionally carry scalar metadata such as
        # ``_kf: true`` alongside the actual topic data. Treat anything that
        # is not a mapping as a leaf so a marker can never crash a handler.
        if not isinstance(update, dict):
            return base
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
                # ``_kf`` is a SignalR bookkeeping flag, not a driver.
                if str(num).startswith("_") or not isinstance(info, dict):
                    continue
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
                "1": "GREEN",
                "2": "YELLOW",
                "4": "SC",
                "5": "RED",
                "6": "VSC",
                "7": "VSC ENDING",
            }
            self.track_status = status_map.get(str(status_val), msg or "GREEN")

    def _handle_session_info(self, payload: Any) -> None:
        if isinstance(payload, dict):
            self._deep_merge(self.session_info, payload)
            archive = payload.get("ArchiveStatus")
            if isinstance(archive, dict) and archive.get("Status"):
                self.archive_status = str(archive.get("Status"))

    def _handle_session_status(self, payload: Any) -> None:
        if isinstance(payload, dict):
            self.session_status = str(payload.get("Status", "") or "")
            started = payload.get("Started")
            if started:
                self.session_started = str(started)

    def _handle_archive_status(self, payload: Any) -> None:
        if isinstance(payload, dict):
            status = payload.get("Status")
            if status:
                self.archive_status = str(status)

    def _handle_race_control(self, payload: Any) -> None:
        # SignalR re-sends the full message list on reconnect, so every retry
        # would otherwise re-insert messages we already have and the buffer
        # would fill with duplicates. Track a composite (Utc, Message) key per
        # message and skip anything already seen.
        if isinstance(payload, dict):
            msgs = payload.get("Messages", [])
            # The initial SignalR snapshot sends Messages as a list; later
            # feed deltas have been observed as either a list or a keyed dict.
            if isinstance(msgs, dict):
                entries = list(msgs.values())
            elif isinstance(msgs, list):
                entries = msgs
            else:
                entries = []

            new_entries: list[tuple[str, dict]] = []
            for m in entries:
                if not isinstance(m, dict):
                    continue
                utc = m.get("Utc") or datetime.now(timezone.utc).strftime(
                    "%H:%M:%S"
                )
                text = m.get("Message", "")
                entry = {
                    "time": utc,
                    "msg": text,
                    "type": self._classify_rc_msg(m),
                }
                new_entries.append((f"{utc}|{text}", entry))

            # Skip keys we already hold, then prepend newest-first.
            fresh: list[dict] = []
            for key, entry in new_entries:
                if key in self._race_control_keys:
                    continue
                self._race_control_keys.add(key)
                fresh.append(entry)
            self.race_control_messages = fresh + self.race_control_messages
            # Keep last 30
            self.race_control_messages = self.race_control_messages[:30]
            # Drop keys whose entry fell out of the buffer so the set
            # cannot grow without bound over a long session.
            self._race_control_keys = {
                f"{m['time']}|{m['msg']}" for m in self.race_control_messages
            }

    def _handle_lap_count(self, payload: Any) -> None:
        if isinstance(payload, dict):
            self._deep_merge(self.lap_count, payload)

    def _handle_team_radio(self, payload: Any) -> None:
        """Accumulate real team-radio captures from the F1 SignalR feed.

        The free live-timing feed carries ``TeamRadio.Captures`` with a
        relative ``Path``. We keep the metadata here and build the playable
        static URL in ``snapshot()`` once the session path is known.
        """
        if not isinstance(payload, dict):
            return
        captures = payload.get("Captures")
        if isinstance(captures, dict):
            captures = list(captures.values())
        if not isinstance(captures, list):
            return

        fresh: list[dict] = []
        for cap in captures:
            if not isinstance(cap, dict):
                continue
            path = str(cap.get("Path") or "")
            utc = str(cap.get("Utc") or "")
            num = str(cap.get("RacingNumber") or "")
            if not path:
                continue
            key = f"{utc}|{path}|{num}"
            if key in self._team_radio_keys:
                continue
            self._team_radio_keys.add(key)
            fresh.append({"Utc": utc, "RacingNumber": num, "Path": path})

        if fresh:
            self.team_radio = sorted(
                fresh + self.team_radio,
                key=lambda c: c.get("Utc", ""),
                reverse=True,
            )[:50]
            self._team_radio_keys = {
                f"{c['Utc']}|{c['Path']}|{c['RacingNumber']}"
                for c in self.team_radio
            }

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
    # Session metadata / finish detection
    # ------------------------------------------------------------------

    @staticmethod
    def _to_int(value: Any) -> int | None:
        try:
            return int(str(value))
        except (TypeError, ValueError):
            return None

    def _session_title_locked(self) -> str:
        meeting = self.session_info.get("Meeting") or {}
        if not isinstance(meeting, dict):
            meeting = {}
        meeting_name = str(meeting.get("Name") or "").strip()
        session_name = str(
            self.session_info.get("Name") or self.session_info.get("Type") or ""
        ).strip()
        if meeting_name and session_name:
            return f"{meeting_name} — {session_name}"
        return meeting_name or session_name

    def _circuit_locked(self) -> dict[str, Any] | None:
        return circuit_map_service.resolve_circuit(self.session_info)

    def _lap_values_locked(self) -> tuple[int | None, int | None]:
        return (
            self._to_int(self.lap_count.get("CurrentLap")),
            self._to_int(self.lap_count.get("TotalLaps")),
        )

    def _is_finished_locked(self) -> bool:
        """True once the feed has finalised the session or shown the flag."""
        session_info_status = str(
            self.session_info.get("SessionStatus") or ""
        ).strip().lower()
        status = str(self.session_status or "").strip().lower()
        started = str(self.session_started or "").strip().lower()
        archive = str(self.archive_status or "").strip().lower()

        if (
            session_info_status in FINISHED_SESSION_STATUSES
            or status in FINISHED_SESSION_STATUSES
            or started in FINISHED_SESSION_STATUSES
            or archive == "complete"
        ):
            return True

        # The chequered-flag message is a reliable signal even when the
        # status topics have not caught up yet.
        return any(
            "CHEQUERED FLAG" in str(message.get("msg") or "").upper()
            for message in self.race_control_messages
        )

    def _session_state_locked(self) -> str:
        if self._is_finished_locked():
            return "finished"
        if self.timing_data or self.session_info:
            return "live"
        return "no_session"

    def _build_last_session_locked(
        self, snap: dict[str, Any] | None = None
    ) -> dict[str, Any]:
        if snap is None:
            snap = self._build_snapshot_locked()
        leader_num: str | None = None
        for num, timing in self.timing_data.items():
            if str(timing.get("Position")) == "1":
                leader_num = num
                break
        leader = self.driver_list.get(leader_num or "", {})
        first_line = snap["lines"][0] if snap.get("lines") else {}

        return {
            "session_title": snap["session_title"],
            "session_state": "finished",
            "session_status": snap["session_status"],
            "archive_status": snap["archive_status"],
            "circuit": snap["circuit"],
            "track_status": self.track_status,
            "trackStatus": self.track_status,
            "lap": snap["lap"],
            "total_laps": snap["total_laps"],
            "leader": leader.get("Tla") or first_line.get("driver") or "",
            "leader_team": (
                leader.get("TeamName") or first_line.get("team") or ""
            ),
            "finished_at": datetime.now(timezone.utc).isoformat(),
            "lines": [dict(line) for line in snap.get("lines", [])],
            "weather": dict(snap.get("weather") or {}),
            "messages": [dict(msg) for msg in snap.get("messages", [])],
            "radio": [dict(r) for r in snap.get("radio", [])],
        }

    def last_session_snapshot(self) -> dict[str, Any] | None:
        with self._lock:
            if not self.last_session:
                return None
            snapshot = dict(self.last_session)
            if snapshot.get("circuit"):
                snapshot["circuit"] = dict(snapshot["circuit"])
            if isinstance(snapshot.get("lines"), list):
                snapshot["lines"] = [dict(line) for line in snapshot["lines"]]
            if isinstance(snapshot.get("weather"), dict):
                snapshot["weather"] = dict(snapshot["weather"])
            if isinstance(snapshot.get("messages"), list):
                snapshot["messages"] = [
                    dict(msg) for msg in snapshot["messages"]
                ]
            if isinstance(snapshot.get("radio"), list):
                snapshot["radio"] = [dict(r) for r in snapshot["radio"]]
            return snapshot

    @staticmethod
    def _parse_gap_seconds(value: Any) -> float | None:
        """Parse ``+12.345`` / ``1 LAP`` into seconds, or None for leader rows."""
        if value is None:
            return None
        text = str(value).strip().upper()
        if not text or text in {"LEADER", "-", "--"}:
            return None
        if text.startswith("LAP "):
            return None

        lap_match = re.search(r"(\d+)\s*LAPS?", text)
        if lap_match:
            return float(lap_match.group(1)) * AVERAGE_LAP_SECONDS

        cleaned = text.replace("+", "").replace("S", "").strip()
        try:
            return float(cleaned)
        except ValueError:
            return None

    # ------------------------------------------------------------------
    # Snapshot builder – produces the dict the frontend expects
    # ------------------------------------------------------------------

    def snapshot(self) -> dict:
        """
        Build a full TimingData payload matching the frontend contract:
        {type, is_live_session, lines[], trackStatus, weather{}, messages[]}
        Thread-safe under self._lock.
        """
        with self._lock:
            snap = self._build_snapshot_locked()
            if (
                snap["session_state"] == "finished"
                and snap["lines"]
                and self.session_info
            ):
                self.last_session = self._build_last_session_locked(snap)
            return snap

    def _build_snapshot_locked(self) -> dict[str, Any]:
        session_title = self._session_title_locked()
        circuit = self._circuit_locked()
        lap, total_laps = self._lap_values_locked()
        session_state = self._session_state_locked()

        lines: list[dict] = []
        driver_keys = list(self.timing_data.keys())

        for num in driver_keys:
            td = self.timing_data.get(num, {})
            dl = self.driver_list.get(num, {})
            ta = self.timing_app_data.get(num, {})

            abbr = dl.get("Tla", dl.get("RacingNumber", num))
            team = dl.get("TeamName", TEAM_LOOKUP.get(num, "Unknown"))

            # Sectors. The live feed sends a 3-item list; older/replayed
            # payloads use a keyed dict. Support both so sector times are
            # not silently dropped.
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
            s0 = sector_items[0] if len(sector_items) > 0 else {}
            s1 = sector_items[1] if len(sector_items) > 1 else {}
            s2 = sector_items[2] if len(sector_items) > 2 else {}

            # Current stint / tyre from TimingAppData. Stints are a list
            # in the live feed (chronological), but a keyed dict in some
            # archived payloads.
            stints_raw = ta.get("Stints", [])
            if isinstance(stints_raw, dict):
                stints = [
                    stints_raw[k]
                    for k in sorted(
                        stints_raw,
                        key=lambda x: int(x) if str(x).isdigit() else 0,
                    )
                ]
            elif isinstance(stints_raw, list):
                stints = [s for s in stints_raw if isinstance(s, dict)]
            else:
                stints = []

            current_compound = "M"
            tyre_age = 0
            stints_list: list[dict] = []
            for stint in stints:
                current_compound = parse_compound(stint.get("Compound"))
                stint_laps = stint.get("TotalLaps", 0)
                try:
                    stint_laps = int(stint_laps)
                except (TypeError, ValueError):
                    stint_laps = 0
                tyre_age = stint_laps
                stints_list.append(
                    {"tyre": current_compound, "laps": stint_laps}
                )

            # Position
            position = td.get("Position", td.get("Line", 0))
            position_int = (
                int(position) if str(position).isdigit() else 99
            )

            # Pit stops: prefer the feed's own count, fall back to the
            # number of completed stints.
            pits_raw = td.get("NumberOfPitStops")
            if str(pits_raw).isdigit():
                pits = int(pits_raw)
            else:
                pits = max(0, len(stints) - 1)

            # Status
            in_pit = td.get("InPit", False)
            pit_out = td.get("PitOut", False)
            status = "PIT" if in_pit else ("OUT" if pit_out else "TRACK")

            # Gap & Interval. The leader's GapToLeader is the current
            # lap ("LAP 43"), not a gap, so present it as the leader.
            gap_to_leader = td.get("GapToLeader", "")
            interval = td.get("IntervalToPositionAhead", {})
            interval_val = (
                interval.get("Value", "")
                if isinstance(interval, dict)
                else str(interval)
            )
            if position_int == 1:
                gap_to_leader = "LEADER"
                interval_val = "-"

            # Gap in seconds is also what spreads the track-map dots
            # along the real circuit outline. The leader's feed value is
            # the current lap ("LAP 43"), not a gap.
            gap_seconds = self._parse_gap_seconds(gap_to_leader)
            if gap_seconds is None and position_int > 1:
                gap_seconds = self._parse_gap_seconds(interval_val)
            if position_int == 1:
                gap_seconds = 0.0

            # Last lap time
            last_lap = td.get("LastLapTime", {})
            last_lap_value = (
                last_lap.get("Value", "")
                if isinstance(last_lap, dict)
                else str(last_lap)
            )

            lines.append(
                {
                    "driver": abbr,
                    "team": team,
                    "position": position_int,
                    "gap": gap_to_leader if gap_to_leader else "LEADER",
                    "interval": interval_val if interval_val else "-",
                    "lastLap": last_lap_value or "-",
                    "lap_time_num": 0,
                    "bestLapNum": 0,
                    "sector1": (
                        s0.get("Value", "-") if isinstance(s0, dict) else "-"
                    ),
                    "sector2": (
                        s1.get("Value", "-") if isinstance(s1, dict) else "-"
                    ),
                    "sector3": (
                        s2.get("Value", "-") if isinstance(s2, dict) else "-"
                    ),
                    "s1_num": 0,
                    "s2_num": 0,
                    "s3_num": 0,
                    "s1_color": self._segment_color(s0),
                    "s2_color": self._segment_color(s1),
                    "s3_color": self._segment_color(s2),
                    "lap_color": self._segment_color(
                        last_lap if isinstance(last_lap, dict) else {}
                    ),
                    "tyre": current_compound,
                    "tyre_age": tyre_age,
                    "pits": pits,
                    "status": status,
                    "gap_seconds": gap_seconds,
                    "progress": 0.0,
                    "stints": stints_list,
                }
            )

        # Sort by position, then derive progress after sorting so lapped
        # cars without a numeric gap still get distinct positions.
        lines.sort(key=lambda x: x["position"])
        for index, line in enumerate(lines):
            position_int = line["position"]
            gap_seconds = line.get("gap_seconds")
            if position_int == 1:
                line["gap_seconds"] = 0.0
                line["progress"] = 0.0
            elif gap_seconds is not None:
                if gap_seconds >= AVERAGE_LAP_SECONDS:
                    line["progress"] = min(0.85 + index * 0.005, 0.98)
                else:
                    line["progress"] = min(
                        max(float(gap_seconds), 0.5) / AVERAGE_LAP_SECONDS,
                        0.9,
                    )
            else:
                line["progress"] = min(0.04 + index * 0.012, 0.9)

        # Weather
        wd = self.weather_data
        weather = {
            "air": f"{wd.get('AirTemp', '--')}°C",
            "track": f"{wd.get('TrackTemp', '--')}°C",
            "humidity": f"{wd.get('Humidity', '--')}%",
            "rain": f"{wd.get('Rainfall', '0')}%",
        }

        # Team radio: the free SignalR feed supplies relative capture
        # paths; the playable file lives under the session's static path.
        session_path = str(self.session_info.get("Path") or "").strip("/")
        meeting = self.session_info.get("Meeting") or {}
        meeting_key = meeting.get("Key") if isinstance(meeting, dict) else None
        session_key = self.session_info.get("Key")
        radio: list[dict] = []
        for capture in self.team_radio:
            path = str(capture.get("Path") or "").lstrip("/")
            if not path:
                continue
            if path.startswith("http"):
                url = path
            elif session_path:
                url = (
                    "https://livetiming.formula1.com/static/"
                    f"{session_path}/{path}"
                )
            else:
                continue
            number = capture.get("RacingNumber")
            radio.append(
                {
                    "session_key": session_key,
                    "meeting_key": meeting_key,
                    "date": capture.get("Utc") or "",
                    "driver_number": (
                        int(number) if str(number).isdigit() else 0
                    ),
                    "recording_url": url,
                }
            )

        if radio:
            _publish_radio_cache(
                {
                    "session_title": session_title,
                    "session_key": session_key,
                    "meeting_key": meeting_key,
                    "data": radio,
                }
            )

        return {
            "type": "TimingData",
            "is_live_session": self.is_live,
            "session_state": session_state,
            "session_title": session_title,
            "session_status": self.session_status,
            "archive_status": self.archive_status,
            "circuit": circuit,
            "lap": lap,
            "total_laps": total_laps,
            "lines": lines,
            "trackStatus": self.track_status,
            "weather": weather,
            "messages": list(self.race_control_messages[:20]),
            "radio": radio,
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


def _publish_radio_cache(payload: dict[str, Any]) -> None:
    """Remember the latest playable SignalR radio clips for the REST fallback."""
    data = payload.get("data") or []
    if not data:
        return
    with _radio_cache_lock:
        _radio_cache.clear()
        _radio_cache.update(
            {
                "session_title": payload.get("session_title") or "",
                "session_key": payload.get("session_key"),
                "meeting_key": payload.get("meeting_key"),
                "data": [dict(item) for item in data],
            }
        )


def get_cached_radio() -> dict[str, Any]:
    """Return the last non-empty SignalR radio capture set (never raises)."""
    with _radio_cache_lock:
        if not _radio_cache:
            return {"session_title": "", "data": []}
        return {
            "session_title": _radio_cache.get("session_title") or "",
            "session_key": _radio_cache.get("session_key"),
            "meeting_key": _radio_cache.get("meeting_key"),
            "data": [dict(item) for item in _radio_cache.get("data") or []],
        }


def clear_radio_cache() -> None:
    """Drop the cached radio captures (used by tests and cache resets)."""
    with _radio_cache_lock:
        _radio_cache.clear()
