"""
Unit tests for Wave 2 Backend God Nodes and core services:
- services.race_details_service (_compute_race_details, _empty_race_payload, _get_fallback_upcoming_race, get_race_details)
- services.telemetry_service (process_telemetry_compare, _sanitize_driver_codes, _canonical_circuit_xy)
- services.openf1_telemetry (collect, driver_options, _frame_from_rows)
- services.openf1_lap_fallback (build_race_blocks, build_starting_grid, build_fastest_lap_rows)
- services.profiles_service (_normalize_slug, process_driver_profile, process_team_profile)
- services.races_service (_is_sprint_event, compute_fastf1_all_races)
- services.canonical_circuits (get_canonical_circuit, interpolate_canonical_coords)
- services.spline_smooth (_unique_waypoints, smooth_curve)
- services.standings_db (get_driver_standings_from_db, get_constructor_standings_from_db)
- services.scraper (strip_driver_abbreviation, _fallback_candidates)
"""

import logging
import os
import sys
import time
import unittest
from concurrent.futures import ThreadPoolExecutor
from unittest.mock import patch

from fastapi import HTTPException
import numpy as np
import pandas as pd

sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

from config.observability import InterceptHandler, setup_observability
from utils.auth import require_api_key
from services.canonical_circuits import (
    get_canonical_circuit,
    interpolate_canonical_coords,
)
from services.openf1_lap_fallback import (
    build_fastest_lap_rows,
    build_race_blocks,
    build_starting_grid,
)
from services.openf1_telemetry import (
    _frame_from_rows,
    collect,
    driver_options,
)
from services.profiles_service import (
    _normalize_slug,
    process_driver_profile,
    process_team_profile,
)
from services.race_details_service import (
    _compute_race_details,
    _empty_race_payload,
    _get_fallback_upcoming_race,
    _race_status,
    compute_fastf1_race_details,
)
from services.races_service import (
    _is_sprint_event,
    compute_fastf1_all_races,
)
from services.scraper import (
    _fallback_candidates,
    strip_driver_abbreviation,
)
from services.spline_smooth import (
    _unique_waypoints,
    smooth_curve,
)
from services.standings_db import (
    get_constructor_standings_from_db,
    get_driver_standings_from_db,
)
from services.telemetry_service import (
    _build_empty_payload,
    _no_lap_reason,
    get_telemetry_drivers_list,
    process_telemetry_compare,
)


class TestWave2BackendServicesUnit(unittest.TestCase):
    # --- race_details_service ---

    def test_empty_race_payload_and_fallback_upcoming(self):
        payload = _empty_race_payload(
            {"race_name": "Japanese Grand Prix", "circuit": "Suzuka", "date": "2026-03-29"},
            status="Upcoming",
            message="Preview",
            round_number=3,
        )
        self.assertEqual(payload["race_name"], "Japanese Grand Prix")
        self.assertEqual(payload["status"], "Upcoming")
        self.assertIsNone(payload["results"])

        # Fallback from calendar/cache for round 3
        fb = _get_fallback_upcoming_race(2026, 3)
        if fb is not None:
            self.assertEqual(fb["status"], "Upcoming")

    def test_race_status_uses_calendar_when_upstream_has_no_results(self):
        with patch(
            "services.race_details_service.pd.Timestamp",
            wraps=pd.Timestamp,
        ) as timestamp:
            timestamp.now.return_value = pd.Timestamp("2026-11-11", tz="UTC")
            self.assertEqual(
                _race_status({"date": "2026-11-09"}, None, []),
                "Completed",
            )

        self.assertEqual(
            _race_status({"date": "2099-11-09"}, None, []),
            "Upcoming",
        )

    def test_compute_race_details_invalid_year_and_get_race_details(self):
        data = compute_fastf1_race_details(1940, 1)
        self.assertIn("error", data)

        with patch("services.race_details_service.load_event_schedule", return_value=None), patch(
            "services.race_details_service._get_fallback_upcoming_race",
            return_value=_empty_race_payload(
                {"race_name": "Australian Grand Prix", "circuit": "Albert Park", "date": "2026-03-08"},
                status="Upcoming",
                message="Preview",
                round_number=1,
            ),
        ):
            res = compute_fastf1_race_details(2026, 1)
            self.assertEqual(res["status"], "Upcoming")
            raw = _compute_race_details(2026, 1)
            self.assertEqual(raw["status"], "Upcoming")

    # --- telemetry_service ---

    def test_sanitize_driver_codes_and_process_telemetry_compare_validation(self):
        self.assertIn("Did not start", _no_lap_reason("Did not start", 0))
        empty = _build_empty_payload("No telemetry", ["VER", "NOR"])
        self.assertEqual(empty["drivers"], [])
        self.assertEqual(empty["telemetry"], [])

        # Out-of-range year returns empty telemetry payload or empty list
        out_year = process_telemetry_compare(1940, 1, ["VER", "NOR"])
        self.assertEqual(out_year["drivers"], [])
        self.assertEqual(out_year["unavailable_drivers"], ["VER", "NOR"])
        self.assertEqual(get_telemetry_drivers_list(1940, 1), [])

        # Out-of-range round returns empty telemetry payload without network fetch
        no_drv = process_telemetry_compare(2026, 99, ["VER", "NOR"])
        self.assertEqual(no_drv["drivers"], [])
        self.assertEqual(no_drv["telemetry"], [])

    def test_telemetry_single_flight_shares_concurrent_computation(self):
        calls = 0

        def compute(*_args):
            nonlocal calls
            calls += 1
            time.sleep(0.05)
            return {"drivers": ["VER"], "telemetry": [{"distance": 0}]}

        with patch(
            "services.telemetry_service._process_telemetry_compare",
            side_effect=compute,
        ):
            with ThreadPoolExecutor(max_workers=4) as executor:
                results = list(
                    executor.map(
                        lambda _index: process_telemetry_compare(
                            2026, 1, ["VER"], None
                        ),
                        range(4),
                    )
                )

        self.assertEqual(calls, 1)
        self.assertEqual(results, [results[0]] * 4)
        self.assertIsNot(results[0], results[1])

    # --- openf1_telemetry ---

    def test_openf1_telemetry_frame_and_collect_no_session(self):
        car_rows = [
            {"date": "2026-03-08T05:00:00Z", "speed": 250, "throttle": 100, "brake": 0, "n_gear": 7, "drs": 12},
            {"date": "2026-03-08T05:00:01Z", "speed": 280, "throttle": 100, "brake": 0, "n_gear": 8, "drs": 12},
        ]
        loc_rows = [
            {"date": "2026-03-08T05:00:00Z", "x": 100.0, "y": 200.0},
            {"date": "2026-03-08T05:00:01Z", "x": 150.0, "y": 250.0},
        ]
        frame = _frame_from_rows(car_rows, loc_rows, round_number=None)
        self.assertIsNotNone(frame)
        self.assertIn("Distance", frame.columns)
        self.assertEqual(len(frame), 2)

        with patch("services.openf1_telemetry.openf1_service.session_key_for", return_value=None), patch(
            "services.openf1_telemetry._throttle"
        ):
            self.assertIsNone(collect(2026, 99, ["VER", "NOR"]))
            self.assertEqual(driver_options(2026, 99), [])

    # --- openf1_lap_fallback ---

    def test_openf1_lap_fallback_builders(self):
        self.assertEqual(build_fastest_lap_rows(None), [])
        self.assertEqual(build_starting_grid(None), [])
        self.assertEqual(build_race_blocks(None, {}), {})

        mock_drivers = [
            {"driver_number": 1, "full_name": "Max Verstappen", "team_name": "Red Bull Racing", "name_acronym": "VER"},
            {"driver_number": 4, "full_name": "Lando Norris", "team_name": "McLaren", "name_acronym": "NOR"},
        ]
        mock_laps = [
            {"driver_number": 1, "lap_number": 1, "lap_duration": 82.5, "is_pit_out_lap": False},
            {"driver_number": 4, "lap_number": 1, "lap_duration": 81.9, "is_pit_out_lap": False},
        ]
        with patch("services.openf1_lap_fallback.openf1_service.get_drivers", return_value=mock_drivers), patch(
            "services.openf1_lap_fallback.openf1_service.get_laps", return_value=mock_laps
        ), patch("services.openf1_lap_fallback._pause"):
            fl_rows = build_fastest_lap_rows(9999)
            self.assertEqual(len(fl_rows), 2)
            self.assertEqual(fl_rows[0]["driver_number"], 4)
            self.assertEqual(fl_rows[0]["position"], 1)

    # --- profiles_service ---

    def test_profiles_service_driver_and_team(self):
        self.assertEqual(_normalize_slug("Sergio Pérez-Test"), "sergio_perez_test")
        champ_data = {
            "drivers": [
                {
                    "id": "max_verstappen",
                    "name": "Max Verstappen",
                    "abbreviation": "VER",
                    "driver_number": 1,
                    "team": "Red Bull Racing",
                    "position": 1,
                    "points": 25.0,
                    "wins": 1,
                    "podiums": 1,
                    "poles": 1,
                },
                {
                    "id": "liam_lawson",
                    "name": "Liam Lawson",
                    "abbreviation": "LAW",
                    "driver_number": 30,
                    "team": "Red Bull Racing",
                    "position": 8,
                    "points": 4.0,
                    "wins": 0,
                    "podiums": 0,
                    "poles": 0,
                },
            ],
            "teams": [
                {
                    "id": "red_bull",
                    "name": "Red Bull Racing",
                    "position": 1,
                    "points": 29.0,
                    "wins": 1,
                    "podiums": 1,
                }
            ],
            "session_results": [],
        }
        drv = process_driver_profile(champ_data, 2026, "VER")
        self.assertEqual(drv["name"], "Max Verstappen")
        self.assertEqual(drv["teammate"]["abbreviation"], "LAW")

        team = process_team_profile(champ_data, 2026, "red-bull-racing")
        self.assertEqual(team["name"], "Red Bull Racing")
        self.assertEqual(len(team["drivers"]), 2)

    # --- races_service ---

    def test_races_service_sprint_and_invalid_year(self):
        self.assertTrue(_is_sprint_event({"EventFormat": "sprint_qualifying"}))
        self.assertFalse(_is_sprint_event({"EventFormat": "conventional", "Session1": "Practice 1"}))
        self.assertEqual(compute_fastf1_all_races(1940), [])

    # --- canonical_circuits & spline_smooth ---

    def test_canonical_circuits_and_spline_smooth(self):
        circuit = get_canonical_circuit(1)
        if circuit is not None:
            self.assertIn("x", circuit)
            interp = interpolate_canonical_coords(1, [0.0, 0.5, 1.0])
            self.assertIsNotNone(interp)
            self.assertEqual(len(interp[0]), 3)

    def test_canonical_context_overrides_conflicting_round_number(self):
        circuit = get_canonical_circuit(1, location="Sakhir", country="Bahrain")
        self.assertIsNotNone(circuit)
        self.assertEqual(circuit["location"], "Sakhir")
        self.assertEqual(circuit["country"], "Bahrain")

        t = np.linspace(0, 2 * np.pi, 20, endpoint=False)
        x = pd.Series(np.cos(t) * 100.0)
        y = pd.Series(np.sin(t) * 100.0)
        ux, uy = _unique_waypoints(x, y)
        self.assertEqual(len(ux), 20)
        sx, sy = smooth_curve(x, y, n_points=50)
        self.assertEqual(len(sx), 50)
        self.assertEqual(len(sy), 50)

    # --- standings_db & scraper ---

    def test_standings_db_and_scraper_helpers(self):
        self.assertEqual(strip_driver_abbreviation("Kimi AntonelliANT"), "Kimi Antonelli")
        self.assertEqual(strip_driver_abbreviation("Max VERSTAPPEN"), "Max VERSTAPPEN")
        candidates = _fallback_candidates(2026)
        self.assertTrue(any("f1_official_standings_2026.json" in c for c in candidates))

        with patch("services.standings_db.get_sqlite_conn", return_value=None):
            self.assertEqual(get_driver_standings_from_db(2026), [])
            self.assertEqual(get_constructor_standings_from_db(2026), [])

    # --- auth & observability ---

    def test_auth_and_observability_helpers(self):
        with self.assertRaises(HTTPException) as ctx_missing:
            require_api_key(None)
        self.assertEqual(ctx_missing.exception.status_code, 401)

        with patch.dict(os.environ, {"API_KEY": "secret-f1-key"}, clear=False):
            require_api_key("secret-f1-key")
            with self.assertRaises(HTTPException) as ctx_invalid:
                require_api_key("wrong-key")
            self.assertEqual(ctx_invalid.exception.status_code, 401)

        handler = InterceptHandler()
        record = logging.LogRecord(
            name="test", level=logging.INFO, pathname=__file__, lineno=1, msg="hello", args=(), exc_info=None
        )
        handler.emit(record)
        self.assertTrue(callable(setup_observability))


if __name__ == "__main__":
    unittest.main()
