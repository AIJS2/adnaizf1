import logging
from fastapi import APIRouter, Path, Request
import asyncio

from config.cache import (
    get_advanced_cache,
    set_advanced_cache,
    fetch_with_coalescing,
    _read_cache,
)
from services.races_service import compute_fastf1_all_races
from config.limiter import limiter

router = APIRouter()


# =======================================================================
# --- Endpoint All Races (DENGAN PERBAIKAN JADWAL KOSONG) ---
# =======================================================================
@router.get("/api/races/{year}")
@limiter.limit("200/minute")
async def get_all_races_for_year(
    request: Request, year: int = Path(..., ge=2018, le=2026)
):
    CACHE_FILE = f"all_races_cache_{year}.json"
    cached_data = await asyncio.to_thread(get_advanced_cache, CACHE_FILE)
    if not cached_data:
        cached_data = await asyncio.to_thread(_read_cache, CACHE_FILE)
    if cached_data:
        logging.info(f"[Races] Serving data from cache for {year}...")
        return cached_data

    async def _compute_races():
        return await asyncio.to_thread(compute_fastf1_all_races, year)

    res = await fetch_with_coalescing(CACHE_FILE, _compute_races)
    if not res:
        res = await asyncio.to_thread(_read_cache, CACHE_FILE)
    logging.info(f"[Races] Computation complete for {year}.")
    return res or []
