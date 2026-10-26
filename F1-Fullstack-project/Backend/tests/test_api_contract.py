import os
import time
import unittest
from unittest.mock import patch

# Configure the process before importing the app (dotenv does not override
# already-set environment variables).
os.environ["SENTRY_DSN"] = ""
os.environ["API_KEY"] = "test-api-key"
os.environ.setdefault("ENVIRONMENT", "test")

from fastapi.testclient import TestClient  # noqa: E402

import main  # noqa: E402

DASHBOARD = {
    "year": 2026,
    "last_race_name": "Test Grand Prix",
    "team_standings": [{"name": "Test Team", "points": 100.0}],
    "driver_standings": [{"name": "Test Driver", "points": 50.0}],
    "race_analytics": [],
    "next_race_event": None,
}

RACES = [
    {
        "round": 1,
        "name": "Test Grand Prix",
        "location": "Test City",
        "country": "Testland",
        "date": "2026-03-08",
        "status": "Finished",
    }
]

CHAMPIONSHIP = {
    "year": 2026,
    "teams": [{"name": "Test Team", "points": 100.0}],
    "drivers": [{"name": "Test Driver", "points": 50.0}],
    "session_results": [],
}

RACE_DETAILS = {
    "race_info": {"name": "Test Grand Prix", "location": "Test City"},
    "status": "Completed",
    "results": [{"position": 1, "driver": "Test Driver"}],
    "fastest_lap": {"driver": "Test Driver", "time": "1:00.000"},
    "tyre_strategy": [{"driver": "Test Driver", "compound": "SOFT"}],
    "available_tabs": ["results"],
    "last_updated": "2026-03-08T15:00:00",
}


class ApiContractTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()

    def test_health_contract(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        payload = response.json()
        self.assertIn(payload["status"], {"ok", "degraded"})
        self.assertIsInstance(payload["cache"], dict)

    def test_openapi_contains_core_routes(self):
        response = self.client.get("/openapi.json")
        self.assertEqual(response.status_code, 200)
        paths = set(response.json()["paths"])
        self.assertTrue(
            {
                "/health",
                "/api/dashboard/{year}",
                "/api/races/{year}",
                "/api/championship/{year}",
                "/api/race/{year}/{round_number}",
            }.issubset(paths)
        )

    def test_core_endpoints_serve_cached_payloads(self):
        with (
            patch("routers.dashboard.get_advanced_cache", return_value=DASHBOARD),
            patch("routers.races.get_advanced_cache", return_value=RACES),
            patch("routers.championship.get_advanced_cache", return_value=CHAMPIONSHIP),
            patch(
                "routers.race_details.get_advanced_cache_with_meta",
                return_value={"data": RACE_DETAILS, "mtime": time.time()},
            ),
        ):
            dashboard = self.client.get("/api/dashboard/2026")
            races = self.client.get("/api/races/2026")
            championship = self.client.get("/api/championship/2026")
            race_details = self.client.get("/api/race/2026/17")

        self.assertEqual(dashboard.status_code, 200)
        self.assertEqual(dashboard.json()["last_race_name"], "Test Grand Prix")
        self.assertEqual(races.status_code, 200)
        self.assertEqual(races.json()[0]["round"], 1)
        self.assertEqual(championship.status_code, 200)
        self.assertEqual(championship.json()["year"], 2026)
        self.assertEqual(race_details.status_code, 200)
        self.assertEqual(race_details.json()["_cache_state"], "fresh")
        self.assertEqual(race_details.json()["race_info"]["name"], "Test Grand Prix")

    def test_cors_preflight_allows_frontend_origin(self):
        response = self.client.options(
            "/api/races/2026",
            headers={
                "Origin": "http://localhost:5173",
                "Access-Control-Request-Method": "GET",
            },
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("access-control-allow-origin"),
            "http://localhost:5173",
        )

    def test_unknown_route_returns_json_envelope(self):
        response = self.client.get("/api/does-not-exist")
        self.assertEqual(response.status_code, 404)
        self.assertEqual(response.json(), {"error": "Not Found"})

    def test_clear_cache_requires_valid_api_key(self):
        missing = self.client.get("/api/clear_cache/2026")
        self.assertEqual(missing.status_code, 422)

        wrong = self.client.get(
            "/api/clear_cache/2026", headers={"X-API-Key": "wrong-key"}
        )
        self.assertEqual(wrong.status_code, 401)
        self.assertEqual(wrong.json(), {"error": "Invalid API Key"})

    def test_clear_cache_with_valid_api_key(self):
        with patch("routers.system.clear_advanced_cache") as clear_cache:
            response = self.client.get(
                "/api/clear_cache/2026", headers={"X-API-Key": "test-api-key"}
            )
        self.assertEqual(response.status_code, 200)
        clear_cache.assert_called_once()
        keys = clear_cache.call_args.args[0]
        self.assertIn("dashboard_cache_2026.json", keys)
        self.assertIn("championship_cache_2026.json", keys)
        self.assertIn("all_races_cache_2026.json", keys)
        self.assertIn("race_detail_cache_2026_1.json", keys)
        self.assertIn("race_detail_cache_2026_24.json", keys)

    def test_live_timing_websocket_idle_snapshot(self):
        with patch("routers.livetiming._check_live_session", return_value=False):
            with self.client.websocket_connect("/ws/livetiming") as websocket:
                payload = websocket.receive_json()
        self.assertEqual(payload["type"], "TimingData")
        self.assertEqual(payload["status"], "no_session")
        self.assertFalse(payload["is_live_session"])
        self.assertEqual(payload["lines"], [])
        self.assertEqual(payload["radio"], [])


if __name__ == "__main__":
    unittest.main()
