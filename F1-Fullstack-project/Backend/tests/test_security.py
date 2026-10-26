"""Security regression and hardening tests for the F1 Analytics backend."""

from __future__ import annotations

import os
import time
import unittest
from typing import cast
from unittest.mock import patch

os.environ["SENTRY_DSN"] = ""
os.environ["API_KEY"] = "test-api-key"
os.environ.setdefault("ENVIRONMENT", "test")

from fastapi import Request  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from starlette.websockets import WebSocketDisconnect  # noqa: E402

import main  # noqa: E402
import routers.livetiming as livetiming  # noqa: E402
from config.limiter import get_real_client_ip  # noqa: E402

RACE_DETAILS = {
    "race_info": {"name": "Test Grand Prix", "location": "Test City"},
    "status": "Completed",
    "results": [{"position": 1, "driver": "Test Driver"}],
    "fastest_lap": {"driver": "Test Driver", "time": "1:00.000"},
    "tyre_strategy": [{"driver": "Test Driver", "compound": "SOFT"}],
    "available_tabs": ["results"],
    "last_updated": "2026-03-08T15:00:00",
}

CHAMPIONSHIP = {
    "year": 2026,
    "teams": [
        {"id": "red_bull", "name": "Red Bull", "points": 100.0},
        {"id": "cadillac_f1_team", "name": "Cadillac F1 Team", "points": 0.0},
    ],
    "drivers": [
        {
            "id": "andrea_kimi_antonelli",
            "name": "Andrea Kimi Antonelli",
            "abbreviation": "ANT",
            "team": "Mercedes",
            "points": 50.0,
        },
        {
            "id": "sergio_pérez",
            "name": "Sergio Pérez",
            "abbreviation": "PER",
            "team": "Cadillac F1 Team",
            "points": 0.0,
        },
        {
            "id": "nico_hülkenberg",
            "name": "Nico Hülkenberg",
            "abbreviation": "HUL",
            "team": "Audi",
            "points": 18.0,
        },
    ],
    "session_results": [],
}


class SecurityHardeningTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.client = TestClient(main.app)

    @classmethod
    def tearDownClass(cls):
        cls.client.close()

    def test_out_of_bounds_year_returns_422(self):
        for path in (
            "/api/races/2099",
            "/api/races/1950",
            "/api/dashboard/2099",
            "/api/championship/2099",
            "/api/standings/2099",
            "/api/standings/drivers/2099",
            "/api/standings/constructors/2099",
            "/api/race/2099/1",
            "/api/telemetry/2099/1",
            "/api/telemetry-drivers/2099/1",
            "/api/driver/2099/kimi_antonelli",
            "/api/team/2099/red_bull",
        ):
            with self.subTest(path=path):
                response = self.client.get(path)
                self.assertEqual(response.status_code, 422)

    def test_out_of_bounds_round_and_lap_return_422(self):
        self.assertEqual(self.client.get("/api/race/2026/0").status_code, 422)
        self.assertEqual(self.client.get("/api/race/2026/26").status_code, 422)
        self.assertEqual(
            self.client.get("/api/telemetry/2026/99").status_code, 422
        )
        self.assertEqual(
            self.client.get(
                "/api/telemetry/2026/1?drivers=VER,NOR&lap=101"
            ).status_code,
            422,
        )
        self.assertEqual(
            self.client.get(
                "/api/telemetry/2026/1?drivers=VER,NOR&lap=0"
            ).status_code,
            422,
        )

    def test_invalid_driver_and_profile_slugs_return_422(self):
        self.assertEqual(
            self.client.get(
                "/api/telemetry/2026/1?drivers=INVALID_CODE"
            ).status_code,
            422,
        )
        self.assertEqual(
            self.client.get(
                "/api/driver/2026/bad$slug!"
            ).status_code,
            422,
        )
        self.assertEqual(
            self.client.get(
                "/api/team/2026/bad$slug!"
            ).status_code,
            422,
        )

    def test_valid_driver_and_team_slugs_succeed(self):
        with patch(
            "routers.championship.get_advanced_cache",
            return_value=CHAMPIONSHIP,
        ):
            driver_slug = self.client.get("/api/driver/2026/kimi_antonelli")
            driver_code = self.client.get("/api/driver/2026/ANT")
            perez_accent = self.client.get("/api/driver/2026/sergio_pérez")
            perez_ascii = self.client.get("/api/driver/2026/sergio_perez")
            hulk_ascii = self.client.get("/api/driver/2026/nico_hulkenberg")
            team_slug = self.client.get("/api/team/2026/red_bull")
            team_alias = self.client.get("/api/team/2026/red_bull_racing")

        self.assertEqual(driver_slug.status_code, 200)
        self.assertEqual(driver_slug.json()["name"], "Andrea Kimi Antonelli")
        self.assertEqual(driver_code.status_code, 200)
        self.assertEqual(driver_code.json()["abbreviation"], "ANT")
        self.assertEqual(perez_accent.status_code, 200)
        self.assertEqual(perez_accent.json()["name"], "Sergio Pérez")
        self.assertEqual(perez_ascii.status_code, 200)
        self.assertEqual(perez_ascii.json()["name"], "Sergio Pérez")
        self.assertEqual(hulk_ascii.status_code, 200)
        self.assertEqual(hulk_ascii.json()["name"], "Nico Hülkenberg")
        self.assertEqual(team_slug.status_code, 200)
        self.assertEqual(team_slug.json()["name"], "Red Bull")
        self.assertEqual(team_alias.status_code, 200)
        self.assertEqual(team_alias.json()["name"], "Red Bull")

    def test_race_details_refresh_requires_valid_api_key(self):
        with patch(
            "routers.race_details.get_advanced_cache_with_meta",
            return_value={"data": RACE_DETAILS, "mtime": time.time()},
        ), patch("routers.race_details._run_background_revalidation"):
            public_resp = self.client.get("/api/race/2026/1")
            self.assertEqual(public_resp.status_code, 200)
            self.assertEqual(public_resp.json()["_cache_state"], "fresh")

            no_key_resp = self.client.get("/api/race/2026/1?refresh=true")
            self.assertEqual(no_key_resp.status_code, 401)
            self.assertEqual(no_key_resp.json(), {"error": "Invalid API Key"})

            wrong_key_resp = self.client.get(
                "/api/race/2026/1?refresh=true",
                headers={"X-API-Key": "wrong-key"},
            )
            self.assertEqual(wrong_key_resp.status_code, 401)

            valid_key_resp = self.client.get(
                "/api/race/2026/1?refresh=true",
                headers={"X-API-Key": "test-api-key"},
            )
            self.assertEqual(valid_key_resp.status_code, 200)
            self.assertEqual(
                valid_key_resp.json()["_cache_state"], "revalidating"
            )

    def test_security_headers_and_csp_directives_present(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            response.headers.get("x-content-type-options"), "nosniff"
        )
        self.assertEqual(response.headers.get("x-frame-options"), "DENY")
        self.assertEqual(
            response.headers.get("referrer-policy"),
            "strict-origin-when-cross-origin",
        )
        self.assertEqual(
            response.headers.get("permissions-policy"),
            "geolocation=(), microphone=(), camera=()",
        )
        csp = response.headers.get("content-security-policy", "")
        self.assertIn(
            "media-src 'self' https://livetiming.formula1.com https: data: blob:;",
            csp,
        )
        self.assertIn("connect-src 'self' ws: wss: http: https:;", csp)
        self.assertIn("img-src 'self' data: blob: https:;", csp)
        self.assertIn(
            "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;",
            csp,
        )

    def test_rate_limiter_extracts_real_ip_and_forwarded_for(self):
        class DummyClient:
            host = "127.0.0.1"

        class DummyRequest:
            def __init__(self, headers: dict[str, str]):
                self.headers = headers
                self.client = DummyClient()

        def make_req(headers: dict[str, str]) -> Request:
            return cast(Request, DummyRequest(headers))

        self.assertEqual(
            get_real_client_ip(make_req({"X-Real-IP": "203.0.113.10"})),
            "203.0.113.10",
        )
        self.assertEqual(
            get_real_client_ip(
                make_req(
                    {"X-Forwarded-For": "198.51.100.7, 10.0.0.1"}
                )
            ),
            "198.51.100.7",
        )
        self.assertEqual(
            get_real_client_ip(make_req({})),
            "127.0.0.1",
        )

    def test_websocket_connection_limit_and_origin_validation(self):
        # 1. Rejects when MAX_WS_CLIENTS is reached with 1013 Try Again Later
        sentinel_clients = {object() for _ in range(livetiming.MAX_WS_CLIENTS)}
        with patch.object(
            livetiming, "_connected_clients", set(sentinel_clients)
        ):
            with self.assertRaises(WebSocketDisconnect) as ctx:
                with self.client.websocket_connect("/ws/livetiming") as ws:
                    ws.receive_json()
            self.assertEqual(ctx.exception.code, 1013)

        # 2. Rejects untrusted Origin with 1008
        with self.assertRaises(WebSocketDisconnect) as ctx:
            with self.client.websocket_connect(
                "/ws/livetiming",
                headers={"Origin": "https://evil.example.com"},
            ) as ws:
                ws.receive_json()
        self.assertEqual(ctx.exception.code, 1008)

        # 3. Allows localhost:5173 Origin
        with patch("routers.livetiming._check_live_session", return_value=False):
            with self.client.websocket_connect(
                "/ws/livetiming",
                headers={"Origin": "http://localhost:5173"},
            ) as ws:
                payload = ws.receive_json()
        self.assertEqual(payload["status"], "no_session")


if __name__ == "__main__":
    unittest.main()
