import asyncio
from fastapi import APIRouter, Path, Request
from config.cache import get_advanced_cache, set_advanced_cache
from config.limiter import limiter
from services.standings_db import (
    get_championship_from_db,
    get_driver_standings_from_db,
    get_constructor_standings_from_db,
)
from services.championship_service import compute_fastf1_championship

router = APIRouter(prefix="/api/standings", tags=["standings"])


def _cacheable(payload) -> bool:
    """Only cache successful payloads, never a transient error envelope."""
    return isinstance(payload, dict) and not payload.get("error")


@router.get("/{year}")
@limiter.limit("100/minute")
async def get_all_standings(
    request: Request, year: int = Path(..., ge=2018, le=2026)
):
    """Fetch complete F1 standings (Drivers & Constructors), cached like /api/championship.

    Previously uncached: every miss re-ran the full-season FastF1 aggregation
    (~50-70 session loads) and could saturate the shared threadpool.
    """
    cache_file = f"standings_all_{year}.json"
    cached = await asyncio.to_thread(get_advanced_cache, cache_file)
    if cached:
        return cached

    db_data = await asyncio.to_thread(get_championship_from_db, year)
    if db_data:
        await asyncio.to_thread(set_advanced_cache, cache_file, db_data)
        return db_data

    # Fallback to compute/cached championship if DB not yet seeded
    fallback = await asyncio.to_thread(compute_fastf1_championship, year)
    if _cacheable(fallback):
        await asyncio.to_thread(set_advanced_cache, cache_file, fallback)
    return fallback


@router.get("/drivers/{year}")
@limiter.limit("100/minute")
async def get_driver_standings(
    request: Request, year: int = Path(..., ge=2018, le=2026)
):
    """Fetch Driver Championship standings from SQLite DB (cached)."""
    cache_file = f"standings_drivers_{year}.json"
    cached = await asyncio.to_thread(get_advanced_cache, cache_file)
    if cached:
        return cached

    drivers = await asyncio.to_thread(get_driver_standings_from_db, year)
    if drivers:
        payload = {"year": year, "drivers": drivers, "source": "sqlite_database"}
        await asyncio.to_thread(set_advanced_cache, cache_file, payload)
        return payload

    # Fallback
    fallback = await asyncio.to_thread(compute_fastf1_championship, year)
    drivers_list = fallback.get("drivers", []) if isinstance(fallback, dict) else []
    payload = {"year": year, "drivers": drivers_list, "source": "fallback"}
    if _cacheable(fallback):
        await asyncio.to_thread(set_advanced_cache, cache_file, payload)
    return payload


@router.get("/constructors/{year}")
@limiter.limit("100/minute")
async def get_constructor_standings(
    request: Request, year: int = Path(..., ge=2018, le=2026)
):
    """Fetch Constructors Championship standings from SQLite DB (cached)."""
    cache_file = f"standings_constructors_{year}.json"
    cached = await asyncio.to_thread(get_advanced_cache, cache_file)
    if cached:
        return cached

    teams = await asyncio.to_thread(get_constructor_standings_from_db, year)
    if teams:
        payload = {"year": year, "teams": teams, "source": "sqlite_database"}
        await asyncio.to_thread(set_advanced_cache, cache_file, payload)
        return payload

    # Fallback
    fallback = await asyncio.to_thread(compute_fastf1_championship, year)
    teams_list = fallback.get("teams", []) if isinstance(fallback, dict) else []
    payload = {"year": year, "teams": teams_list, "source": "fallback"}
    if _cacheable(fallback):
        await asyncio.to_thread(set_advanced_cache, cache_file, payload)
    return payload
