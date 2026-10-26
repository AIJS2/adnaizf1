import logging
import asyncio
import os
import re
from typing import Optional
from fastapi import APIRouter, HTTPException, Path, Query, Request

from config.cache import get_advanced_cache, set_advanced_cache
from services.telemetry_service import (
    process_telemetry_compare,
    get_telemetry_drivers_list,
)
from config.limiter import limiter

router = APIRouter()

MAX_TELEMETRY_DRIVERS = 10
DRIVER_CODE_RE = re.compile(r"^[A-Za-z]{3}$")


@router.get("/api/telemetry/{year}/{round_number}")
@limiter.limit("100/minute")
async def get_telemetry_compare(
    request: Request,
    year: int = Path(..., ge=2018, le=2026),
    round_number: int = Path(..., ge=1, le=25),
    drivers: str = Query("VER,NOR", max_length=60),
    lap: Optional[int] = Query(None, ge=1, le=100),
):
    raw_tokens = [d.strip() for d in drivers.split(",") if d.strip()]
    if any(not DRIVER_CODE_RE.fullmatch(token) for token in raw_tokens):
        raise HTTPException(
            status_code=422,
            detail="Invalid driver code; each driver must be a 3-letter abbreviation.",
        )

    driver_list = [token.upper() for token in raw_tokens][:MAX_TELEMETRY_DRIVERS]

    if not driver_list:
        # No driver code was supplied. An empty payload with the reason is more
        # useful to the caller than an error envelope, because the request was
        # well-formed — it just selected nobody.
        return {
            "drivers": [],
            "driver_info": {},
            "telemetry": [],
            "unavailable_drivers": [],
            "unavailable_reasons": {},
            "message": "No drivers were selected for comparison.",
        }

    CACHE_FILE = os.path.join(
        "cache",
        f"telemetry_v2_{year}_{round_number}_{'_'.join(driver_list)}_lap{lap}.json",
    )
    cached_data = get_advanced_cache(CACHE_FILE, hours=24)  # Telemetry cached longer
    if cached_data:
        print("o. Menyajikan data dari REDIS/CACHE (Telemetry).")
        return cached_data

    try:
        result = await asyncio.to_thread(
            process_telemetry_compare, year, round_number, driver_list, lap
        )
        set_advanced_cache(CACHE_FILE, result)
        return result
    except Exception as e:
        logging.error(f"Error memproses telemetry: {e}", exc_info=True)
        return {
            "drivers": [],
            "driver_info": {},
            "telemetry": [],
            "unavailable_drivers": driver_list,
            "unavailable_reasons": {
                d: "Telemetry could not be processed for this session."
                for d in driver_list
            },
        }


@router.get("/api/telemetry-drivers/{year}/{round_number}")
@limiter.limit("200/minute")
async def get_telemetry_drivers(
    request: Request,
    year: int = Path(..., ge=2018, le=2026),
    round_number: int = Path(..., ge=1, le=25),
):
    try:
        return await asyncio.to_thread(get_telemetry_drivers_list, year, round_number)
    except Exception as e:
        logging.error(f"Error getting telemetry drivers: {e}", exc_info=True)
        return []
