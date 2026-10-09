import logging
import os
import json
from datetime import datetime, timedelta
import fastf1
fastf1.Cache.enable_cache("cache")
CACHE_DURATION_HOURS = 6

# Redis Advanced Caching Setup
import redis
REDIS_URL = os.environ.get("REDIS_URL")
redis_client = None
if REDIS_URL:
    try:
        redis_client = redis.from_url(REDIS_URL)
        redis_client.ping()
        print("'? Connected to Redis for Advanced Caching!")
    except Exception as e:
        logging.error(f"Failed to connect to Redis: {e}", exc_info=True)
        redis_client = None

def get_advanced_cache(key, hours=CACHE_DURATION_HOURS):
    if redis_client:
        try:
            cached = redis_client.get(key)
            if cached:
                return json.loads(cached)
        except: pass
    if os.path.exists(key):
        file_mod_time = datetime.fromtimestamp(os.path.getmtime(key))
        if datetime.now() - file_mod_time < timedelta(hours=hours):
            with open(key, "r", encoding="utf-8") as f:
                return json.load(f)
    return None

def set_advanced_cache(key, data, hours=CACHE_DURATION_HOURS):
    if redis_client:
        try:
            redis_client.setex(key, int(hours * 3600), json.dumps(data))
        except: pass
    dirname = os.path.dirname(key)
    if dirname:
        os.makedirs(dirname, exist_ok=True)
    with open(key, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)


