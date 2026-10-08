import re
import os

with open("Backend/main.py", "r", encoding="utf-8") as f:
    code = f.read()

# Add redis setup at the top (after imports)
redis_setup = """
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
        print(f"?O Failed to connect to Redis: {e}")
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
    os.makedirs(os.path.dirname(key), exist_ok=True)
    with open(key, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)
"""

if "get_advanced_cache" not in code:
    # Insert after CACHE_DURATION_HOURS = 6
    code = code.replace('CACHE_DURATION_HOURS = 6', 'CACHE_DURATION_HOURS = 6' + '\n' + redis_setup)

# Now, let's carefully replace the cache loading logic.
# Pattern:
# if os.path.exists(CACHE_FILE):
#     file_mod_time = ...
#     if datetime.now() - ...
#         print(...)
#         with open(CACHE_FILE, "r") as f:
#             return json.load(f)

# Because there are variations (some try/except, some different prints), it's safest to manually search & replace or write a robust regex.
# Actually, since there are only 5 endpoints, let's write exact replacements for each.

def replace_all(pattern, replacement, string):
    return re.sub(pattern, replacement, string, flags=re.DOTALL)

# 1. Dashboard Endpoint
code = replace_all(
    r'if os\.path\.exists\(CACHE_FILE\):\s+file_mod_time = datetime\.fromtimestamp\(os\.path\.getmtime\(CACHE_FILE\)\)\s+if datetime\.now\(\) - file_mod_time < timedelta\(hours=CACHE_DURATION_HOURS\):\s+print\(".*? Menyajikan data dari CACHE \(Dashboard\)\.\.\."\)\s+with open\(CACHE_FILE, "r"\) as f:\s+return json\.load\(f\)',
    r'''cached_data = get_advanced_cache(CACHE_FILE)
    if cached_data:
        print("o. Menyajikan data dari REDIS/CACHE (Dashboard)...")
        return cached_data''',
    code
)

# 2. All Races
code = replace_all(
    r'if os\.path\.exists\(CACHE_FILE\):\s+file_mod_time = datetime\.fromtimestamp\(os\.path\.getmtime\(CACHE_FILE\)\)\s+if datetime\.now\(\) - file_mod_time < timedelta\(hours=CACHE_DURATION_HOURS\):\s+print\(f"o\. Menyajikan data dari CACHE \(All Races \{year\}\)\.\.\."\)\s+with open\(CACHE_FILE, "r"\) as f:\s+return json\.load\(f\)',
    r'''cached_data = get_advanced_cache(CACHE_FILE)
    if cached_data:
        print(f"o. Menyajikan data dari REDIS/CACHE (All Races {year})...")
        return cached_data''',
    code
)

# 3. Race Detail
code = replace_all(
    r'if os\.path\.exists\(CACHE_FILE\):\s+file_mod_time = datetime\.fromtimestamp\(os\.path\.getmtime\(CACHE_FILE\)\)\s+if datetime\.now\(\) - file_mod_time < timedelta\(hours=CACHE_DURATION_HOURS\):\s+try:\s+with open\(CACHE_FILE, "r"\) as f:\s+cached = json\.load\(f\)\s+if "sector_matrix" in cached:\s+print\(f"o\. Menyajikan data dari CACHE \(Detail Race Lengkap .*?\)\.\.\."\)\s+return cached\s+except Exception:\s+pass',
    r'''cached_data = get_advanced_cache(CACHE_FILE)
    if cached_data and "sector_matrix" in cached_data:
        print(f"o. Menyajikan data dari REDIS/CACHE (Detail Race Lengkap {year}-{round_number})...")
        return cached_data''',
    code
)

# 4. Telemetry
code = replace_all(
    r'if os\.path\.exists\(CACHE_FILE\):\s+try:\s+with open\(CACHE_FILE, "r"\) as f:\s+return json\.load\(f\)\s+except Exception:\s+pass',
    r'''cached_data = get_advanced_cache(CACHE_FILE, hours=24) # Telemetry cached longer
    if cached_data:
        print(f"o. Menyajikan data dari REDIS/CACHE (Telemetry).")
        return cached_data''',
    code
)

# 5. Championship
code = replace_all(
    r'if os\.path\.exists\(CACHE_FILE\):\s+file_mod_time = datetime\.fromtimestamp\(os\.path\.getmtime\(CACHE_FILE\)\)\s+if datetime\.now\(\) - file_mod_time < timedelta\(hours=CACHE_DURATION_HOURS\):\s+print\("o\. Menyajikan data dari CACHE \(Championship\)\.\.\."\)\s+with open\(CACHE_FILE, "r"\) as f:\s+return json\.load\(f\)',
    r'''cached_data = get_advanced_cache(CACHE_FILE)
    if cached_data:
        print("o. Menyajikan data dari REDIS/CACHE (Championship)...")
        return cached_data''',
    code
)

# Now replace writing to cache
code = re.sub(
    r'with open\(CACHE_FILE, "w"\) as f:\s+json\.dump\((.*?),\s*f,\s*indent=2\)',
    r'set_advanced_cache(CACHE_FILE, \1)',
    code
)
# Special case for telemetry which has os.makedirs("cache", exist_ok=True) right before with open...
code = re.sub(
    r'os\.makedirs\("cache", exist_ok=True\)\s+set_advanced_cache',
    r'set_advanced_cache',
    code
)

with open("Backend/main.py", "w", encoding="utf-8") as f:
    f.write(code)

print("Patching complete!")
