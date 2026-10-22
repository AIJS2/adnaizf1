import logging
import asyncio
import time
from fastapi import APIRouter, Request, BackgroundTasks
from config.cache import get_advanced_cache_with_meta, set_advanced_cache
from services.race_details_service import compute_fastf1_race_details
from config.limiter import limiter

router = APIRouter()

# In-memory deduplication set for active background refresh tasks
_active_refreshes: set[str] = set()


def _run_background_revalidation(
    year: int, round_number: int, cache_file: str, refresh_key: str
):
    try:
        logging.info(
            f"[SWR Background] Starting revalidation for {year} Round {round_number}..."
        )
        compute_fastf1_race_details(year, round_number, cache_file)
        logging.info(
            f"[SWR Background] Revalidation complete, cache updated for {year} Round {round_number}."
        )
    except Exception as e:
        logging.error(
            f"[SWR Background] Error revalidating {year}-{round_number}: {e}",
            exc_info=True,
        )
    finally:
        _active_refreshes.discard(refresh_key)


# =======================================================================
# --- ENDPOINT DETAIL BALAPAN (DENGAN SWR STALE-WHILE-REVALIDATE) ---
# =======================================================================
@router.get("/api/race/{year}/{round_number}")
@limiter.limit("100/minute")
async def get_race_details(
    request: Request,
    year: int,
    round_number: int,
    background_tasks: BackgroundTasks,
    refresh: bool = False,
):
    CACHE_FILE = f"race_detail_cache_{year}_{round_number}.json"
    refresh_key = f"{year}_{round_number}"

    cached_meta = await asyncio.to_thread(get_advanced_cache_with_meta, CACHE_FILE)
    cached_data = cached_meta.get("data") if cached_meta else None
    cache_mtime = cached_meta.get("mtime", 0.0) if cached_meta else 0.0

    # If cached data exists and force-refresh is NOT requested
    if isinstance(cached_data, dict) and "race_info" in cached_data and not refresh:
        status = cached_data.get("status")
        now = time.time()
        age_seconds = now - cache_mtime if cache_mtime > 0 else 0

        # Completed races with rich telemetry have a long TTL (24h = 86400s).
        # Incomplete, Ongoing, or Upcoming sessions have a short TTL (10m = 600s).
        # A "Completed" payload that is missing the lap-derived data (fastest
        # lap / tyre strategy) is a stale artifact of an earlier computation,
        # not a finished cache — keep the short TTL so it gets revalidated
        # instead of being served for 24h.
        has_lap_data = bool(cached_data.get("fastest_lap")) and bool(
            cached_data.get("tyre_strategy")
        )
        is_completed = status == "Completed" and bool(cached_data.get("results"))
        ttl_seconds = 86400 if (is_completed and has_lap_data) else 600
        is_stale = (
            age_seconds > ttl_seconds
            or status in ("Ongoing", "Upcoming")
            or not cached_data.get("results")
        )

        if is_stale:
            # Trigger background revalidation if not already running
            if refresh_key not in _active_refreshes:
                _active_refreshes.add(refresh_key)
                background_tasks.add_task(
                    _run_background_revalidation,
                    year,
                    round_number,
                    CACHE_FILE,
                    refresh_key,
                )
                logging.info(
                    f"[SWR] Serving stale cache ({round(age_seconds)}s) & triggering background refresh: {year}-{round_number}"
                )

            response_copy = dict(cached_data)
            response_copy["_cache_state"] = "revalidating"
            return response_copy

        # Fresh cache
        response_copy = dict(cached_data)
        response_copy["_cache_state"] = "fresh"
        return response_copy

    # If user explicitly requested refresh=true but we ALREADY have a cache,
    # we can also revalidate in background OR synchronous if requested.
    # Instruction 2.1: "If it is expired/stale OR its status is 'Ongoing' / 'Upcoming' (or if the user passes ?refresh=true),
    # STILL return the existing cached JSON immediately to the client with _cache_state: 'revalidating', and schedule a FastAPI BackgroundTasks job"
    if isinstance(cached_data, dict) and "race_info" in cached_data and refresh:
        if refresh_key not in _active_refreshes:
            _active_refreshes.add(refresh_key)
            background_tasks.add_task(
                _run_background_revalidation,
                year,
                round_number,
                CACHE_FILE,
                refresh_key,
            )
            logging.info(
                f"[SWR Refresh] Serving cache & triggering background refresh: {year}-{round_number}"
            )

        response_copy = dict(cached_data)
        response_copy["_cache_state"] = "revalidating"
        return response_copy

    # True cold start (no cache on disk at all) -> block on calculation
    logging.info(f"Cold start: computing race details {year}-{round_number}...")
    final_data = await asyncio.to_thread(
        compute_fastf1_race_details, year, round_number, CACHE_FILE
    )

    if isinstance(final_data, dict) and "error" in final_data:
        return final_data

    set_advanced_cache(CACHE_FILE, final_data)
    final_data_copy = dict(final_data)
    final_data_copy["_cache_state"] = "fresh"
    return final_data_copy
