"""Direct unit tests for Backend services refactored during Graphify audit.

Covers:
- services.signalr_parsers (stateless SignalR payload parsers & normalisers)
- services.fastf1_safe (build_empty_season, clean_nans, is_valid_year, safe_getattr)
- services.championship_service (_empty_season, is_dns_status, is_dnf_classified, compute_fastf1_championship)
- services.dashboard_service (_empty_season, _find_next_session, compute_fastf1_dashboard)
"""

from __future__ import annotations

import os
import unittest
from unittest.mock import patch

import pandas as pd

os.environ["SENTRY_DSN"] = ""
os.environ["API_KEY"] = "test-api-key"
os.environ.setdefault("ENVIRONMENT", "test")

from services import championship_service, dashboard_service  # noqa: E402
from services.fastf1_safe import (  # noqa: E402
    build_empty_season,
    clean_nans,
    has_rows,
    is_valid_year,
    safe_getattr,
)
from services.signalr_parsers import (  # noqa: E402
    AVERAGE_LAP_SECONDS,
    build_radio_entries,
    classify_rc_msg,
    deep_merge,
    extract_driver_sectors,
    extract_driver_stints,
    format_weather,
    parse_compound,
    parse_gap_seconds,
    resolve_track_status,
    segment_color,
    to_int,
)


class SignalrParsersTests(unittest.TestCase):
    def test_parse_compound_handles_ints_digits_and_strings(self):
        self.assertEqual(parse_compound(1), "S")
        self.assertEqual(parse_compound("2"), "M")
        self.assertEqual(parse_compound("HARD"), "H")
        self.assertEqual(parse_compound(None), "M")
        self.assertEqual(parse_compound(""), "M")

    def test_deep_merge_recursively_merges_dicts_and_ignores_non_dicts(self):
        base = {"a": {"x": 1, "y": 2}, "b": 10}
        deep_merge(base, {"a": {"y": 99, "z": 3}, "c": 4})
        self.assertEqual(base, {"a": {"x": 1, "y": 99, "z": 3}, "b": 10, "c": 4})
        self.assertEqual(deep_merge(base, True), base)  # type: ignore[arg-type]

        # SignalR initial snapshot sends Stints as a list, then deltas as a dict
        stint_state: dict = {
            "Stints": [
                {"Compound": "INTERMEDIATE", "TotalLaps": 28},
                {"Compound": "INTERMEDIATE", "TotalLaps": 37},
            ]
        }
        deep_merge(stint_state, {"Stints": {"1": {"TotalLaps": 38}}})
        compound, age, stints_list, count = extract_driver_stints(stint_state)
        self.assertEqual(compound, "I")
        self.assertEqual(age, 38)
        self.assertEqual(count, 2)
        self.assertEqual(
            stints_list,
            [{"tyre": "I", "laps": 28}, {"tyre": "I", "laps": 38}],
        )

    def test_classify_rc_msg_detects_flag_pit_and_system(self):
        self.assertEqual(classify_rc_msg({"Category": "Flag", "Message": "YELLOW"}), "flag")
        self.assertEqual(classify_rc_msg({"Category": "Other", "Message": "RED FLAG"}), "flag")
        self.assertEqual(classify_rc_msg({"Category": "Other", "Message": "PIT LANE OPEN"}), "pit")
        self.assertEqual(classify_rc_msg({"Category": "Drs", "Message": "DRS ENABLED"}), "system")

    def test_parse_gap_seconds_handles_leaders_laps_and_numeric_gaps(self):
        self.assertIsNone(parse_gap_seconds(None))
        self.assertIsNone(parse_gap_seconds("LEADER"))
        self.assertIsNone(parse_gap_seconds("LAP 42"))
        self.assertAlmostEqual(parse_gap_seconds("+3.456") or 0.0, 3.456)
        self.assertAlmostEqual(parse_gap_seconds("2 LAPS") or 0.0, 2 * AVERAGE_LAP_SECONDS)
        self.assertAlmostEqual(parse_gap_seconds("1L") or 0.0, 1 * AVERAGE_LAP_SECONDS)
        self.assertAlmostEqual(parse_gap_seconds("2L") or 0.0, 2 * AVERAGE_LAP_SECONDS)

    def test_segment_color_and_track_status_mapping(self):
        self.assertEqual(segment_color({"OverallFastest": True}), "purple")
        self.assertEqual(segment_color({"PersonalFastest": True}), "green")
        self.assertEqual(segment_color({"Value": "30.1"}), "yellow")
        self.assertEqual(resolve_track_status({"Status": "4"}), "SC")
        self.assertEqual(resolve_track_status({"Status": "99", "Message": "CLEAR"}), "CLEAR")

    def test_extract_driver_sectors_and_stints_support_dict_and_list_shapes(self):
        s0, s1, s2 = extract_driver_sectors(
            {"Sectors": {"0": {"Value": "28.1"}, "2": {"Value": "31.0"}}}
        )
        self.assertEqual(s0.get("Value"), "28.1")
        self.assertEqual(s1, {})
        self.assertEqual(s2.get("Value"), "31.0")

        compound, age, stints_list, count = extract_driver_stints(
            {
                "Stints": {
                    "1": {"Compound": "3", "TotalLaps": "14"},
                    "0": {"Compound": 1, "TotalLaps": 8},
                }
            }
        )
        self.assertEqual(compound, "H")
        self.assertEqual(age, 14)
        self.assertEqual(count, 2)
        self.assertEqual(
            stints_list,
            [{"tyre": "S", "laps": 8}, {"tyre": "H", "laps": 14}],
        )

    def test_format_weather_and_build_radio_entries(self):
        weather = format_weather({"AirTemp": "22.5", "TrackTemp": "34.1"})
        self.assertEqual(weather["air"], "22.5°C")
        self.assertEqual(weather["humidity"], "--%")
        self.assertEqual(weather["rain"], "0%")

        path, skey, mkey, radio = build_radio_entries(
            [{"Utc": "2026-05-01T14:00:00Z", "RacingNumber": "4", "Path": "TeamRadio/NOR.mp3"}],
            {"Key": 100, "Path": "2026/Miami/Race", "Meeting": {"Key": 50}},
        )
        self.assertEqual(path, "2026/Miami/Race")
        self.assertEqual(skey, 100)
        self.assertEqual(mkey, 50)
        self.assertEqual(len(radio), 1)
        self.assertEqual(radio[0]["driver_number"], 4)
        self.assertEqual(
            radio[0]["recording_url"],
            "https://livetiming.formula1.com/static/2026/Miami/Race/TeamRadio/NOR.mp3",
        )
        self.assertEqual(to_int("44"), 44)
        self.assertIsNone(to_int("invalid"))


class Fastf1SafeAndSeasonServicesTests(unittest.TestCase):
    def test_build_empty_season_and_clean_nans_shared_helpers(self):
        env = build_empty_season(2026, "No data yet", teams=[], drivers=[])
        self.assertEqual(
            env,
            {
                "year": 2026,
                "status": "pre_season",
                "message": "No data yet",
                "teams": [],
                "drivers": [],
            },
        )
        dirty = {"a": float("nan"), "b": [1, pd.NA, {"c": pd.NaT, "d": "ok"}]}
        self.assertEqual(clean_nans(dirty), {"a": None, "b": [1, None, {"c": None, "d": "ok"}]})
        self.assertTrue(is_valid_year(2026))
        self.assertFalse(is_valid_year(True))
        self.assertFalse(is_valid_year(1940))

    def test_championship_service_predicates_and_pre_season_fallback(self):
        self.assertTrue(championship_service.is_dns_status("Did not start"))
        self.assertFalse(championship_service.is_dnf_classified("R", "Did not start"))
        self.assertTrue(championship_service.is_dnf_classified("R", "Engine"))

        invalid_year_resp = championship_service.compute_fastf1_championship(1900)
        self.assertEqual(invalid_year_resp["status"], "pre_season")
        self.assertEqual(invalid_year_resp["drivers"], [])

        with patch("services.championship_service.load_event_schedule", return_value=None):
            no_sched_resp = championship_service.compute_fastf1_championship(2026)
        self.assertEqual(no_sched_resp["status"], "pre_season")
        self.assertEqual(no_sched_resp["teams"], [])

    def test_dashboard_service_next_session_and_pre_season_fallback(self):
        invalid_dash = dashboard_service.compute_fastf1_dashboard(1899)
        self.assertEqual(invalid_dash["status"], "pre_season")
        self.assertEqual(invalid_dash["total_races"], 0)

        schedule = pd.DataFrame(
            [
                {
                    "RoundNumber": 1,
                    "EventName": "Australian Grand Prix",
                    "Location": "Melbourne",
                    "Country": "Australia",
                    "EventDate": pd.Timestamp("2026-03-15"),
                    "Session1": "Practice 1",
                    "Session1DateUtc": pd.Timestamp("2026-03-13T01:30:00Z"),
                    "Session5": "Race",
                    "Session5DateUtc": pd.Timestamp("2026-03-15T04:00:00Z"),
                }
            ]
        )
        next_sess = dashboard_service._find_next_session(
            schedule, pd.Timestamp("2026-03-14T00:00:00Z")
        )
        self.assertIsNotNone(next_sess)
        assert next_sess is not None
        self.assertEqual(next_sess["name"], "Australian Grand Prix - Race")
        self.assertEqual(next_sess["round"], 1)
        self.assertIsNone(safe_getattr(object(), "missing_attr"))


if __name__ == "__main__":
    unittest.main()
