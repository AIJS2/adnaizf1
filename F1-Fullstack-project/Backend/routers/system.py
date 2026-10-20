import asyncio

from fastapi import APIRouter, Depends, Request

from config.cache import clear_advanced_cache
from config.limiter import limiter
from utils.auth import require_api_key

router = APIRouter()

def get_dashboard_cache_filename(year: int):
    return f"dashboard_cache_{year}.json"

def get_championship_cache_filename(year: int):
    return f"championship_cache_{year}.json"

@router.get("/api/clear_cache/{year}", dependencies=[Depends(require_api_key)])
@limiter.limit("50/minute")
async def clear_cache(request: Request, year: int):
    championship_cache = get_championship_cache_filename(year)
    dashboard_cache = get_dashboard_cache_filename(year)
    all_races_cache = f"all_races_cache_{year}.json"
    
    keys_to_delete = [championship_cache, dashboard_cache, all_races_cache]
    for i in range(1, 25):
        keys_to_delete.append(f"race_detail_cache_{year}_{i}.json")

    await asyncio.to_thread(clear_advanced_cache, keys_to_delete)
    
    return {"messages": [f"Cache klasemen, dashboard, semua balapan, dan detail balapan untuk {year} dihapus dari Redis dan disk."]}

