import logging
from fastapi import APIRouter, WebSocket, WebSocketDisconnect
import pandas as pd
import fastf1
import asyncio
import traceback
import os
import json
from datetime import datetime, timedelta
import random

from config.cache import get_advanced_cache, set_advanced_cache, clear_advanced_cache, CACHE_DURATION_HOURS
from services.scraper import apply_f1_official_standings

router = APIRouter()

def get_dashboard_cache_filename(year: int):
    return f"dashboard_cache_{year}.json"

# =======================================================================
# --- Endpoint /ws/livetiming (Live Timing Simulation) ---
# =======================================================================
@router.websocket("/ws/livetiming")
async def websocket_livetiming(websocket: WebSocket):
    await websocket.accept()
    
    # Cek apakah sedang ada sesi live berdasarkan jadwal FastF1
    try:
        now_utc = pd.to_datetime('now', utc=True)
        year = now_utc.year
        schedule = fastf1.get_event_schedule(year, include_testing=False)
        is_live_session = False
        
        for _, event in schedule.iterrows():
            for i in range(1, 6):
                date_col = f'Session{i}DateUtc'
                if date_col in event and pd.notna(event[date_col]):
                    session_start = pd.to_datetime(event[date_col], utc=True)
                    session_end = session_start + timedelta(hours=2)
                    if session_start <= now_utc <= session_end:
                        is_live_session = True
                        break
            if is_live_session:
                break
    except Exception as e:
        logging.error(f"Error checking live session: {e}")
        is_live_session = False

    drivers = ["VER", "HAD", "NOR", "PIA", "LEC", "HAM", "RUS", "ANT", "ALO", "STR", "OCO", "BEA", "SAI", "ALB", "GAS", "COL", "HUL", "BOR", "TSU", "LAW", "BOT", "PER"]
    teams = {
        "VER": "Red Bull Racing", "HAD": "Red Bull Racing",
        "NOR": "McLaren", "PIA": "McLaren",
        "LEC": "Ferrari", "HAM": "Ferrari",
        "RUS": "Mercedes", "ANT": "Mercedes",
        "ALO": "Aston Martin", "STR": "Aston Martin",
        "OCO": "Haas F1 Team", "BEA": "Haas F1 Team",
        "SAI": "Williams", "ALB": "Williams",
        "GAS": "Alpine", "COL": "Alpine",
        "HUL": "Audi", "BOR": "Audi",
        "TSU": "Racing Bulls", "LAW": "Racing Bulls",
        "BOT": "Cadillac", "PER": "Cadillac"
    }
    
    compounds = ["S", "M", "H"]
    base_lap = 90.0
    
    state = []
    overall_best = {"s1": 999.0, "s2": 999.0, "s3": 999.0, "lap": 999.0}
    
    for i, d in enumerate(drivers):
        s1 = 30.0 + (i * 0.1)
        s2 = 30.0 + (i * 0.1)
        s3 = 30.0 + (i * 0.1)
        lap = s1 + s2 + s3
        
        overall_best["s1"] = min(overall_best["s1"], s1)
        overall_best["s2"] = min(overall_best["s2"], s2)
        overall_best["s3"] = min(overall_best["s3"], s3)
        overall_best["lap"] = min(overall_best["lap"], lap)
        
        # Start everyone spaced out on the track so it looks like a race
        start_progress = 1.0 - (i * 0.04)
        if start_progress < 0: start_progress += 1.0

        state.append({
            "driver": d,
            "team": teams.get(d, "Unknown"),
            "position": i + 1,
            "gap": "LEADER" if i == 0 else f"+{lap - 90.0:.3f}s",
            "interval": "-" if i == 0 else f"+0.300s",
            "lastLap": f"1:{int(lap//60):02d}.{int((lap%60)*1000):03d}",
            "lap_time_num": lap,
            "bestLapNum": lap,
            "sector1": f"{s1:.3f}",
            "sector2": f"{s2:.3f}",
            "sector3": f"{s3:.3f}",
            "s1_num": s1, "s2_num": s2, "s3_num": s3,
            "s1_color": "green", "s2_color": "green", "s3_color": "green", "lap_color": "green",
            "tyre": random.choice(compounds),
            "tyre_age": random.randint(1, 15),
            "pits": random.randint(0, 2),
            "status": "TRACK",
            "progress": start_progress,
            "stints": []
        })
        
    messages = [
        {"time": "14:00:00", "msg": "RACE START", "type": "system"},
        {"time": "14:03:12", "msg": "OVERRIDE ENABLED", "type": "system"}
    ]
    track_status = "GREEN"
    
    try:
        while True:
            # Update loop
            for s in state:
                # Move driver forward
                speed_factor = 1.0 / s["lap_time_num"] # percent per second
                s["progress"] += speed_factor * 2.0 # 2 seconds per tick
                
                if s["progress"] >= 1.0:
                    s["progress"] -= 1.0 # crossed start/finish line
                    
                if s["status"] == "PIT":
                    s["status"] = "OUT"
                    s["stints"].append({"tyre": s["tyre"], "laps": s["tyre_age"]})
                    s["tyre"] = random.choice(compounds)
                    s["tyre_age"] = 0
                    s["pits"] += 1
                    s["lap_time_num"] += 20.0 # Pit loss
                    continue
                if s["status"] == "OUT":
                    s["status"] = "TRACK"
                    continue
                    
                if random.random() > 0.98:
                    s["status"] = "PIT"
                    s["progress"] = 0.95 # force near pit entry
                    s["s1_color"] = "yellow"
                    s["s2_color"] = "yellow"
                    s["s3_color"] = "yellow"
                    messages.insert(0, {"time": datetime.now().strftime("%H:%M:%S"), "msg": f"{s['driver']} IN PIT", "type": "pit"})
                    continue
                    
                if random.random() > 0.4:
                    s["tyre_age"] += 1
                    deg = s["tyre_age"] * 0.05
                    
                    s1 = 29.5 + random.uniform(0, 0.8) + deg
                    s2 = 29.5 + random.uniform(0, 0.8) + deg
                    s3 = 29.5 + random.uniform(0, 0.8) + deg
                    lap = s1 + s2 + s3
                    
                    s["lap_time_num"] = lap
                    
                    s["s1_color"] = "purple" if s1 < overall_best["s1"] else ("green" if s1 < s["s1_num"] else "yellow")
                    s["s2_color"] = "purple" if s2 < overall_best["s2"] else ("green" if s2 < s["s2_num"] else "yellow")
                    s["s3_color"] = "purple" if s3 < overall_best["s3"] else ("green" if s3 < s["s3_num"] else "yellow")
                    s["lap_color"] = "purple" if lap < overall_best["lap"] else ("green" if lap < s["bestLapNum"] else "yellow")
                    
                    if s1 < s["s1_num"]: s["s1_num"] = s1
                    if s2 < s["s2_num"]: s["s2_num"] = s2
                    if s3 < s["s3_num"]: s["s3_num"] = s3
                    if lap < s["bestLapNum"]: s["bestLapNum"] = lap
                    
                    overall_best["s1"] = min(overall_best["s1"], s1)
                    overall_best["s2"] = min(overall_best["s2"], s2)
                    overall_best["s3"] = min(overall_best["s3"], s3)
                    overall_best["lap"] = min(overall_best["lap"], lap)
                    
                    s["lastLap"] = f"{int(lap//60)}:{lap%60:06.3f}"
                    s["sector1"] = f"{s1:.3f}"
                    s["sector2"] = f"{s2:.3f}"
                    s["sector3"] = f"{s3:.3f}"
            
            # Sort just to update gaps, but we don't change actual progress order
            sorted_state = sorted(state, key=lambda x: x["lap_time_num"] if x["status"] == "TRACK" else 999.0)
            leader_time = sorted_state[0]["lap_time_num"]
            
            for i, s_sorted in enumerate(sorted_state):
                # find original
                orig = next(x for x in state if x["driver"] == s_sorted["driver"])
                orig["position"] = i + 1
                if orig["status"] == "PIT":
                    orig["gap"] = "IN PIT"
                    orig["interval"] = "-"
                    orig["lastLap"] = "PIT"
                elif i == 0:
                    orig["gap"] = "LEADER"
                    orig["interval"] = "-"
                else:
                    gap_val = s_sorted['lap_time_num'] - leader_time
                    orig["gap"] = f"+{gap_val:.3f}s"
                    interval_val = s_sorted['lap_time_num'] - sorted_state[i-1]["lap_time_num"]
                    orig["interval"] = f"+{interval_val:.3f}s"
            
            if random.random() > 0.96:
                track_status = random.choice(["GREEN", "YELLOW (SECTOR 2)"])
                if track_status != "GREEN":
                    messages.insert(0, {"time": datetime.now().strftime("%H:%M:%S"), "msg": f"TRACK STATUS: {track_status}", "type": "flag"})
                else:
                    messages.insert(0, {"time": datetime.now().strftime("%H:%M:%S"), "msg": "CLEAR", "type": "system"})
                    
            await websocket.send_json({
                "type": "TimingData",
                "is_live_session": is_live_session,
                "lines": state, # Send original list so progress animation doesn't jitter on re-sorts
                "trackStatus": track_status,
                "weather": {
                    "air": f"{28 + random.uniform(-1, 1):.1f}°C",
                    "track": f"{42 + random.uniform(-2, 2):.1f}°C",
                    "humidity": f"{60 + random.randint(-5, 5)}%",
                    "rain": "0%"
                },
                "messages": messages[:20]
            })
            
            await asyncio.sleep(2.0)
            
    except WebSocketDisconnect:
        print("Client disconnected from Live Timing")
