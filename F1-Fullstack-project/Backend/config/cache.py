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

CACHE_DURATION_HOURS = 6

# Modern Redis configuration with connection pooling
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Circuit breaker settings. Once a Redis call fails we stop hammering it and
# only retry after this cooldown, so a Redis outage degrades to "no cache"
# instead of adding a 5s timeout to every single request.
_REDIS_RETRY_COOLDOWN_SECONDS = 30.0

redis_client: Optional["redis.Redis"] = None
_redis_last_failure: float = 0.0


def _build_client() -> Optional["redis.Redis"]:
    """Create a pooled Redis client, or None when Redis is unreachable."""
    try:
        pool = redis.ConnectionPool.from_url(
            REDIS_URL,
            decode_responses=True,
            socket_timeout=5,
            socket_connect_timeout=5,
            retry_on_timeout=True,
            health_check_interval=30
        )
        client = redis.Redis(connection_pool=pool)
        client.ping()  # fail fast rather than on the first real command
        logging.info(
            f"Successfully connected to Redis cache at "
            f"{REDIS_URL.split('@')[-1] if '@' in REDIS_URL else REDIS_URL}"
        )
        return client
    except Exception as e:
        logging.error(f"Failed to connect to Redis at {REDIS_URL}: {e}")
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
    if _redis_last_failure and (now - _redis_last_failure) < _REDIS_RETRY_COOLDOWN_SECONDS:
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
        "url": REDIS_URL.split("@")[-1] if "@" in REDIS_URL else REDIS_URL,
    }


# Attempt the initial connection eagerly so a misconfigured Redis is visible
# in the startup logs rather than on the first request.
redis_client = _build_client()
if redis_client is None:
    _redis_last_failure = time.monotonic()

def _get_file_cache_path(key: str) -> str:
    """Return an absolute path inside _CACHE_DIR for the file-based fallback cache."""
    clean_name = os.path.basename(key)
    if not clean_name.endswith('.json'):
        clean_name += '.json'
    return os.path.join(_CACHE_DIR, clean_name)


def get_advanced_cache(key: str, hours: int = CACHE_DURATION_HOURS) -> Optional[Any]:
    """
    Retrieve data from Redis cache or file fallback cache.
    Returns (data) if found, otherwise None.
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
            with open(filepath, 'r', encoding='utf-8') as f:
                return json.load(f)
    except Exception as e:
        logging.warning(f"Error reading from file cache for key '{key}': {e}")

    return None


def get_advanced_cache_with_meta(key: str) -> Optional[dict]:
    """
    Retrieve cached data and its file metadata (modified_time, mtime_epoch).
    """
    data = get_advanced_cache(key)
    if data is None:
        return None

    mtime = 0.0
    try:
        filepath = _get_file_cache_path(key)
        if os.path.exists(filepath):
            mtime = os.path.getmtime(filepath)
    except Exception:
        pass

    return {
        "data": data,
        "mtime": mtime
    }


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
                if fname.endswith('.json'):
                    try:
                        os.remove(os.path.join(_CACHE_DIR, fname))
                    except Exception:
                        pass
    except Exception as e:
        logging.error(f"Failed to clear file cache: {e}")
