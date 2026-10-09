import logging
import os
import json
from datetime import timedelta
from typing import Any, Optional, List

import fastf1
import redis

# Enable FastF1 default file cache for its own requests (required by fastf1)
fastf1.Cache.enable_cache("cache")

CACHE_DURATION_HOURS = 6

# Modern Redis configuration with connection pooling
REDIS_URL = os.environ.get("REDIS_URL", "redis://localhost:6379/0")

# Setup robust connection pool
try:
    pool = redis.ConnectionPool.from_url(
        REDIS_URL,
        decode_responses=True,
        socket_timeout=5,
        socket_connect_timeout=5,
        retry_on_timeout=True,
        health_check_interval=30
    )
    redis_client = redis.Redis(connection_pool=pool)
    # Validate connection
    redis_client.ping()
    logging.info(f"Successfully connected to Redis cache at {REDIS_URL.split('@')[-1] if '@' in REDIS_URL else REDIS_URL}")
except Exception as e:
    logging.error(f"Failed to connect to Redis at {REDIS_URL}: {e}")
    redis_client = None

def get_advanced_cache(key: str, hours: int = CACHE_DURATION_HOURS) -> Optional[Any]:
    """Retrieve data from Redis cache."""
    if not redis_client:
        return None
    
    try:
        cached_data = redis_client.get(key)
        if cached_data:
            return json.loads(cached_data)
    except Exception as e:
        logging.warning(f"Error reading from Redis cache for key '{key}': {e}")
    
    return None

def set_advanced_cache(key: str, data: Any, hours: int = CACHE_DURATION_HOURS) -> None:
    """Store data in Redis cache with an expiration."""
    if not redis_client:
        return

    try:
        ttl_seconds = int(hours * 3600)
        # Using json.dumps to serialize complex dictionaries and lists
        redis_client.setex(key, ttl_seconds, json.dumps(data))
    except Exception as e:
        logging.warning(f"Error writing to Redis cache for key '{key}': {e}")

def clear_advanced_cache(keys: Optional[List[str]] = None) -> None:
    """Clear specific keys or flush the entire Redis database."""
    if not redis_client:
        return

    try:
        if keys:
            redis_client.delete(*keys)
            logging.info(f"Cleared cache keys: {keys}")
        else:
            redis_client.flushdb()
            logging.info("Flushed all Redis cache")
    except Exception as e:
        logging.error(f"Failed to clear Redis cache: {e}")
