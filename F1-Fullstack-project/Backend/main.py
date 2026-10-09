# main.py 

import os
import sys
import json
from config.observability import setup_observability

# Setup Sentry and Loguru before anything else
setup_observability()

# Fix for Windows console emoji printing
sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime, timedelta

import pandas as pd
import fastf1
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import traceback

from slowapi.errors import RateLimitExceeded
from slowapi import _rate_limit_exceeded_handler
from config.limiter import limiter

app = FastAPI()
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

# Middleware CORS — support localhost dev ports + production domain via env
import os as _os
_extra_origins = _os.environ.get("ALLOWED_ORIGINS", "").split(",")
origins = list(filter(None, [
    "http://localhost:5173",   # Vite default
    "http://localhost:5174",   # Vite alternate port
    "http://127.0.0.1:5173",
    *_extra_origins,           # Tambahan dari environment variable
]))
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Konfigurasi Cache FastF1 (tidak berubah)

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
