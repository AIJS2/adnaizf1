import logging
import os
import json
import time
from datetime import timedelta
from typing import Any, Optional, List

import fastf1
import redis

# Resolve the FastF1 on-disk cache relative to the package, not the process CWD.
# A bare "cache" only works when uvicorn is launched from Backend/; under the
# Docker image (WORKDIR /app) or `python -m`, it lands somewhere unwritable.
_CACHE_DIR = os.environ.get(
    "F1_CACHE_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cache"),
)
os.makedirs(_CACHE_DIR, exist_ok=True)

# Enable FastF1 default file cache for its own requests (required by fastf1)
fastf1.Cache.enable_cache(_CACHE_DIR)

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

def get_advanced_cache(key: str, hours: int = CACHE_DURATION_HOURS) -> Optional[Any]:
    """Retrieve data from Redis cache."""
    client = _get_redis()
    if client is None:
        return None

    try:
        cached_data = client.get(key)
        if cached_data:
            return json.loads(cached_data)
    except Exception as e:
        logging.warning(f"Error reading from Redis cache for key '{key}': {e}")
        _invalidate_redis()  # reconnect on the next call

    return None

def set_advanced_cache(key: str, data: Any, hours: int = CACHE_DURATION_HOURS) -> None:
    """Store data in Redis cache with an expiration."""
    client = _get_redis()
    if client is None:
        return

    try:
        ttl_seconds = int(hours * 3600)
        # Using json.dumps to serialize complex dictionaries and lists
        client.setex(key, ttl_seconds, json.dumps(data))
    except Exception as e:
        logging.warning(f"Error writing to Redis cache for key '{key}': {e}")
        _invalidate_redis()

def clear_advanced_cache(keys: Optional[List[str]] = None) -> None:
    """Clear specific keys or flush the entire Redis database."""
    client = _get_redis()
    if client is None:
        return

    try:
        if keys:
            client.delete(*keys)
            logging.info(f"Cleared cache keys: {keys}")
        else:
            client.flushdb()
            logging.info("Flushed all Redis cache")
    except Exception as e:
        logging.error(f"Failed to clear Redis cache: {e}")
        _invalidate_redis()
