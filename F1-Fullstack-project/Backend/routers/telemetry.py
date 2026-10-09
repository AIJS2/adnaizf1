import logging
import asyncio
import os
from fastapi import APIRouter, Request

from config.cache import get_advanced_cache, set_advanced_cache
from services.telemetry_service import process_telemetry_compare, get_telemetry_drivers_list
from config.limiter import limiter

router = APIRouter()

def get_dashboard_cache_filename(year: int):
    return f"dashboard_cache_{year}.json"

# =======================================================================
# --- Endpoint /api/telemetry/{year}/{round_number} (Head-to-Head) ---
# =======================================================================
@router.get("/api/telemetry/{year}/{round_number}")
@limiter.limit("10/minute")
async def get_telemetry_compare(request: Request, year: int, round_number: int, drivers: str = "VER,NOR", lap: int = None):
    driver_list = [d.strip().upper() for d in drivers.split(',')]
    driver_list = driver_list[:10] # Max 10 drivers
    
    if len(driver_list) < 1:
        return {"error": "Pilih minimal 1 pembalap."}

    CACHE_FILE = os.path.join("cache", f"telemetry_{year}_{round_number}_{'_'.join(driver_list)}_lap{lap}.json")
    cached_data = get_advanced_cache(CACHE_FILE, hours=24) # Telemetry cached longer
    if cached_data:
        print(f"o. Menyajikan data dari REDIS/CACHE (Telemetry).")
        return cached_data

    try:
        result = await asyncio.to_thread(
            process_telemetry_compare,
            year,
            round_number,
            driver_list,
            lap
        )
        set_advanced_cache(CACHE_FILE, result)
        return result
    except ValueError as ve:
        return {"error": str(ve)}
    except Exception as e:
        logging.error(f"Error memproses telemetry: {e}", exc_info=True)
        return {"error": "Terjadi kesalahan internal saat memproses data."}

@router.get("/api/telemetry-drivers/{year}/{round_number}")
@limiter.limit("20/minute")
async def get_telemetry_drivers(request: Request, year: int, round_number: int):
    try:
        return await asyncio.to_thread(
            get_telemetry_drivers_list,
            year,
            round_number
        )
    except Exception as e:
        logging.error(f"Error getting telemetry drivers: {e}", exc_info=True)
        return []

