import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request
import asyncio
import traceback
import os
import json
from datetime import datetime, timedelta

from config.cache import get_advanced_cache, set_advanced_cache, clear_advanced_cache, CACHE_DURATION_HOURS
from services.scraper import apply_f1_official_standings
from services.championship_service import compute_fastf1_championship
from config.limiter import limiter

router = APIRouter()

def get_dashboard_cache_filename(year: int):
    return f"dashboard_cache_{year}.json"

def get_championship_cache_filename(year: int):
    return f"championship_cache_{year}.json"

# =======================================================================
# --- Endpoint /api/championship/{year} (DENGAN PERBAIKAN PRA-MUSIM) ---
# =======================================================================
@router.get("/api/championship/{year}")
@limiter.limit("10/minute")
async def get_championship_standings(request: Request, year: int):
    CACHE_FILE = get_championship_cache_filename(year)
    import asyncio
    cached_data = await asyncio.to_thread(get_advanced_cache, CACHE_FILE)
    if cached_data:
        print("✅ Menyajikan data dari REDIS/CACHE (Championship)...")
        return cached_data

    final_data = await asyncio.to_thread(compute_fastf1_championship, year)
    if "error" in final_data:
        return final_data
        
    try:
        final_data = await apply_f1_official_standings(final_data)
        set_advanced_cache(CACHE_FILE, final_data)
        print("✅ Perhitungan Championship (Teams & Drivers) lengkap selesai. Data disimpan ke cache.")
        return final_data
    except Exception as e:
        logging.error(f"Error pada server: {e}", exc_info=True)
        return {"error": "Terjadi kesalahan internal saat memproses data."}

