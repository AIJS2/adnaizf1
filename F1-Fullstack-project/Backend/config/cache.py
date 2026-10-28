import logging
import os
import json
import time
import asyncio
from typing import Any, Optional, List

import fastf1
import redis

# Lock untuk concurrent write protection
_cache_locks: dict[str, asyncio.Lock] = {}
_locks_lock = asyncio.Lock()


async def _get_cache_lock(key: str) -> asyncio.Lock:
    """Get or create an asyncio.Lock for a specific cache key."""
    async with _locks_lock:
        if key not in _cache_locks:
            _cache_locks[key] = asyncio.Lock()
        return _cache_locks[key]


# Resolve the FastF1 on-disk cache relative to the package, not the process CWD.
# A bare "cache" only works when uvicorn is launched from Backend/; under the
# Docker image (WORKDIR /app) or `python -m`, it lands somewhere unwritable.
_CACHE_DIR = os.environ.get(
    "F1_CACHE_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cache"),
)
os.makedirs(_CACHE_DIR, exist_ok=True)

# Dedicated sub-folder for FastF1's internal HTTP/session cache so it never
# collides with our JSON cache files, and never falls back to %TEMP%\fastf1
# (which FastF1's req.py opens with os.makedirs WITHOUT exist_ok=True,
# triggering FileExistsError on Windows and hanging every request).
_FASTF1_CACHE_DIR = os.path.join(_CACHE_DIR, "fastf1")
os.makedirs(_FASTF1_CACHE_DIR, exist_ok=True)

# Point FastF1 at our controlled directory before any session/schedule load.
fastf1.Cache.enable_cache(_FASTF1_CACHE_DIR)
# Also honour the env var FastF1's req.py actually reads (FASTF1_CACHE, not
# FASTF1_CACHE_DIR) as a belt-and-suspenders guard against it ever recreating
# %TEMP%\fastf1 in a process that skips this import.
os.environ.setdefault("FASTF1_CACHE", _FASTF1_CACHE_DIR)

CACHE_DURATION_HOURS = int(os.environ.get("CACHE_DURATION_HOURS", str(24 * 7)))

# ---------------------------------------------------------------------------
# Stale-While-Revalidate (SWR) policy.
#
# SOFT_TTL:  data is still served immediately from cache, but a background
#            task is allowed to revalidate it.
# HARD_TTL:  data is considered completely expired — a miss falls back to a
#            blocking refresh.
# Overridable via env for deployments that need tighter / looser windows.
# ---------------------------------------------------------------------------
SWR_SOFT_TTL_SECONDS = int(os.environ.get("SWR_SOFT_TTL_SECONDS", str(15 * 60)))
SWR_HARD_TTL_SECONDS = int(os.environ.get("SWR_HARD_TTL_SECONDS", str(24 * 3600)))

# Modern Redis configuration with connection pooling
REDIS_URL = os.environ.get("REDIS_URL", "").strip()

# Circuit breaker settings. Once a Redis call fails we stop hammering it and
# only retry after this cooldown, so a Redis outage degrades to "no cache"
# instead of adding a 5s timeout to every single request.
_REDIS_RETRY_COOLDOWN_SECONDS = 30.0

redis_client: Optional["redis.Redis"] = None
_redis_last_failure: float = 0.0


def _safe_redis_url() -> str:
    """Redis URL with any password stripped, safe for logs and /health.

    Never log the raw REDIS_URL: redis://:secret@host leaks the credential.
    """
    if not REDIS_URL:
        return "disabled"
    return REDIS_URL.split("@")[-1] if "@" in REDIS_URL else REDIS_URL


def _build_client() -> Optional["redis.Redis"]:
    """Create a pooled Redis client, or None when Redis is unconfigured or unreachable."""
    if not REDIS_URL or REDIS_URL.lower() in ("none", "disabled", "false"):
        return None
    try:
        pool = redis.ConnectionPool.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30,
        )
        client = redis.Redis(connection_pool=pool)
        client.ping()  # fail fast rather than on the first real command
        logging.info(f"Successfully connected to Redis cache at {_safe_redis_url()}")
        return client
    except Exception as e:
        logging.warning(f"Failed to connect to Redis at {_safe_redis_url()}: {e}")
        return None


def _get_redis() -> Optional["redis.Redis"]:
    """
    Return a usable Redis client, re-initializing lazily after a failure.

    The first connect happens at import; if Redis was down then (or dies
    later), every subsequent call re-attempts the connection once the cooldown
    has elapsed instead of staying permanently disabled.
    """
    global redis_client, _redis_last_failure

    if redis_client is not None:
        return redis_client

    now = time.monotonic()
    if (
        _redis_last_failure
        and (now - _redis_last_failure) < _REDIS_RETRY_COOLDOWN_SECONDS
    ):
        return None  # still inside the cooldown window

    redis_client = _build_client()
    if redis_client is None:
        _redis_last_failure = now
    return redis_client


def _invalidate_redis() -> None:
    """Drop the client after a runtime error so the next call reconnects."""
    global redis_client, _redis_last_failure
    redis_client = None
    _redis_last_failure = time.monotonic()


def redis_status() -> dict:
    """Connection state for the /health endpoint."""
    client = _get_redis()
    connected = False
    if client is not None:
        try:
            client.ping()
            connected = True
        except Exception:
            _invalidate_redis()
    return {
        "connected": connected,
        "url": _safe_redis_url() if REDIS_URL else "disabled (in-memory/file cache fallback)",
    }


# Attempt the initial connection eagerly so a misconfigured Redis is visible
# in the startup logs rather than on the first request.
redis_client = _build_client()
if redis_client is None:
    _redis_last_failure = time.monotonic()

# In-memory dedup guard for background revalidation tasks, so a burst of
# concurrent SWR requests for the same key schedules exactly one refresh.
_refresh_in_flight: set[str] = set()
_refreshes_guard = asyncio.Lock()


async def get_advanced_cache_swr(
    key: str,
    fetch: Any,
    soft_ttl: int = SWR_SOFT_TTL_SECONDS,
    hard_ttl: int = SWR_HARD_TTL_SECONDS,
    hours: int = CACHE_DURATION_HOURS,
) -> tuple[Any, str]:
    """
    Stale-While-Revalidate read.

    Returns (data, state) where state is one of:
      - "fresh":        younger than the soft TTL, served directly.
      - "revalidating": stale but still inside the hard TTL — served in 0ms
                        while a background task refreshes it.
      - "cold":        missing / past the hard TTL — blocks on fetch().

    Per-key ``asyncio.Lock`` (via ``_get_cache_lock``) guards the write, and
    the ``_refresh_in_flight`` dedup guard guarantees at most one background
    revalidation per key — a classic cache-stampede countermeasure.

    ``fetch`` must be an async callable taking no arguments that returns the
    payload to store.
    """
    data = await asyncio.to_thread(get_advanced_cache_with_meta, key)
    payload = data.get("data") if isinstance(data, dict) else None
    mtime = data.get("mtime", 0.0) if isinstance(data, dict) else 0.0

    if payload is not None:
        age = time.time() - mtime if mtime > 0 else 0.0
        if age <= hard_ttl:
            if age <= soft_ttl:
                return payload, "fresh"

            # Stale (soft-TTL passed) -> serve instantly, refresh in background.
            async with _refreshes_guard:
                should_refresh = key not in _refresh_in_flight
                if should_refresh:
                    _refresh_in_flight.add(key)
            if should_refresh:
                asyncio.create_task(_background_refresh(key, fetch, hours))
            return payload, "revalidating"

    # Cold miss (no cache, or past the hard TTL) -> block on a fetch.
    lock = await _get_cache_lock(key)
    async with lock:
        # Re-check after acquiring the lock: another task may have finished
        # its refresh while we were waiting (classic double-fetch guard).
        fresh = await asyncio.to_thread(get_advanced_cache, key)
        if fresh is not None:
            return fresh, "fresh"

        result = await fetch()
        if result is not None:
            await set_advanced_cache_async(key, result, hours=hours)
            return result, "fresh"
        return None, "cold"


async def fetch_with_coalescing(
    key: str,
    fetch: Any,
    hours: int = CACHE_DURATION_HOURS,
) -> Any:
    """
    Single-flight coalesced fetch: guards against cache stampedes / thundering herds.

    When concurrent requests miss the cache for `key`, only the first caller acquires
    the per-key lock and runs `fetch()`. Other callers wait on the same lock, then
    read the freshly populated cache directly.
    """
    # 1. Fast path: check cache without lock
    cached = await asyncio.to_thread(get_advanced_cache, key)
    if cached is not None:
        return cached

    # 2. Slow path: acquire per-key lock to coalesce concurrent executions
    lock = await _get_cache_lock(key)
    async with lock:
        # Re-check inside the lock: another task may have populated it while waiting
        cached = await asyncio.to_thread(get_advanced_cache, key)
        if cached is not None:
            return cached

        # Execute fetch
        if asyncio.iscoroutinefunction(fetch):
            result = await fetch()
        elif callable(fetch):
            result = await asyncio.to_thread(fetch)
        else:
            result = fetch

        if result is not None:
            await set_advanced_cache_async(key, result, hours=hours)
        return result


async def _background_refresh(
    key: str, fetch: Any, hours: int = CACHE_DURATION_HOURS
) -> None:
    """Background SWR revalidation; failure keeps the stale copy in place."""
    lock = await _get_cache_lock(key)
    try:
        async with lock:
            result = await fetch()
            if result is not None:
                await set_advanced_cache_async(key, result, hours=hours)
                logging.info(f"[SWR] background revalidation complete for '{key}'")
    except Exception as e:
        # Keep the stale data rather than evict it on a failed refresh.
        logging.warning(f"[SWR] background revalidation failed for '{key}': {e}")
    finally:
        async with _refreshes_guard:
            _refresh_in_flight.discard(key)


def _get_file_cache_path(key: str) -> str:
    clean_name = os.path.basename(key)
    if not clean_name.endswith(".json"):
        clean_name += ".json"
    return os.path.join(_CACHE_DIR, clean_name)


def _read_cache(key: str) -> Optional[Any]:
    """Read from Redis then the file fallback, with no age check.

    Split out so TTL-aware readers (`get_advanced_cache`) and raw readers
    (`get_advanced_cache_with_meta`, which applies its own TTL policy) can
    share one I/O path.
    """
    client = _get_redis()
    if client is not None:
        try:
            cached_data = client.get(key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logging.warning(f"Error reading from Redis cache for key '{key}': {e}")
            _invalidate_redis()  # reconnect on the next call

    # File cache fallback
    try:
        filepath = _get_file_cache_path(key)
        if os.path.exists(filepath):
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logging.warning(f"Error reading from file cache for key '{key}': {e}")

    return None


def get_advanced_cache(key: str, hours: int = CACHE_DURATION_HOURS) -> Optional[Any]:
    """
    Retrieve data from Redis cache or file fallback cache.

    Redis entries expire via SETEX, but the disk fallback previously never
    expired — a committed or stale snapshot was served forever. Now the file
    copy honours `hours` (mtime-based) the same way Redis honours its TTL.
    """
    client = _get_redis()
    if client is not None:
        try:
            cached_data = client.get(key)
            if cached_data:
                return json.loads(cached_data)
        except Exception as e:
            logging.warning(f"Error reading from Redis cache for key '{key}': {e}")
            _invalidate_redis()  # reconnect on the next call

    try:
        filepath = _get_file_cache_path(key)
        if os.path.exists(filepath):
            age_seconds = time.time() - os.path.getmtime(filepath)
            if age_seconds > int(hours) * 3600:
                return None
            with open(filepath, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception as e:
        logging.warning(f"Error reading from file cache for key '{key}': {e}")

    return None


def get_advanced_cache_with_meta(key: str) -> Optional[dict]:
    """
    Retrieve cached data and its file metadata (modified_time, mtime_epoch).

    Deliberately age-agnostic: callers (`race_details`) apply their own
    per-status TTL, so this must not drop an entry that is still valid under
    their policy just because the generic 6h window has passed.
    """
    data = _read_cache(key)
    if data is None:
        return None

    mtime = 0.0
    try:
        filepath = _get_file_cache_path(key)
        if os.path.exists(filepath):
            mtime = os.path.getmtime(filepath)
    except Exception:
        pass

    return {"data": data, "mtime": mtime}


async def set_advanced_cache_async(
    key: str, data: Any, hours: int = CACHE_DURATION_HOURS
) -> None:
    """Async version of set_advanced_cache with lock protection."""
    lock = await _get_cache_lock(key)
    async with lock:
        client = _get_redis()
        if client is not None:
            try:
                ttl_seconds = int(hours * 3600)
                await asyncio.to_thread(
                    client.setex, key, ttl_seconds, json.dumps(data)
                )
            except Exception as e:
                logging.warning(f"Error writing to Redis cache for key '{key}': {e}")
                _invalidate_redis()

        # Always persist to disk cache so restarts or lack of Redis still retain fast SWR cache
        try:
            filepath = _get_file_cache_path(key)
            tmp_filepath = filepath + f".tmp.{os.getpid()}"

            def _write():
                with open(tmp_filepath, "w", encoding="utf-8") as f:
                    json.dump(data, f)
                os.replace(tmp_filepath, filepath)

            await asyncio.to_thread(_write)
        except Exception as e:
            logging.warning(f"Error writing to file cache for key '{key}': {e}")


def set_advanced_cache(key: str, data: Any, hours: int = CACHE_DURATION_HOURS) -> None:
    """Store data in Redis cache with an expiration, and always persist to local disk cache."""
    client = _get_redis()
    if client is not None:
        try:
            ttl_seconds = int(hours * 3600)
            client.setex(key, ttl_seconds, json.dumps(data))
        except Exception as e:
            logging.warning(f"Error writing to Redis cache for key '{key}': {e}")
            _invalidate_redis()

    # Always persist to disk cache so restarts or lack of Redis still retain fast SWR cache
    try:
        filepath = _get_file_cache_path(key)
        tmp_filepath = filepath + f".tmp.{os.getpid()}"
        with open(tmp_filepath, "w", encoding="utf-8") as f:
            json.dump(data, f)
        os.replace(tmp_filepath, filepath)
    except Exception as e:
        logging.warning(f"Error writing to file cache for key '{key}': {e}")


def clear_advanced_cache(keys: Optional[List[str]] = None) -> None:
    """Clear specific keys or flush both Redis and disk cache."""
    client = _get_redis()
    if client is not None:
        try:
            if keys:
                client.delete(*keys)
                logging.info(f"Cleared Redis cache keys: {keys}")
            else:
                client.flushdb()
                logging.info("Flushed all Redis cache")
        except Exception as e:
            logging.error(f"Failed to clear Redis cache: {e}")
            _invalidate_redis()

    try:
        if keys:
            for k in keys:
                fpath = _get_file_cache_path(k)
                if os.path.exists(fpath):
                    os.remove(fpath)
        else:
            for fname in os.listdir(_CACHE_DIR):
                if fname.endswith(".json"):
                    try:
                        os.remove(os.path.join(_CACHE_DIR, fname))
                    except Exception:
                        pass
    except Exception as e:
        logging.error(f"Failed to clear file cache: {e}")


def clear_cache_by_prefix(prefixes: List[str]) -> int:
    """Delete disk-cache files whose name starts with any of `prefixes`.

    Used by ``/api/clear_cache/{year}?include_telemetry=true`` to purge the
    variable-named telemetry caches and the ``fastf1_no_laps_*`` negative
    markers, which cannot be enumerated as a fixed key list. Also drops the
    matching Redis keys (best effort — Redis keys may carry a legacy ``cache/``
    prefix). Returns the number of files removed.
    """
    removed = 0
    try:
        for name in os.listdir(_CACHE_DIR):
            if any(name.startswith(p) for p in prefixes):
                try:
                    os.remove(os.path.join(_CACHE_DIR, name))
                    removed += 1
                except OSError:
                    pass
    except OSError as e:
        logging.error(f"Failed to list cache dir for prefix purge: {e}")

    client = _get_redis()
    if client is not None:
        try:
            for p in prefixes:
                for key in client.scan_iter(match=f"{p}*"):
                    client.delete(key)
                for key in client.scan_iter(match=f"cache/{p}*"):
                    client.delete(key)
        except Exception as e:
            logging.error(f"Failed to clear Redis cache for prefixes {prefixes}: {e}")
            _invalidate_redis()

    return removed
