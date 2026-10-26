"""Contract tests for the live-timing feed and OpenF1 paywall handling.

These run offline: SignalR is never started, OpenF1 HTTP calls are faked, and
the WebSocket broadcast loop is replaced with a deterministic one-shot sender.
"""

from __future__ import annotations

import os
import time
import unittest
from unittest.mock import patch

import httpx

os.environ["SENTRY_DSN"] = ""
os.environ["API_KEY"] = "test-api-key"
os.environ.setdefault("ENVIRONMENT", "test")

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402
import routers.livetiming as livetiming  # noqa: E402
from services import circuit_map_service, openf1_service  # noqa: E402
from services.livetiming_service import (  # noqa: E402
    LiveTimingState,
    clear_radio_cache,
    get_cached_radio,
)

SESSION_PATH = (
    "2026/2026-10-25_United_States_Grand_Prix/2026-10-25_Race"
)
RADIO_PATH = "TeamRadio/NOR_1_20261025_161122.mp3"


class LiveTimingStateTests(unittest.TestCase):
    def test_snapshot_parses_real_signalr_shapes(self):
        state = LiveTimingState()
        state.update(
            "SessionInfo",
            {
                "Key": 9999,
                "Path": SESSION_PATH,
                "Meeting": {"Key": 1234},
            },
        )
        state.update(
            "DriverList",
            {
                "1": {
                    "RacingNumber": "1",
                    "Tla": "NOR",
                    "TeamName": "McLaren",
                    "_kf": True,
                },
                "_kf": True,
            },
        )
        state.update(
            "TimingData",
            {
                "Lines": {
                    "1": {
                        "Position": "1",
                        "GapToLeader": "LAP 5",
                        "IntervalToPositionAhead": {"Value": ""},
                        "LastLapTime": {
                            "Value": "1:30.000",
                            "OverallFastest": True,
                        },
                        "Sectors": [
                            {"Value": "30.000", "PersonalFastest": True},
                            {"Value": "30.100"},
                            {"Value": "29.900", "OverallFastest": True},
                        ],
                        "NumberOfPitStops": "0",
                        "InPit": False,
                    }
                }
            },
        )
        state.update(
            "TimingAppData",
            {
                "Lines": {
                    "1": {
                        "Stints": [
                            {"Compound": "2", "TotalLaps": 5},
                        ]
                    }
                }
            },
        )
        state.update(
            "WeatherData",
            {
                "AirTemp": "25.0",
                "TrackTemp": "30.0",
                "Humidity": "40.0",
                "Rainfall": "0",
            },
        )
        state.update("TrackStatus", {"Status": "1"})
        state.update(
            "RaceControlMessages",
            {
                "Messages": [
                    {
                        "Utc": "20:00:00",
                        "Category": "Flag",
                        "Message": "GREEN LIGHT",
                    }
                ]
            },
        )
        state.update(
            "TeamRadio",
            {
                "Captures": [
                    {
                        "Utc": "2026-10-25T16:11:22Z",
                        "RacingNumber": "1",
                        "Path": RADIO_PATH,
                    }
                ]
            },
        )

        snapshot = state.snapshot()

        self.assertEqual(snapshot["type"], "TimingData")
        self.assertTrue(snapshot["is_live_session"])
        self.assertEqual(len(snapshot["lines"]), 1)
        line = snapshot["lines"][0]
        self.assertEqual(line["driver"], "NOR")
        self.assertEqual(line["team"], "McLaren")
        self.assertEqual(line["position"], 1)
        self.assertEqual(line["gap"], "LEADER")
        self.assertEqual(line["interval"], "-")
        self.assertEqual(line["lastLap"], "1:30.000")
        self.assertEqual(line["sector1"], "30.000")
        self.assertEqual(line["s1_color"], "green")
        self.assertEqual(line["s2_color"], "yellow")
        self.assertEqual(line["s3_color"], "purple")
        self.assertEqual(line["lap_color"], "purple")
        self.assertEqual(line["tyre"], "M")
        self.assertEqual(line["tyre_age"], 5)
        self.assertEqual(line["pits"], 0)
        self.assertEqual(snapshot["weather"]["air"], "25.0°C")
        self.assertEqual(snapshot["messages"][0]["msg"], "GREEN LIGHT")
        self.assertEqual(len(snapshot["radio"]), 1)
        self.assertEqual(snapshot["radio"][0]["driver_number"], 1)
        self.assertTrue(
            snapshot["radio"][0]["recording_url"].endswith(
                f"{SESSION_PATH}/{RADIO_PATH}"
            )
        )

    def test_reset_drops_previous_session_data(self):
        state = LiveTimingState()
        state.update("DriverList", {"1": {"Tla": "NOR"}})
        state.update("TimingData", {"Lines": {"1": {"Position": "1"}}})
        state.reset()

        snapshot = state.snapshot()
        self.assertFalse(snapshot["is_live_session"])
        self.assertEqual(snapshot["lines"], [])
        self.assertEqual(snapshot["radio"], [])


class LiveTimingStatusTests(unittest.TestCase):
    def test_empty_snapshot_distinguishes_no_session_from_paywall(self):
        no_session = livetiming._empty_snapshot(livetiming.STATUS_NO_SESSION)
        unavailable = livetiming._empty_snapshot(
            livetiming.STATUS_UNAVAILABLE, "auth"
        )

        self.assertEqual(no_session["status"], "no_session")
        self.assertNotIn("reason", no_session)
        self.assertEqual(unavailable["status"], "unavailable_subscription")
        self.assertEqual(unavailable["reason"], "auth")
        self.assertEqual(unavailable["lines"], [])
        self.assertEqual(unavailable["radio"], [])

    def test_websocket_reports_unavailable_when_signalr_has_no_data(self):
        async def one_shot_broadcast(initial_status):
            payload = livetiming._empty_snapshot(initial_status, "no_data")
            for websocket in list(livetiming._connected_clients):
                await websocket.send_json(payload)

        livetiming._connected_clients.clear()
        livetiming._broadcast_task = None

        with (
            patch("routers.livetiming._check_live_session", return_value=True),
            patch("routers.livetiming._ensure_signalr"),
            patch("routers.livetiming._LIVE_DATA_WAIT_SECONDS", 0.0),
            patch("routers.livetiming._broadcast_loop", one_shot_broadcast),
        ):
            with TestClient(main.app).websocket_connect(
                "/ws/livetiming"
            ) as websocket:
                payload = websocket.receive_json()

        self.assertEqual(payload["type"], "TimingData")
        self.assertEqual(payload["status"], "unavailable_subscription")
        self.assertFalse(payload["is_live_session"])
        self.assertEqual(payload["lines"], [])
        self.assertEqual(payload["radio"], [])


class FinishedSessionTests(unittest.TestCase):
    def _seed_finished_race(self, state: LiveTimingState) -> None:
        state.update(
            "SessionInfo",
            {
                "Key": 11396,
                "Name": "Race",
                "Type": "Race",
                "Path": SESSION_PATH,
                "SessionStatus": "Finalised",
                "ArchiveStatus": {"Status": "Complete"},
                "Meeting": {
                    "Key": 1297,
                    "Name": "United States Grand Prix",
                    "Location": "Austin",
                    "Country": {"Code": "USA", "Name": "United States"},
                    "Circuit": {"Key": 9, "ShortName": "Austin"},
                },
            },
        )
        state.update("SessionStatus", {"Status": "Ends", "Started": "Finished"})
        state.update(
            "TimingData",
            {
                "Lines": {
                    "1": {
                        "Position": "1",
                        "GapToLeader": "LAP 56",
                        "LastLapTime": {"Value": "1:38.000"},
                    },
                    "4": {
                        "Position": "2",
                        "GapToLeader": "+12.345",
                        "LastLapTime": {"Value": "1:38.500"},
                    },
                }
            },
        )
        state.update("LapCount", {"CurrentLap": 56, "TotalLaps": 56})
        # A stint's own lap count must not overwrite the session distance.
        state.update(
            "TimingAppData",
            {"Lines": {"1": {"Stints": [{"Compound": "2", "TotalLaps": 14}]}}},
        )

    def test_snapshot_reports_finished_session_circuit_and_progress(self):
        state = LiveTimingState()
        self._seed_finished_race(state)

        snapshot = state.snapshot()

        self.assertEqual(snapshot["session_state"], "finished")
        self.assertEqual(
            snapshot["session_title"], "United States Grand Prix — Race"
        )
        self.assertEqual(snapshot["session_status"], "Ends")
        self.assertEqual(snapshot["archive_status"], "Complete")
        self.assertEqual(snapshot["lap"], 56)
        self.assertEqual(snapshot["total_laps"], 56)

        circuit = snapshot["circuit"]
        self.assertIsNotNone(circuit)
        self.assertEqual(circuit["key"], "austin")
        self.assertEqual(circuit["name"], "Circuit of the Americas")
        self.assertTrue(circuit["path"].startswith("M"))
        self.assertEqual(circuit["viewBox"], "0 0 500 500")

        leader, second = snapshot["lines"]
        self.assertEqual(leader["progress"], 0.0)
        self.assertGreater(second["progress"], 0.0)
        self.assertLess(second["progress"], 1.0)
        self.assertAlmostEqual(second["gap_seconds"], 12.345, places=3)
        self.assertNotEqual(leader["progress"], second["progress"])

    def test_chequered_flag_marks_the_session_finished(self):
        state = LiveTimingState()
        state.update(
            "SessionInfo",
            {
                "Name": "Race",
                "Meeting": {
                    "Name": "United States Grand Prix",
                    "Location": "Austin",
                    "Circuit": {"ShortName": "Austin"},
                },
            },
        )
        state.update(
            "TimingData",
            {"Lines": {"1": {"Position": "1", "GapToLeader": "LAP 56"}}},
        )
        state.update(
            "RaceControlMessages",
            {
                "Messages": [
                    {
                        "Utc": "21:30:00",
                        "Category": "Flag",
                        "Message": "CHEQUERED FLAG",
                    }
                ]
            },
        )

        snapshot = state.snapshot()

        self.assertEqual(snapshot["session_state"], "finished")
        self.assertEqual(snapshot["messages"][0]["msg"], "CHEQUERED FLAG")

    def test_started_session_stays_live(self):
        state = LiveTimingState()
        state.update(
            "SessionInfo",
            {
                "Name": "Race",
                "SessionStatus": "Started",
                "Meeting": {
                    "Name": "United States Grand Prix",
                    "Location": "Austin",
                    "Circuit": {"ShortName": "Austin"},
                },
            },
        )
        state.update("SessionStatus", {"Status": "Started"})
        state.update(
            "TimingData",
            {"Lines": {"1": {"Position": "1", "GapToLeader": "LAP 5"}}},
        )

        self.assertEqual(state.snapshot()["session_state"], "live")


class CircuitMapTests(unittest.TestCase):
    def test_resolves_austin_from_signalr_session_info(self):
        circuit = circuit_map_service.resolve_circuit(
            {
                "Meeting": {
                    "Name": "United States Grand Prix",
                    "Location": "Austin",
                    "Circuit": {"ShortName": "Austin"},
                }
            }
        )

        self.assertIsNotNone(circuit)
        self.assertEqual(circuit["key"], "austin")
        self.assertEqual(circuit["name"], "Circuit of the Americas")

    def test_resolves_melbourne_and_marina_bay(self):
        melbourne = circuit_map_service.resolve_circuit(
            {
                "Meeting": {
                    "Name": "Australian Grand Prix",
                    "Location": "Melbourne",
                    "Circuit": {"ShortName": "Melbourne"},
                }
            }
        )
        marina_bay = circuit_map_service.resolve_circuit(
            {
                "Meeting": {
                    "Name": "Singapore Grand Prix",
                    "Location": "Marina Bay",
                    "Circuit": {"ShortName": "Marina Bay"},
                }
            }
        )

        self.assertEqual(melbourne["key"], "melbourne")
        self.assertEqual(marina_bay["key"], "marina-bay")

    def test_unknown_circuit_returns_none_instead_of_fake_oval(self):
        self.assertIsNone(
            circuit_map_service.resolve_circuit(
                {"Meeting": {"Name": "Unknown Grand Prix", "Location": "Nowhere"}}
            )
        )


class TeamRadioFallbackTests(unittest.TestCase):
    def setUp(self):
        openf1_service.clear_paywall()
        clear_radio_cache()

    def tearDown(self):
        openf1_service.clear_paywall()
        clear_radio_cache()

    def _seed_radio(self) -> None:
        state = LiveTimingState()
        state.update(
            "SessionInfo",
            {
                "Key": 11396,
                "Name": "Race",
                "Path": SESSION_PATH,
                "Meeting": {
                    "Name": "United States Grand Prix",
                    "Location": "Austin",
                    "Circuit": {"ShortName": "Austin"},
                },
            },
        )
        state.update(
            "TeamRadio",
            {
                "Captures": [
                    {
                        "Utc": "2026-10-25T16:11:22Z",
                        "RacingNumber": "1",
                        "Path": RADIO_PATH,
                    }
                ]
            },
        )
        state.snapshot()

    def test_snapshot_publishes_playable_signalr_radio_cache(self):
        self._seed_radio()

        cached = get_cached_radio()

        self.assertEqual(cached["session_title"], "United States Grand Prix — Race")
        self.assertEqual(len(cached["data"]), 1)
        self.assertTrue(cached["data"][0]["recording_url"].endswith(RADIO_PATH))

    def test_previous_tab_falls_back_to_signalr_during_paywall(self):
        self._seed_radio()

        with patch(
            "services.openf1_service.paywall_active", return_value=True
        ):
            response = TestClient(main.app).get(
                "/api/team_radio?session_key=previous"
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "success")
        self.assertEqual(payload["source"], "signalr_cache")
        self.assertTrue(payload["fallback"])
        self.assertEqual(len(payload["data"]), 1)
        self.assertTrue(payload["data"][0]["recording_url"].endswith(RADIO_PATH))

    def test_previous_tab_falls_back_when_openf1_times_out(self):
        self._seed_radio()

        with (
            patch(
                "services.openf1_service.paywall_active", return_value=False
            ),
            patch(
                "routers.team_radio._fetch_openf1",
                side_effect=httpx.ConnectTimeout("OpenF1 timed out"),
            ),
        ):
            response = TestClient(main.app).get(
                "/api/team_radio?session_key=previous"
            )

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "success")
        self.assertEqual(payload["source"], "signalr_cache")
        self.assertEqual(len(payload["data"]), 1)

    def test_team_radio_timeout_is_at_most_four_seconds(self):
        from routers import team_radio

        self.assertLessEqual(team_radio.OPENF1_TIMEOUT_SECONDS, 4.0)


class OpenF1PaywallTests(unittest.TestCase):
    def setUp(self):
        openf1_service.clear_paywall()
        clear_radio_cache()

    def tearDown(self):
        openf1_service.clear_paywall()
        clear_radio_cache()

    def test_note_paywall_logs_only_first_failure_in_streak(self):
        with self.assertLogs("services.openf1_service", level="WARNING") as logs:
            first = openf1_service.note_paywall(
                401, '{"detail": "live session paywall"}'
            )
            second = openf1_service.note_paywall(
                401, '{"detail": "live session paywall"}'
            )

        self.assertTrue(first)
        self.assertFalse(second)
        self.assertEqual(len(logs.output), 1)
        self.assertTrue(openf1_service.paywall_active())
        self.assertIn("live session paywall", openf1_service.paywall_detail())

    def test_note_paywall_without_a_body_still_logs_once(self):
        with self.assertLogs("services.openf1_service", level="WARNING") as logs:
            first = openf1_service.note_paywall(401)
            second = openf1_service.note_paywall(401)

        self.assertTrue(first)
        self.assertFalse(second)
        self.assertEqual(len(logs.output), 1)
        self.assertEqual(openf1_service.paywall_detail(), "HTTP 401")

    def test_get_short_circuits_while_paywall_is_cached(self):
        response = httpx.Response(
            401,
            json={"detail": "Live F1 session in progress."},
            request=httpx.Request("GET", "https://api.openf1.org/v1/sessions"),
        )

        class FakeClient:
            def __init__(self):
                self.calls = 0

            def get(self, path, params=None):
                self.calls += 1
                return response

        fake = FakeClient()
        with patch("services.openf1_service._get_client", return_value=fake):
            first = openf1_service._get("/sessions", params={"year": 2026})
            second = openf1_service._get("/sessions", params={"year": 2026})

        self.assertIsNone(first)
        self.assertIsNone(second)
        self.assertEqual(fake.calls, 1)
        self.assertTrue(openf1_service.paywall_active())

    def test_team_radio_returns_unavailable_subscription_during_paywall(self):
        with patch(
            "services.openf1_service.paywall_active", return_value=True
        ):
            response = TestClient(main.app).get("/api/team_radio")

        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertEqual(payload["status"], "unavailable_subscription")
        self.assertEqual(payload["data"], [])
        self.assertIn("paid", payload["warning"].lower())


class ScheduleGateTests(unittest.TestCase):
    def test_cold_schedule_does_not_block_the_first_frame(self):
        """A slow FastF1 load must not stall the WebSocket handshake."""
        with (
            patch.object(livetiming, "_schedule_cache", None),
            patch.object(livetiming, "_schedule_loading", False),
            patch.object(livetiming, "_get_cached_schedule") as get_schedule,
            patch("routers.livetiming.threading.Thread") as thread_cls,
        ):
            started = time.monotonic()
            is_live = livetiming._check_live_session()
            elapsed = time.monotonic() - started

        self.assertTrue(is_live)
        self.assertLess(elapsed, 1.0)
        get_schedule.assert_not_called()
        thread_cls.return_value.start.assert_called_once()


if __name__ == "__main__":
    unittest.main()
