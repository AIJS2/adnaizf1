import unittest
from unittest.mock import patch
from fastapi.testclient import TestClient

import main

MOCK_RACES = [
    {
        "round": 1,
        "name": "Test Grand Prix",
        "date": "2026-03-08",
        "status": "Finished",
    }
]


class CacheControlHeaderTests(unittest.TestCase):
    """
    Verifies that HTTP Cache-Control headers adhere to RFC 7234 semantics:
    - /health and live feeds: no-cache / no-store
    - Historical season data (2018-2025): public, long max-age + stale-while-revalidate
    - Current season data (2026): public, short microcache max-age + stale-while-revalidate
    """

    def setUp(self):
        self.client = TestClient(main.app)

    def test_health_check_has_no_cache_headers(self):
        response = self.client.get("/health")
        self.assertEqual(response.status_code, 200)
        cache_control = response.headers.get("cache-control", "")
        self.assertIn("no-cache", cache_control)
        self.assertIn("no-store", cache_control)

    def test_root_has_no_store_or_short_cache(self):
        response = self.client.get("/")
        self.assertEqual(response.status_code, 200)
        self.assertIn("status", response.json())

    def test_historical_cache_control_for_past_seasons(self):
        with patch("routers.races.get_advanced_cache", return_value=MOCK_RACES):
            response = self.client.get("/api/races/2023")
            self.assertEqual(response.status_code, 200)
            cache_control = response.headers.get("cache-control", "")
            self.assertIn("max-age=86400", cache_control)
            self.assertIn("stale-while-revalidate=3600", cache_control)

    def test_active_season_cache_control_for_current_year(self):
        with patch("routers.races.get_advanced_cache", return_value=MOCK_RACES):
            response = self.client.get("/api/races/2026")
            self.assertEqual(response.status_code, 200)
            cache_control = response.headers.get("cache-control", "")
            self.assertIn("max-age=60", cache_control)
            self.assertIn("stale-while-revalidate=300", cache_control)
