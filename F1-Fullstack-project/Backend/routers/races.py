from fastapi import APIRouter, Request
import asyncio

from config.cache import get_advanced_cache, set_advanced_cache
from services.races_service import compute_fastf1_all_races
from config.limiter import limiter

router = APIRouter()

def get_dashboard_cache_filename(year: int):
    return f"dashboard_cache_{year}.json"

# =======================================================================
# --- Endpoint All Races (DENGAN PERBAIKAN JADWAL KOSONG) ---
# =======================================================================
@router.get("/api/races/{year}")
@limiter.limit("20/minute")
async def get_all_races_for_year(request: Request, year: int):
    CACHE_FILE = f"all_races_cache_{year}.json"
    cached_data = await asyncio.to_thread(get_advanced_cache, CACHE_FILE)
    if cached_data:
        print(f"✅ Menyajikan data dari REDIS/CACHE (All Races {year})...")
        return cached_data
        
    all_races_data = await asyncio.to_thread(compute_fastf1_all_races, year)
    if isinstance(all_races_data, dict) and "error" in all_races_data:
        return all_races_data
        
    set_advanced_cache(CACHE_FILE, all_races_data)
    print(f"✅ Perhitungan SEMUA BALAPAN untuk {year} selesai.")
    return all_races_data
