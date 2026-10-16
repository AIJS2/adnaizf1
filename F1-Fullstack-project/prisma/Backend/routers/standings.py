import logging
import asyncio
from fastapi import APIRouter, Request
from config.limiter import limiter
from services.standings_db import (
    get_championship_from_db,
    get_driver_standings_from_db,
    get_constructor_standings_from_db,
)
from services.championship_service import compute_fastf1_championship

router = APIRouter(prefix="/api/standings", tags=["standings"])


@router.get("/{year}")
@limiter.limit("100/minute")
async def get_all_standings(request: Request, year: int):
    """Fetch complete F1 standings (Drivers & Constructors) from SQLite DB, fallback to cache."""
    db_data = await asyncio.to_thread(get_championship_from_db, year)
    if db_data:
        return db_data

    # Fallback to compute/cached championship if DB not yet seeded
    fallback = await asyncio.to_thread(compute_fastf1_championship, year)
    return fallback


@router.get("/drivers/{year}")
@limiter.limit("100/minute")
async def get_driver_standings(request: Request, year: int):
    """Fetch Driver Championship standings from SQLite DB."""
    drivers = await asyncio.to_thread(get_driver_standings_from_db, year)
    if drivers:
        return {"year": year, "drivers": drivers, "source": "sqlite_database"}

    # Fallback
    fallback = await asyncio.to_thread(compute_fastf1_championship, year)
    drivers_list = fallback.get("drivers", []) if isinstance(fallback, dict) else []
    return {"year": year, "drivers": drivers_list, "source": "fallback"}


@router.get("/constructors/{year}")
@limiter.limit("100/minute")
async def get_constructor_standings(request: Request, year: int):
    """Fetch Constructors Championship standings from SQLite DB."""
    teams = await asyncio.to_thread(get_constructor_standings_from_db, year)
    if teams:
        return {"year": year, "teams": teams, "source": "sqlite_database"}

    # Fallback
    fallback = await asyncio.to_thread(compute_fastf1_championship, year)
    teams_list = fallback.get("teams", []) if isinstance(fallback, dict) else []
    return {"year": year, "teams": teams_list, "source": "fallback"}
