# main.py 

import os
import sys
import json

# Fix for Windows console emoji printing
sys.stdout.reconfigure(encoding='utf-8')
from datetime import datetime, timedelta

import pandas as pd
import fastf1
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import traceback

app = FastAPI()

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

from routers.api import router as api_router

app.include_router(api_router)
