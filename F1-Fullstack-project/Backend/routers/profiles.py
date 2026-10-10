import logging
import asyncio
from fastapi import APIRouter, Request

from routers.championship import get_championship_standings
from services.profiles_service import process_driver_profile, process_team_profile
from config.limiter import limiter

router = APIRouter()


def _season_has_no_standings(champ_data) -> bool:
    """
    True when the championship payload carries no standings at all.

    A pre-season or unavailable season still returns HTTP 200 with empty
    `teams`/`drivers`, so the profile endpoints must answer "not found" rather
    than trying to index into an empty list.
    """
    if not isinstance(champ_data, dict):
        return True
    if champ_data.get("error"):
        return True
    return not champ_data.get("drivers") and not champ_data.get("teams")


@router.get("/api/driver/{year}/{driver_id}")
@limiter.limit("200/minute")
async def get_driver_profile(request: Request, year: int, driver_id: str):
    champ_data = await get_championship_standings(request, year)
    if _season_has_no_standings(champ_data):
        # No standings exist for this season yet, so no driver can be found.
        return {"error": f"Driver '{driver_id}' not found in {year} season."}

    return await asyncio.to_thread(process_driver_profile, champ_data, year, driver_id)


@router.get("/api/team/{year}/{team_id}")
@limiter.limit("200/minute")
async def get_team_profile(request: Request, year: int, team_id: str):
    champ_data = await get_championship_standings(request, year)
    if _season_has_no_standings(champ_data):
        return {"error": f"Team '{team_id}' not found in {year} season."}

    return await asyncio.to_thread(process_team_profile, champ_data, year, team_id)
