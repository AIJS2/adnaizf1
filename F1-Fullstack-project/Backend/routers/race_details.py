import logging
import asyncio
from fastapi import APIRouter, Request
from config.cache import get_advanced_cache, set_advanced_cache
from services.race_details_service import compute_fastf1_race_details
from config.limiter import limiter

router = APIRouter()

def get_dashboard_cache_filename(year: int):
    return f"dashboard_cache_{year}.json"

# =======================================================================
# --- ENDPOINT DETAIL BALAPAN (DENGAN PERBAIKAN LOGO) ---
# =======================================================================
@router.get("/api/race/{year}/{round_number}")
@limiter.limit("100/minute")
async def get_race_details(request: Request, year: int, round_number: int):
    CACHE_FILE = f"race_detail_cache_{year}_{round_number}.json"
    
    cached_data = await asyncio.to_thread(get_advanced_cache, CACHE_FILE)
    if isinstance(cached_data, dict) and "sector_matrix" in cached_data:
        print(f"✅ Menyajikan data dari REDIS/CACHE (Detail Race Lengkap {year}-{round_number})...")
        return cached_data

    # Calculate using FastF1 service logic (in a separate thread)
    final_data = await asyncio.to_thread(compute_fastf1_race_details, year, round_number, CACHE_FILE)
    
    if isinstance(final_data, dict) and "error" in final_data:
        return final_data
        
    set_advanced_cache(CACHE_FILE, final_data)
    print(f"✅ Perhitungan DETAIL SUPER LENGKAP (dgn tab dinamis) selesai.")
    return final_data

# --- Endpoint /api/clear_cache/{year} (Tidak berubah) ---
