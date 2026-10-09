import logging
import asyncio
from fastapi import APIRouter, Request

from routers.championship import get_championship_standings
from services.profiles_service import process_driver_profile, process_team_profile
from config.limiter import limiter

router = APIRouter()

# =======================================================================
# --- ENDPOINTS PROFIL DRIVER & TEAM (DEDICATED ANALYTICS) ---
# =======================================================================
@router.get("/api/driver/{year}/{driver_id}")
@limiter.limit("200/minute")
async def get_driver_profile(request: Request, year: int, driver_id: str):
    champ_data = await get_championship_standings(request, year)
    if "error" in champ_data:
        return champ_data

    return await asyncio.to_thread(process_driver_profile, champ_data, year, driver_id)

@router.get("/api/team/{year}/{team_id}")
@limiter.limit("200/minute")
async def get_team_profile(request: Request, year: int, team_id: str):
    champ_data = await get_championship_standings(request, year)
    if "error" in champ_data:
        return champ_data

    return await asyncio.to_thread(process_team_profile, champ_data, year, team_id)
