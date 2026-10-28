import logging
import asyncio
from fastapi import APIRouter, Path, Request

from config.cache import (
    get_advanced_cache,
    set_advanced_cache,
    fetch_with_coalescing,
    _read_cache,
)
from services.scraper import apply_f1_official_standings
from services.championship_service import compute_fastf1_championship
from services.standings_db import get_championship_from_db
from config.limiter import limiter

router = APIRouter()


def get_championship_cache_filename(year: int):
    return f"championship_cache_{year}.json"


@router.get("/api/championship/{year}")
@limiter.limit("100/minute")
async def get_championship_standings(
    request: Request, year: int = Path(..., ge=2018, le=2026)
):
    CACHE_FILE = get_championship_cache_filename(year)
    cached_data = await asyncio.to_thread(get_advanced_cache, CACHE_FILE)
    if not cached_data:
        cached_data = await asyncio.to_thread(_read_cache, CACHE_FILE)
    if cached_data:
        logging.info("[Championship] Serving data from cache...")
        return cached_data

    async def _compute_championship():
        # Check SQLite Database for structured relational standings
        db_data = await asyncio.to_thread(get_championship_from_db, year)
        if db_data:
            logging.info(f"[Championship] Serving data from SQLite Database for {year}...")
            return db_data

        final_data = await asyncio.to_thread(compute_fastf1_championship, year)
        if isinstance(final_data, dict) and "error" in final_data:
            return final_data

        if isinstance(final_data, dict) and final_data.get("status") == "pre_season":
            return final_data

        try:
            final_data = await apply_f1_official_standings(final_data)
        except Exception as e:
            logging.error(f"Error pada server: {e}", exc_info=True)
        return final_data

    return await fetch_with_coalescing(CACHE_FILE, _compute_championship)
