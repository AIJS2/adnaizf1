# main.py

import os
import sys
from config.observability import setup_observability

# Setup Sentry and Loguru before anything else
setup_observability()

# Fix for Windows console emoji printing (guard: only meaningful on Windows,
# and sys.stdout may not expose reconfigure on every stream).
if sys.platform == "win32" and hasattr(sys.stdout, "reconfigure"):
    sys.stdout.reconfigure(encoding="utf-8")

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from slowapi.middleware import SlowAPIMiddleware
from config.limiter import limiter

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
# SlowAPIMiddleware enforces the @limiter.limit(...) decorators and the global
# default_limits. Without it the decorators are inert. Added BEFORE CORSMiddleware
# so the limit is evaluated before any other per-request work.
app.add_middleware(SlowAPIMiddleware)

# ---------------------------------------------------------------------------
# CORS — support localhost dev ports + production domain via env.
#
# Both ALLOWED_ORIGINS and CORS_ORIGINS are accepted so a mis-set variable name
# (which previously failed silently) still takes effect. Values are de-duped
# and stripped. A wildcard is rejected when credentials are allowed, since that
# combination is invalid per the CORS spec.
# ---------------------------------------------------------------------------
_raw_origins = os.environ.get("ALLOWED_ORIGINS") or os.environ.get("CORS_ORIGINS") or ""
_extra_origins = [o.strip() for o in _raw_origins.split(",") if o.strip()]

origins = list(
    dict.fromkeys(
        [
            "http://localhost:5173",   # Vite default
            "http://localhost:5174",   # Vite alternate port
            "http://127.0.0.1:5173",
            *_extra_origins,           # From environment variable
        ]
    )
)

if "*" in origins:
    raise RuntimeError(
        "CORS origin '*' is incompatible with allow_credentials=True. "
        "List explicit origins instead."
    )

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

from routers.dashboard import router as dashboard_router
from routers.races import router as races_router
from routers.race_details import router as race_details_router
from routers.telemetry import router as telemetry_router
from routers.championship import router as championship_router
from routers.profiles import router as profiles_router
from routers.system import router as system_router
from routers.livetiming import router as livetiming_router

app.include_router(dashboard_router)
app.include_router(races_router)
app.include_router(race_details_router)
app.include_router(telemetry_router)
app.include_router(championship_router)
app.include_router(profiles_router)
app.include_router(system_router)
app.include_router(livetiming_router)
