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
from services.dashboard_service import compute_fastf1_dashboard
from config.limiter import limiter

router = APIRouter()


def get_dashboard_cache_filename(year: int):
    return f"dashboard_cache_{year}.json"


@router.get("/api/dashboard/{year}")
@limiter.limit("100/minute")
async def get_dashboard_data(
    request: Request, year: int = Path(..., ge=2018, le=2026)
):
    CACHE_FILE = get_dashboard_cache_filename(year)
    cached_data = await asyncio.to_thread(get_advanced_cache, CACHE_FILE)
    if not cached_data:
        cached_data = await asyncio.to_thread(_read_cache, CACHE_FILE)
    if cached_data:
        logging.info("[Dashboard] Serving data from cache...")
        return cached_data

    async def _compute_dashboard():
        final_data = await asyncio.to_thread(compute_fastf1_dashboard, year)
        if isinstance(final_data, dict) and "error" in final_data:
            return final_data
        if isinstance(final_data, dict) and final_data.get("status") == "pre_season":
            return final_data
        try:
            final_data = await apply_f1_official_standings(final_data)
        except Exception as e:
            logging.error(f"Error pada server: {e}", exc_info=True)
        return final_data

    return await fetch_with_coalescing(CACHE_FILE, _compute_dashboard)
