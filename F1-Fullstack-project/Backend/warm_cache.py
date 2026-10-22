"""Async CLI cache warmer for the F1 API.

Pre-populates the Redis / on-disk cache with the hot payloads of a season:
the full race calendar, the championship standings, and the most-viewed
telemetry comparisons, so the first real user request never pays the
cold-start cost.

Usage:
    python -m warm_cache --year 2026 --concurrency 3
"""

from __future__ import annotations

import argparse
import asyncio
import logging
import os
import sys

# Ensure the Backend package root is importable when run as `python warm_cache.py`.
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from config.cache import get_advanced_cache_swr
from services.championship_service import compute_fastf1_championship
from services.races_service import compute_fastf1_all_races
from services.telemetry_service import get_telemetry_drivers_list

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(message)s",
)
log = logging.getLogger("warm_cache")

DEFAULT_SEASON = 2026
DEFAULT_CONCURRENCY = 3

# Hot rounds to pre-warm telemetry for: the opening races see the most
# traffic, and the default 2-driver comparison is what the UI loads first.
HOT_TELEMETRY_ROUNDS = [1, 2, 3]


async def _fetch_races(year: int) -> dict:
    """Warm the full season race schedule."""

    async def _fetch():
        return await asyncio.to_thread(compute_fastf1_all_races, year)

    data, state = await get_advanced_cache_swr(f"all_races_cache_{year}.json", _fetch)
    if data is None:
        return {"error": f"races warm failed ({state})"}
    return data


async def _fetch_standings(year: int) -> dict:
    """Warm the championship (drivers + constructors) payload."""

    async def _fetch():
        return await asyncio.to_thread(compute_fastf1_championship, year)

    data, state = await get_advanced_cache_swr(
        f"championship_cache_{year}.json", _fetch
    )
    if data is None:
        return {"error": f"standings warm failed ({state})"}
    return data


async def _warm_top_telemetry(year: int, round_number: int) -> dict:
    """Warm the default 2-driver telemetry comparison for one round."""
    drivers = await asyncio.to_thread(get_telemetry_drivers_list, year, round_number)
    if not drivers:
        log.info(f"No driver list for {year} R{round_number}; skipping telemetry warm.")
        return {"skipped": True, "year": year, "round": round_number}

    default_pair = drivers[:2]

    from services.telemetry_service import process_telemetry_compare

    cache_file = os.path.join(
        "cache",
        f"telemetry_v2_{year}_{round_number}_{'_'.join(default_pair)}_lapNone.json",
    )

    async def _fetch():
        return await asyncio.to_thread(
            process_telemetry_compare, year, round_number, default_pair, None
        )

    data, state = await get_advanced_cache_swr(cache_file, _fetch)
    log.info(f"Telemetry warm R{round_number} pair={default_pair} state={state}")
    return data or {"error": f"telemetry warm failed ({state})"}


async def main(args: argparse.Namespace) -> None:
    year = args.year
    concurrency = args.concurrency
    log.info(f"Warming cache for season {year} (concurrency={concurrency})")

    semaphore = asyncio.Semaphore(concurrency)

    async def _bounded(coro):
        async with semaphore:
            return await coro

    # Phase 1: schedule + standings.
    results1 = await asyncio.gather(
        _bounded(_fetch_races(year)),
        _bounded(_fetch_standings(year)),
        return_exceptions=True,
    )
    for label, res in zip(["races", "standings"], results1):
        if isinstance(res, Exception):
            log.error(f"{label} warm failed: {res}")
        else:
            log.info(f"{label} warm OK")

    # Phase 2: hot telemetry comparisons.
    hot_jobs = [_bounded(_warm_top_telemetry(year, r)) for r in HOT_TELEMETRY_ROUNDS]
    results2 = await asyncio.gather(*hot_jobs, return_exceptions=True)
    ok = sum(1 for r in results2 if not isinstance(r, Exception))
    log.info(f"Telemetry warm: {ok}/{len(hot_jobs)} hot rounds succeeded")

    log.info(f"Warm-cache run complete for {year}.")


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(description="Pre-populate the F1 API cache.")
    parser.add_argument(
        "--year",
        type=int,
        default=DEFAULT_SEASON,
        help="Season to warm (default 2026).",
    )
    parser.add_argument(
        "--concurrency",
        type=int,
        default=DEFAULT_CONCURRENCY,
        help="Max parallel background fetches (default 3).",
    )
    return parser


if __name__ == "__main__":
    args = build_parser().parse_args()
    asyncio.run(main(args))
