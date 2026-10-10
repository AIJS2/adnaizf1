import logging
import asyncio
from fastapi import APIRouter, Request

from config.cache import get_advanced_cache, set_advanced_cache
from services.scraper import apply_f1_official_standings
from services.dashboard_service import compute_fastf1_dashboard
from config.limiter import limiter

router = APIRouter()


def get_dashboard_cache_filename(year: int):
    return f"dashboard_cache_{year}.json"


@router.get("/api/dashboard/{year}")
@limiter.limit("100/minute")
async def get_dashboard_data(request: Request, year: int):
    CACHE_FILE = get_dashboard_cache_filename(year)
    cached_data = await asyncio.to_thread(get_advanced_cache, CACHE_FILE)
    if cached_data:
        print("✅ Menyajikan data dari REDIS/CACHE (Dashboard)...")
        return cached_data

    final_data = await asyncio.to_thread(compute_fastf1_dashboard, year)
    if isinstance(final_data, dict) and "error" in final_data:
        return final_data

    # Pre-season / no-data seasons carry the status flag and must be cached
    # too, otherwise every request recomputes an empty season.
    if isinstance(final_data, dict) and final_data.get("status") == "pre_season":
        await asyncio.to_thread(set_advanced_cache, CACHE_FILE, final_data)
        return final_data

    try:
        final_data = await apply_f1_official_standings(final_data)
        await asyncio.to_thread(set_advanced_cache, CACHE_FILE, final_data)
        print("✅ Perhitungan Dashboard selesai. Data disimpan ke cache.")
        return final_data
    except Exception as e:
        logging.error(f"Error pada server: {e}", exc_info=True)
        # The FastF1 computation already succeeded; only the optional F1.com
        # standings overlay failed. Serve what we have rather than discarding
        # a good payload.
        await asyncio.to_thread(set_advanced_cache, CACHE_FILE, final_data)
        return final_data
