import asyncio

from fastapi import APIRouter, Depends, Path, Request

from config.cache import clear_advanced_cache, clear_cache_by_prefix
from config.limiter import limiter
from utils.auth import require_api_key

router = APIRouter()


def get_dashboard_cache_filename(year: int):
    return f"dashboard_cache_{year}.json"


def get_championship_cache_filename(year: int):
    return f"championship_cache_{year}.json"


@router.get("/api/clear_cache/{year}", dependencies=[Depends(require_api_key)])
@limiter.limit("50/minute")
async def clear_cache(
    request: Request,
    year: int = Path(..., ge=2018, le=2026),
    include_telemetry: bool = False,
):
    championship_cache = get_championship_cache_filename(year)
    dashboard_cache = get_dashboard_cache_filename(year)
    all_races_cache = f"all_races_cache_{year}.json"

    keys_to_delete = [championship_cache, dashboard_cache, all_races_cache]
    # 1..25 inclusive: a season has up to 25 rounds (range(1, 25) skipped 25).
    for i in range(1, 26):
        keys_to_delete.append(f"race_detail_cache_{year}_{i}.json")

    await asyncio.to_thread(clear_advanced_cache, keys_to_delete)

    messages = [
        f"Cache klasemen, dashboard, semua balapan, dan detail balapan untuk {year} dihapus dari Redis dan disk."
    ]

    # Opt-in purge of the variable-named telemetry caches and the 24h
    # fastf1_no_laps_* negative markers; off by default to avoid accidental
    # data loss.
    if include_telemetry:
        removed = await asyncio.to_thread(
            clear_cache_by_prefix,
            [f"telemetry_v2_{year}_", f"fastf1_no_laps_{year}_"],
        )
        messages.append(
            f"Cache telemetry dan penanda no-laps untuk {year} dihapus ({removed} file)."
        )

    return {"messages": messages}
