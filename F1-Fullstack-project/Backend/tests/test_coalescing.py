import asyncio
import unittest
from unittest.mock import patch

from config.cache import fetch_with_coalescing


class SingleFlightCoalescingTests(unittest.IsolatedAsyncioTestCase):
    """
    Verifies that fetch_with_coalescing coalesces concurrent requests
    for the exact same cache key into a single underlying fetch execution.
    """

    async def test_concurrent_requests_coalesce_into_single_fetch(self):
        call_count = 0
        execution_gate = asyncio.Event()

        async def slow_fetch():
            nonlocal call_count
            call_count += 1
            # Wait briefly to simulate heavy computation while concurrent requests arrive
            await asyncio.sleep(0.05)
            return {"season": 2026, "coalesced": True}

        # Mock get_advanced_cache to return None initially so it misses
        # and set_advanced_cache_async to update a mock cache dict.
        fake_cache = {}

        def mock_get(key):
            return fake_cache.get(key)

        async def mock_set(key, val, hours=24):
            fake_cache[key] = val

        with patch("config.cache.get_advanced_cache", side_effect=mock_get), \
             patch("config.cache.set_advanced_cache_async", side_effect=mock_set):

            # Launch 10 concurrent requests for the exact same key
            test_key = "test_coalesce_concurrent_race_data.json"
            tasks = [
                asyncio.create_task(
                    fetch_with_coalescing(test_key, slow_fetch)
                )
                for _ in range(10)
            ]

            results = await asyncio.gather(*tasks)

            # All 10 callers must receive the exact computed result
            self.assertEqual(len(results), 10)
            for res in results:
                self.assertEqual(res, {"season": 2026, "coalesced": True})

            # But the underlying heavy computation must run EXACTLY ONCE!
            self.assertEqual(call_count, 1)

    async def test_cache_hit_bypasses_fetch_immediately(self):
        call_count = 0

        async def dummy_fetch():
            nonlocal call_count
            call_count += 1
            return {"hit": False}

        with patch("config.cache.get_advanced_cache", return_value={"hit": True}):
            res = await fetch_with_coalescing("hit_key.json", dummy_fetch)
            self.assertEqual(res, {"hit": True})
            self.assertEqual(call_count, 0)
