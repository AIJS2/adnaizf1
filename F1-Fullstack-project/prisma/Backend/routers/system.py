import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Request
import pandas as pd
import fastf1
import asyncio
import traceback
import os
import json
from datetime import datetime, timedelta

from config.cache import get_advanced_cache, set_advanced_cache, clear_advanced_cache, CACHE_DURATION_HOURS
from services.scraper import apply_f1_official_standings
from config.limiter import limiter

router = APIRouter()

def get_dashboard_cache_filename(year: int):
    return f"dashboard_cache_{year}.json"

def get_championship_cache_filename(year: int):
    return f"championship_cache_{year}.json"

@router.get("/api/clear_cache/{year}")
@limiter.limit("50/minute")
async def clear_cache(request: Request, year: int):
    championship_cache = get_championship_cache_filename(year)
    dashboard_cache = get_dashboard_cache_filename(year)
    all_races_cache = f"all_races_cache_{year}.json"
    
    keys_to_delete = [championship_cache, dashboard_cache, all_races_cache]
    for i in range(1, 25):
        keys_to_delete.append(f"race_detail_cache_{year}_{i}.json")
        
    import asyncio
    await asyncio.to_thread(clear_advanced_cache, keys_to_delete)
    
    return {"messages": [f"Cache klasemen, dashboard, semua balapan, dan detail balapan untuk {year} dihapus dari Redis dan disk."]}

