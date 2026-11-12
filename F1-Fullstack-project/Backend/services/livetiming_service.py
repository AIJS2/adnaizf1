"""
Service layer that parses raw F1 SignalR messages into the structured
format expected by the LiveTimingPage frontend component.
"""

from __future__ import annotations

import base64
import json
import logging
import math
import threading
import zlib
from datetime import datetime, timezone
from typing import Any

from services import canonical_circuits, circuit_map_service
from services.signalr_parsers import (
    AVERAGE_LAP_SECONDS,
    FINISHED_SESSION_STATUSES,
    TEAM_LOOKUP,
    TYRE_COMPOUND_MAP,
    build_radio_entries,
    classify_rc_msg,
    deep_merge,
    extract_driver_gap_and_interval,
    extract_driver_lap_time,
    extract_driver_sectors,
    extract_driver_stints,
    format_sector_value,
    format_weather,
    parse_compound,
    parse_gap_seconds,
    resolve_track_status,
    segment_color,
    to_int,
)

logger = logging.getLogger(__name__)

# Last non-empty radio capture published by any LiveTimingState instance.
# Team radio is intentionally kept across ``reset()`` so the REST fallback can
# still answer when OpenF1 is paywalled or unreachable after a session ends.
_radio_cache_lock = threading.Lock()
_radio_cache: dict[str, Any] = {}



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
        self.position_data: dict[str, dict] = {}
        self.car_data: dict[str, dict] = {}
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
            self.position_data.clear()
            self.car_data.clear()
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
            "Position": self._handle_position,
            "Position.z": self._handle_position,
            "CarData": self._handle_car_data,
            "CarData.z": self._handle_car_data,
        }.get(topic)

    def _deep_merge(self, base: dict, update: dict) -> dict:
        """Recursively merge *update* into *base*, mutating base in place."""
        return deep_merge(base, update)


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
            self.track_status = resolve_track_status(payload)


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

    @staticmethod
    def _decode_compressed_payload(payload: Any) -> Any:
        if isinstance(payload, str):
            try:
                raw = zlib.decompress(base64.b64decode(payload), -zlib.MAX_WBITS)
                return json.loads(raw.decode("utf-8"))
            except Exception:
                return None
        return payload

    def _handle_position(self, payload: Any) -> None:
        decoded = self._decode_compressed_payload(payload)
        if not isinstance(decoded, dict):
            return
        frames = decoded.get("Position")
        if isinstance(frames, list) and frames:
            latest = frames[-1]
            entries = latest.get("Entries") if isinstance(latest, dict) else None
            if isinstance(entries, dict):
                for num, pos in entries.items():
                    if isinstance(pos, dict):
                        self.position_data[str(num)] = pos
        elif isinstance(decoded.get("Entries"), dict):
            for num, pos in decoded["Entries"].items():
                if isinstance(pos, dict):
                    self.position_data[str(num)] = pos

    def _handle_car_data(self, payload: Any) -> None:
        decoded = self._decode_compressed_payload(payload)
        if not isinstance(decoded, dict):
            return
        entries = decoded.get("Entries")
        if isinstance(entries, list) and entries:
            latest = entries[-1]
            cars = latest.get("Cars") if isinstance(latest, dict) else None
            if isinstance(cars, dict):
                for num, car in cars.items():
                    channels = car.get("Channels") if isinstance(car, dict) else None
                    if isinstance(channels, dict):
                        self.car_data[str(num)] = channels

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
        return classify_rc_msg(m)

    # ------------------------------------------------------------------
    # Session metadata / finish detection
    # ------------------------------------------------------------------

    @staticmethod
    def _to_int(value: Any) -> int | None:
        return to_int(value)


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
        return parse_gap_seconds(value)


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

            s0, s1, s2 = extract_driver_sectors(td)
            current_compound, tyre_age, stints_list, stints_count = (
                extract_driver_stints(ta)
            )

            # Position
            position = td.get("Position", td.get("Line", 0))
            position_int = (
                int(position) if str(position).isdigit() else 99
            )

            # Pit stops: take the max of NumberOfPitStops and completed stints
            # because red-flag tyre changes or partial feed deltas can leave
            # NumberOfPitStops behind the actual stint list.
            stint_based_pits = max(0, stints_count - 1)
            pits_raw = td.get("NumberOfPitStops")
            if pits_raw is not None and str(pits_raw).isdigit():
                pits = max(int(str(pits_raw)), stint_based_pits)
            else:
                pits = stint_based_pits

            # Status
            retired = bool(
                td.get("Retired", False)
                or td.get("Stopped", False)
                or td.get("KnockedOut", False)
            )
            in_pit = bool(td.get("InPit", False))
            pit_out = bool(td.get("PitOut", False))
            status = (
                "OUT"
                if retired
                else ("PIT" if in_pit else ("OUT" if pit_out else "TRACK"))
            )

            # Gap & Interval for Race, Practice (TimeDiffToFastest), and
            # Qualifying (Stats Q1/Q2/Q3). Leader is always "LEADER" / "-".
            gap_to_leader, interval_val = extract_driver_gap_and_interval(
                td, position_int
            )

            # Gap in seconds is also what spreads the track-map dots
            # along the real circuit outline. The leader's feed value is
            # the current lap ("LAP 43"), not a gap.
            gap_seconds = self._parse_gap_seconds(gap_to_leader)
            if gap_seconds is None and position_int > 1:
                gap_seconds = self._parse_gap_seconds(interval_val)
            if position_int == 1:
                gap_seconds = 0.0

            # Last lap time (falls back to BestLapTime when in pit / between runs)
            last_lap_dict, last_lap_value = extract_driver_lap_time(td)

            lines.append(
                {
                    "driver": abbr,
                    "racing_number": str(num),
                    "team": team,
                    "position": position_int,
                    "gap": gap_to_leader,
                    "interval": interval_val,
                    "lastLap": last_lap_value,
                    "lap_time_num": 0,
                    "bestLapNum": 0,
                    "sector1": format_sector_value(s0),
                    "sector2": format_sector_value(s1),
                    "sector3": format_sector_value(s2),
                    "s1_num": 0,
                    "s2_num": 0,
                    "s3_num": 0,
                    "s1_color": self._segment_color(s0),
                    "s2_color": self._segment_color(s1),
                    "s3_color": self._segment_color(s2),
                    "lap_color": self._segment_color(last_lap_dict),
                    "tyre": current_compound,
                    "tyre_age": tyre_age,
                    "pits": pits,
                    "status": status,
                    "retired": retired,
                    "gap_seconds": gap_seconds,
                    "progress": 0.0,
                    "stints": stints_list,
                }
            )

        # Sort by position, then derive progress after sorting so lapped
        # cars without a numeric gap still get distinct positions.
        lines.sort(key=lambda x: x["position"])
        canonical = canonical_circuits.get_canonical_circuit(
            circuit.get("key") if isinstance(circuit, dict) else None,
            country=circuit.get("country") if isinstance(circuit, dict) else None,
            location=circuit.get("location") if isinstance(circuit, dict) else None,
        )
        can_xs = canonical.get("x") if isinstance(canonical, dict) else None
        can_ys = canonical.get("y") if isinstance(canonical, dict) else None
        can_ds = canonical.get("norm_distance") if isinstance(canonical, dict) else None
        can_rot = float(canonical.get("rotation", 0.0)) if isinstance(canonical, dict) else 0.0

        running_gap = 0.0
        for index, line in enumerate(lines):
            position_int = line["position"]
            gap_seconds = line.get("gap_seconds")
            interval_sec = self._parse_gap_seconds(line.get("interval"))
            if position_int == 1:
                line["gap_seconds"] = 0.0
                line["progress"] = 0.0
                running_gap = 0.0
            elif gap_seconds is not None:
                if gap_seconds >= AVERAGE_LAP_SECONDS:
                    if interval_sec is not None and 0 < interval_sec < AVERAGE_LAP_SECONDS:
                        running_gap += float(interval_sec)
                    else:
                        running_gap += 3.2
                    sub_lap = (running_gap % (AVERAGE_LAP_SECONDS * 0.92)) / AVERAGE_LAP_SECONDS
                    line["progress"] = round(min(max(sub_lap, 0.05), 0.96), 4)
                else:
                    running_gap = float(gap_seconds)
                    line["progress"] = min(
                        max(float(gap_seconds), 0.5) / AVERAGE_LAP_SECONDS,
                        0.9,
                    )
            else:
                if interval_sec is not None and 0 < interval_sec < AVERAGE_LAP_SECONDS:
                    running_gap += float(interval_sec)
                    line["progress"] = min(
                        max(running_gap % AVERAGE_LAP_SECONDS, 0.5) / AVERAGE_LAP_SECONDS,
                        0.94,
                    )
                else:
                    line["progress"] = min(0.04 + index * 0.012, 0.9)

            # Project live Position.z telemetry coordinates onto canonical track when available
            rnum = line.get("racing_number")
            pos_entry = self.position_data.get(str(rnum)) if rnum else None
            if (
                isinstance(pos_entry, dict)
                and isinstance(can_xs, list)
                and isinstance(can_ys, list)
                and isinstance(can_ds, list)
                and len(can_xs) == len(can_ys) == len(can_ds)
                and len(can_xs) > 3
            ):
                px = pos_entry.get("X")
                py = pos_entry.get("Y")
                if isinstance(px, (int, float)) and isinstance(py, (int, float)) and (px != 0 or py != 0):
                    rad = math.radians(can_rot)
                    cos_a, sin_a = math.cos(rad), math.sin(rad)
                    rx = float(px) * cos_a - float(py) * sin_a
                    ry = -(float(px) * sin_a + float(py) * cos_a)
                    best_i = min(
                        range(len(can_xs)),
                        key=lambda i: (can_xs[i] - rx) ** 2 + (can_ys[i] - ry) ** 2,
                    )
                    line["progress"] = float(can_ds[best_i])

        # Weather
        weather = format_weather(self.weather_data)

        # Team radio: the free SignalR feed supplies relative capture
        # paths; the playable file lives under the session's static path.
        _, session_key, meeting_key, radio = build_radio_entries(
            self.team_radio, self.session_info
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
        return segment_color(segment)



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
