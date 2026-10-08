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
fastf1.Cache.enable_cache("cache")
CACHE_DURATION_HOURS = 6

def apply_f1_official_standings(data):
    import json
    import os
    import urllib.request
    from bs4 import BeautifulSoup

    year = data.get('year')
    if not year:
        return data
    
    official_drivers = {}
    official_teams = {}
    
    try:
        # Scrape Teams
        req_teams = urllib.request.Request(f'https://www.formula1.com/en/results/{year}/team', headers={'User-Agent': 'Mozilla/5.0'})
        html_teams = urllib.request.urlopen(req_teams).read().decode('utf-8')
        soup_teams = BeautifulSoup(html_teams, 'html.parser')
        table_teams = soup_teams.find('table')
        if table_teams:
            for row in table_teams.find_all('tr')[1:]:
                cols = row.find_all(['th', 'td'])
                if len(cols) >= 3:
                    t_name = cols[1].text.strip()
                    t_points = float(cols[2].text.strip())
                    official_teams[t_name] = t_points

        # Scrape Drivers
        req_drv = urllib.request.Request(f'https://www.formula1.com/en/results/{year}/drivers', headers={'User-Agent': 'Mozilla/5.0'})
        html_drv = urllib.request.urlopen(req_drv).read().decode('utf-8')
        soup_drv = BeautifulSoup(html_drv, 'html.parser')
        table_drv = soup_drv.find('table')
        if table_drv:
            for row in table_drv.find_all('tr')[1:]:
                cols = row.find_all(['th', 'td'])
                if len(cols) >= 5:
                    d_name = cols[1].text.strip().replace('\xa0', ' ')
                    # Clean up abbreviations appended to name like "Kimi AntonelliANT"
                    if d_name.endswith('ANT'): d_name = 'Kimi Antonelli'
                    elif d_name.endswith('RUS'): d_name = 'George Russell'
                    elif d_name.endswith('HAM'): d_name = 'Lewis Hamilton'
                    elif d_name.endswith('LEC'): d_name = 'Charles Leclerc'
                    elif d_name.endswith('NOR'): d_name = 'Lando Norris'
                    elif d_name.endswith('VER'): d_name = 'Max Verstappen'
                    elif d_name.endswith('PIA'): d_name = 'Oscar Piastri'
                    elif d_name.endswith('HAD'): d_name = 'Isack Hadjar'
                    elif d_name.endswith('LAW'): d_name = 'Liam Lawson'
                    elif d_name.endswith('GAS'): d_name = 'Pierre Gasly'
                    elif d_name.endswith('LIN'): d_name = 'Arvid Lindblad'
                    elif d_name.endswith('COL'): d_name = 'Franco Colapinto'
                    elif d_name.endswith('BEA'): d_name = 'Oliver Bearman'
                    elif d_name.endswith('BOR'): d_name = 'Gabriel Bortoleto'
                    elif d_name.endswith('HUL'): d_name = 'Nico Hulkenberg'
                    elif d_name.endswith('OCO'): d_name = 'Esteban Ocon'
                    elif d_name.endswith('ALO'): d_name = 'Fernando Alonso'
                    elif d_name.endswith('SAI'): d_name = 'Carlos Sainz'
                    elif d_name.endswith('ALB'): d_name = 'Alexander Albon'
                    elif d_name.endswith('TSU'): d_name = 'Yuki Tsunoda'
                    elif d_name.endswith('STR'): d_name = 'Lance Stroll'
                    elif d_name.endswith('BOT'): d_name = 'Valtteri Bottas'
                    elif d_name.endswith('PER'): d_name = 'Sergio Perez'
                    
                    d_points = float(cols[4].text.strip())
                    official_drivers[d_name] = d_points
                    
        print(f"--> Live Scrape F1.com Success! Drivers: {len(official_drivers)}, Teams: {len(official_teams)}")
        
    except Exception as e:
        print(f"--> Live Scrape failed for {year}, trying local fallback. Error:", e)
        fallback_file = f'f1_official_standings_{year}.json'
        if os.path.exists(fallback_file):
            with open(fallback_file, 'r') as f:
                official = json.load(f)
                official_teams = official.get('teams', {})
                official_drivers = official.get('drivers', {})

    if not official_teams and not official_drivers:
        return data # Fallback to FastF1

    try:
        # Update dashboard data
        if 'team_standings' in data:
            for t in data['team_standings']:
                if t['name'] in official_teams:
                    t['points'] = official_teams[t['name']]
            data['team_standings'] = sorted(data['team_standings'], key=lambda x: x['points'], reverse=True)
        if 'driver_standings' in data:
            for d in data['driver_standings']:
                if d['name'] in official_drivers:
                    d['points'] = official_drivers[d['name']]
            data['driver_standings'] = sorted(data['driver_standings'], key=lambda x: x['points'], reverse=True)
            
        # Update championship data
        if 'teams' in data:
            for t in data['teams']:
                if t['name'] in official_teams:
                    t['points'] = official_teams[t['name']]
            data['teams'] = sorted(data['teams'], key=lambda x: x['points'], reverse=True)
            for i, t in enumerate(data['teams']): t['position'] = i + 1
        if 'drivers' in data:
            for d in data['drivers']:
                if d['name'] in official_drivers:
                    d['points'] = official_drivers[d['name']]
            data['drivers'] = sorted(data['drivers'], key=lambda x: x['points'], reverse=True)
            for i, d in enumerate(data['drivers']): d['position'] = i + 1
    except Exception as e:
        print('Failed to apply official standings:', e)
        
    return data


def get_dashboard_cache_filename(year: int):
    return f"dashboard_cache_{year}.json"

# =======================================================================
# --- Endpoint Dashboard (DENGAN PENAMBAHAN LOGIKA COUNTDOWN) ---
# =======================================================================
@app.get("/api/dashboard/{year}")
def get_dashboard_data(year: int):
    CACHE_FILE = get_dashboard_cache_filename(year)
    if os.path.exists(CACHE_FILE):
        file_mod_time = datetime.fromtimestamp(os.path.getmtime(CACHE_FILE))
        if datetime.now() - file_mod_time < timedelta(hours=CACHE_DURATION_HOURS):
            print("✅ Menyajikan data dari CACHE (Dashboard)...")
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
    try:
        print("⚙️ Menghitung data Dashboard...")
        today = pd.to_datetime("today").normalize()
        now_utc = pd.to_datetime('now', utc=True)

        schedule = fastf1.get_event_schedule(year, include_testing=False)
        official_races = schedule[schedule["EventName"].str.contains("Grand Prix", na=False)]
        completed_races = official_races[official_races["EventDate"].dt.normalize() < today].copy()
        ongoing_races = official_races[official_races["EventDate"].dt.normalize() == today].copy()
        upcoming_races = official_races[official_races["EventDate"].dt.normalize() > today].copy()
        
        # Penanganan Pra-Musim (sudah diupdate dengan logika countdown)
        if completed_races.empty and ongoing_races.empty:
            print(f"  -> Musim {year} belum dimulai. Mengirim status pre_season.")
            pre_season_data = {
                "year": year,
                "status": "pre_season",
                "message": f"The {year} season has not started yet. Data will be available after the first race.",
                "team_standings": [],
                "driver_standings": [],
                "race_analytics": [],
                "next_race_event": None 
            }
            # Logika mencari next race event untuk pra-musim
            next_event_for_preseason = None
            for _, event in schedule.iterrows():
                event_found = False
                for i in range(1, 6):
                    session_date_col = f'Session{i}Date'
                    if session_date_col in event and pd.notna(event[session_date_col]):
                        session_date = pd.to_datetime(event[session_date_col], utc=True)
                        if session_date > now_utc:
                            next_event_for_preseason = {"name": f"{event['EventName']} - {event[f'Session{i}']}", "date": session_date.isoformat()}
                            event_found = True
                            break
                if event_found:
                    break
            pre_season_data["next_race_event"] = next_event_for_preseason
            with open(CACHE_FILE, "w") as f:
                json.dump(pre_season_data, f, indent=2)
            return pre_season_data

        last_race = completed_races.iloc[-1] if not completed_races.empty else None
        last_race_name = last_race["EventName"] if last_race is not None else "N/A"
        last_race_round = last_race["RoundNumber"] if last_race is not None else 0
        if last_race is not None:
            print(f"  -> Balapan terakhir teridentifikasi: {last_race_name} (Ronde {last_race_round})")
        
        all_driver_results = []
        last_race_driver_results = []
        races_to_process = pd.concat([completed_races, ongoing_races])
        for index, race in races_to_process.iterrows():
            is_last_race = last_race is not None and race["RoundNumber"] == last_race_round
            sessions_to_check = ["R", "Sprint"]
            for session_type in sessions_to_check:
                try:
                    session = fastf1.get_session(year, race["RoundNumber"], session_type)
                    session.load(telemetry=False, weather=False, laps=False, messages=False)
                    if hasattr(session, "results") and not session.results.empty:
                        needed = ["FirstName", "LastName", "TeamName", "Points"]
                        if all(c in session.results.columns for c in needed):
                            sub = session.results[needed].copy()
                            sub["Points"] = pd.to_numeric(sub["Points"], errors="coerce").fillna(0.0)
                            all_driver_results.append(sub)
                            if is_last_race:
                                last_race_driver_results.append(sub)
                except Exception:
                    continue
        
        # Inisialisasi final_data di awal, tambahkan kunci 'next_race_event'
        final_data = { "year": year, "last_race_name": last_race_name, "team_standings": [], "driver_standings": [], "race_analytics": [], "next_race_event": None, "total_races": len(official_races) }

        if all_driver_results:
            df_all_drivers = pd.concat(all_driver_results, ignore_index=True)
            print(f"DEBUG DASHBOARD: total session rows = {len(df_all_drivers)}")
            df_all_teams = df_all_drivers[['TeamName', 'Points']]
            total_team_standings = df_all_teams.groupby("TeamName", as_index=False)["Points"].sum()
            if last_race_driver_results:
                df_last_race = pd.concat(last_race_driver_results, ignore_index=True)
                df_last_race_teams = df_last_race[['TeamName', 'Points']]
                last_race_team_points = df_last_race_teams.groupby("TeamName", as_index=False)["Points"].sum()
                last_race_team_points.rename(columns={"Points": "points_last_race"}, inplace=True)
                dashboard_teams = pd.merge(total_team_standings, last_race_team_points, on="TeamName", how="left")
                dashboard_teams["points_last_race"] = dashboard_teams["points_last_race"].fillna(0).astype(int)
            else:
                dashboard_teams = total_team_standings.copy()
                dashboard_teams["points_last_race"] = 0
            dashboard_teams = dashboard_teams.sort_values(by="Points", ascending=False).reset_index(drop=True)
            dashboard_teams.rename(columns={"TeamName": "name", "Points": "points"}, inplace=True)
            df_all_drivers.dropna(subset=['FirstName', 'LastName'], inplace=True)
            df_all_drivers['FullName'] = df_all_drivers['FirstName'] + ' ' + df_all_drivers['LastName']
            dashboard_drivers = df_all_drivers.groupby('FullName').agg(points=('Points', 'sum'), team=('TeamName', 'last')).reset_index()
            dashboard_drivers = dashboard_drivers.sort_values(by="points", ascending=False).reset_index(drop=True)
            dashboard_drivers.rename(columns={"FullName": "name"}, inplace=True)
            final_data["team_standings"] = dashboard_teams.to_dict(orient="records")
            final_data["driver_standings"] = dashboard_drivers.to_dict(orient="records")
        
        # =======================================================================
        # --- START LOGIKA BARU DITAMBAHKAN: Mencari Sesi Balapan Selanjutnya ---
        # =======================================================================
        next_race_event = None
        for _, event in schedule.iterrows():
            event_found = False
            for i in range(1, 6):
                session_name_col = f'Session{i}'
                session_date_col = f'Session{i}Date'
                if session_date_col in event and pd.notna(event[session_date_col]):
                    session_date = pd.to_datetime(event[session_date_col], utc=True)
                    if session_date > now_utc:
                        next_race_event = {
                            "name": f"{event['EventName']} - {event[session_name_col]}",
                            "date": session_date.isoformat()
                        }
                        event_found = True
                        break
            if event_found:
                break
        
        if next_race_event:
            print(f"  -> Sesi selanjutnya ditemukan: {next_race_event['name']} pada {next_race_event['date']}")
            final_data["next_race_event"] = next_race_event
        else:
            print(f"  -> Tidak ada sesi balapan selanjutnya di musim {year}.")
        # =======================================================================
        # --- END LOGIKA BARU ---
        # =======================================================================

        race_analytics = []
        races_for_analytics = pd.concat([completed_races.tail(2), ongoing_races.head(1), upcoming_races.head(1)])
        for _, race in races_for_analytics.iterrows():
            race_date = race["EventDate"].normalize()
            status = "Finished"
            if race_date > today: status = "Upcoming"
            elif race_date == today: status = "Ongoing"
            race_info = {
                "round": int(race["RoundNumber"]), "name": race["EventName"], "date": race["EventDate"].strftime('%Y-%m-%d'),
                "location": race["Location"], "status": status, "winner": None
            }
            if race_info["status"] == "Finished":
                try:
                    session = fastf1.get_session(year, race["RoundNumber"], "R")
                    session.load(laps=False, telemetry=False, weather=False, messages=False)
                    winner_data = session.results.iloc[0]
                    race_info["winner"] = f"{winner_data['FirstName']} {winner_data['LastName']}"
                except Exception:
                    race_info["winner"] = "Data not available"
            if not any(d['name'] == race_info['name'] for d in race_analytics):
                 race_analytics.append(race_info)
        final_data["race_analytics"] = race_analytics
        final_data = apply_f1_official_standings(final_data)
        with open(CACHE_FILE, "w") as f:
            json.dump(final_data, f, indent=2)
        print("✅ Perhitungan Dashboard selesai. Data disimpan ke cache.")
        return final_data
    except Exception as e:
        print(f"❌ Error saat menghitung data dashboard: {e}")
        traceback.print_exc()
        return {"error": f"Gagal menghitung data dashboard: {str(e)}"}


# =======================================================================
# --- Endpoint All Races (DENGAN PERBAIKAN JADWAL KOSONG) ---
# =======================================================================
@app.get("/api/races/{year}")
async def get_all_races_for_year(year: int):
    CACHE_FILE = f"all_races_cache_{year}.json"
    if os.path.exists(CACHE_FILE):
        file_mod_time = datetime.fromtimestamp(os.path.getmtime(CACHE_FILE))
        if datetime.now() - file_mod_time < timedelta(hours=CACHE_DURATION_HOURS):
            print(f"✅ Menyajikan data dari CACHE (All Races {year})...")
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
    try:
        print(f"⚙️ Menghitung data SEMUA BALAPAN untuk tahun {year}...")
        today = pd.to_datetime("today").normalize()
        schedule = fastf1.get_event_schedule(year, include_testing=False)
        official_races = schedule[schedule["EventName"].str.contains("Grand Prix", na=False)]
        
        if official_races.empty:
            print(f"  -> Tidak ada jadwal resmi ditemukan untuk {year}. Mengembalikan array kosong.")
            return [] 
            
        all_races_data = []
        for _, race in official_races.iterrows():
            race_date = race["EventDate"].normalize()
            status = "Finished"
            if race_date > today: status = "Upcoming"
            elif race_date == today: status = "Ongoing"
            race_info = { "round": race["RoundNumber"], "name": race["EventName"], "location": race["Location"], "country": race["Country"], "date": race["EventDate"].strftime('%Y-%m-%d'), "status": status, "winner": None, "winner_team": None }
            if status == "Finished":
                try:
                    session = fastf1.get_session(year, race["RoundNumber"], "R")
                    session.load(telemetry=False, weather=False, messages=False, laps=False)
                    if hasattr(session, 'results') and not session.results.empty:
                        winner_data = session.results.iloc[0]
                        race_info["winner"] = f"{winner_data['FirstName']} {winner_data['LastName']}"
                        race_info["winner_team"] = winner_data['TeamName']
                except Exception as e:
                    print(f"  -> Gagal mengambil data pemenang untuk {race['EventName']}: {e}")
                    race_info["winner"] = "Data not available"
            all_races_data.append(race_info)
        with open(CACHE_FILE, "w") as f:
            json.dump(all_races_data, f, indent=2)
        print(f"✅ Perhitungan SEMUA BALAPAN untuk {year} selesai.")
        return all_races_data
    except Exception as e:
        print(f"❌ Error saat menghitung semua balapan: {e}")
        traceback.print_exc()
        return {"error": str(e)}

# =======================================================================
# --- ENDPOINT DETAIL BALAPAN (DENGAN PERBAIKAN LOGO) ---
# =======================================================================
@app.get("/api/race/{year}/{round_number}")
async def get_race_details(year: int, round_number: int):
    CACHE_FILE = f"race_detail_cache_{year}_{round_number}.json"
    if os.path.exists(CACHE_FILE):
        file_mod_time = datetime.fromtimestamp(os.path.getmtime(CACHE_FILE))
        if datetime.now() - file_mod_time < timedelta(hours=CACHE_DURATION_HOURS):
            try:
                with open(CACHE_FILE, "r") as f:
                    cached = json.load(f)
                    if "sector_matrix" in cached:
                        print(f"✅ Menyajikan data dari CACHE (Detail Race Lengkap {year}-{round_number})...")
                        return cached
            except Exception:
                pass

    try:
        print(f"⚙️ Menghitung data DETAIL SUPER LENGKAP untuk {year} Ronde {round_number}...")
        
        def format_lap_time(delta):
            if pd.isna(delta): return ""
            total_seconds = delta.total_seconds()
            hours, remainder = divmod(total_seconds, 3600)
            minutes, seconds = divmod(remainder, 60)
            seconds_str = f"{seconds:06.3f}"
            if hours > 0: return f"{int(hours)}:{int(minutes):02d}:{seconds_str}"
            else: return f"{int(minutes)}:{seconds_str}"

        def format_gap(delta):
            if pd.isna(delta) or delta.total_seconds() <= 0: return ""
            return f"+{delta.total_seconds():.3f}s"

        def process_practice_session(session):
            if not hasattr(session, 'laps') or session.laps.empty:
                return []
            
            laps = session.laps
            drivers = pd.unique(laps['Driver'])
            
            results = []
            for drv in drivers:
                drv_laps = laps.pick_drivers(drv)
                if drv_laps.empty:
                    continue
                
                fastest_lap = drv_laps.pick_fastest()
                
                if fastest_lap is None:
                    continue

                driver_info = session.get_driver(drv)

                results.append({
                    'DriverNumber': driver_info['DriverNumber'],
                    'FullName': driver_info['FullName'],
                    'TeamName': driver_info['TeamName'],
                    'LapTime': fastest_lap['LapTime'],
                    'Laps': len(drv_laps)
                })

            if not results: return []

            df_results = pd.DataFrame(results)
            df_final = df_results.sort_values(by="LapTime").reset_index(drop=True)

            practice_data = []
            for index, row in df_final.iterrows():
                practice_data.append({
                    "position": index + 1,
                    "driver_number": int(row['DriverNumber']),
                    "full_name": row['FullName'],
                    "team_name": row['TeamName'],
                    "time": format_lap_time(row['LapTime']),
                    "laps": int(row['Laps'])
                })
            return practice_data

        available_sessions = {}
        schedule = fastf1.get_event_schedule(year)
        
        event_df = schedule[schedule["RoundNumber"] == round_number]
        if event_df.empty:
            return {"error": f"Round {round_number} not found for year {year}. The schedule may be incomplete or the round does not exist."}
        event = event_df.iloc[0]
        
        # --- FAST EXIT UNTUK BALAPAN MASA DEPAN (Mencegah timeout FastF1) ---
        today = pd.to_datetime("today").normalize()
        event_date = pd.to_datetime(event["EventDate"]).normalize()
        if today < (event_date - timedelta(days=3)):
            print(f"  ⚡ Balapan {event['EventName']} masih di masa depan ({event['EventDate'].strftime('%Y-%m-%d')}). Returning instant response.")
            final_data = {
                "race_info": { "name": event['EventName'], "location": event['Location'], "country": str(event.get('Country', '')) },
                "status": "Upcoming",
                "message": "Sesi balapan ini belum dimulai. Data sesi akan tersedia setelah sesi selesai.",
                "available_tabs": [],
                "race_winner": None, "pole_position": None, "fastest_lap": None,
                "results": None, "starting_grid": None, "qualifying_results": None,
                "sprint_results": None, "sprint_grid_results": None, "sprint_qualifying_results": None,
                "practice1_results": None, "practice2_results": None, "practice3_results": None,
                "tyre_strategy": None, "weather_info": None
            }
            with open(CACHE_FILE, "w") as f:
                json.dump(final_data, f, indent=2)
            return final_data

        SESSION_MAP = {
            'Practice 1': 'FP1', 'Practice 2': 'FP2', 'Practice 3': 'FP3',
            'Qualifying': 'Q', 'Sprint Qualifying': 'SQ', 'Sprint': 'S', 'Race': 'R'
        }
        
        now_utc = pd.to_datetime("now", utc=True)
        for i in range(1, 6):
            session_key = f'Session{i}'
            date_key = f'Session{i}DateUtc' if f'Session{i}DateUtc' in event else f'Session{i}Date'
            if session_key in event and pd.notna(event[session_key]):
                name = event[session_key]
                if name in SESSION_MAP:
                    # Lewati sesi jika waktu mulainya masih di masa depan
                    if date_key in event and pd.notna(event[date_key]):
                        try:
                            s_date = pd.to_datetime(event[date_key])
                            if s_date.tz is None:
                                s_date = s_date.tz_localize("UTC")
                            if s_date > now_utc:
                                print(f"  ⚡ Sesi '{name}' belum berlangsung ({s_date}). Melewati.")
                                continue
                        except Exception:
                            pass
                    try:
                        session_obj = fastf1.get_session(year, round_number, SESSION_MAP[name])
                        session_obj.load(laps=True, telemetry=False, weather=True, messages=True)
                        available_sessions[name] = session_obj
                        print(f"  -> Sesi '{name}' ditemukan dan dimuat (dengan laps & messages).")
                    except Exception as e:
                        print(f"  -> Gagal memuat sesi '{name}': {e}")
        
        pole_sitter_info, race_winner_info, results, fastest_lap_info, starting_grid, qualifying_results, sprint_results, sprint_grid_results, sprint_qualifying_results = None, None, [], None, [], [], [], [], []
        practice1_results, practice2_results, practice3_results = [], [], []
        available_tabs = []

        if 'Practice 1' in available_sessions:
            practice1_results = process_practice_session(available_sessions['Practice 1'])
            if practice1_results: available_tabs.append('Practice 1')

        if 'Practice 2' in available_sessions:
            practice2_results = process_practice_session(available_sessions['Practice 2'])
            if practice2_results: available_tabs.append('Practice 2')
        
        if 'Practice 3' in available_sessions:
            practice3_results = process_practice_session(available_sessions['Practice 3'])
            if practice3_results: available_tabs.append('Practice 3')

        if 'Qualifying' in available_sessions and hasattr(available_sessions['Qualifying'], 'results') and not available_sessions['Qualifying'].results.empty:
            available_tabs.append('Qualifying')
            qual_session = available_sessions['Qualifying']
            qual_session.results['FullName'] = qual_session.results['FirstName'] + ' ' + qual_session.results['LastName']
            pole_sitter_result = qual_session.results.iloc[0]
            pole_time = min((t for t in [pole_sitter_result.get('Q1'), pole_sitter_result.get('Q2'), pole_sitter_result.get('Q3')] if pd.notna(t)), default=None)
            pole_sitter_info = { "full_name": pole_sitter_result['FullName'], "time": format_lap_time(pole_time) }
            for index, (_, res) in enumerate(qual_session.results.iterrows()):
                position = index + 1
                driver_number = int(res['DriverNumber']) if pd.notna(res['DriverNumber']) else 0
                best_lap_time = min((t for t in [res.get('Q1'), res.get('Q2'), res.get('Q3')] if pd.notna(t)), default=None)
                laps_count = len(qual_session.laps.pick_drivers(res['Abbreviation'])) if hasattr(qual_session, 'laps') and not qual_session.laps.pick_drivers(res['Abbreviation']).empty else 0
                qualifying_results.append({ "position": position, "driver_number": driver_number, "full_name": res['FullName'], "team_name": res['TeamName'], "q1": format_lap_time(res.get('Q1')), "q2": format_lap_time(res.get('Q2')), "q3": format_lap_time(res.get('Q3')), "time": format_lap_time(best_lap_time), "laps": laps_count })

        sprint_qual_times = {}
        if 'Sprint Qualifying' in available_sessions and hasattr(available_sessions['Sprint Qualifying'], 'results') and not available_sessions['Sprint Qualifying'].results.empty:
            available_tabs.append('Sprint Qualifying')
            sprint_qual_session = available_sessions['Sprint Qualifying']
            sprint_qual_session.results['FullName'] = sprint_qual_session.results['FirstName'] + ' ' + sprint_qual_session.results['LastName']
            
            for index, (_, res) in enumerate(sprint_qual_session.results.iterrows()):
                position = index + 1
                driver_number = int(res['DriverNumber']) if pd.notna(res['DriverNumber']) else 0
                
                q1_time = res.get('Q1', res.get('SQ1'))
                q2_time = res.get('Q2', res.get('SQ2'))
                q3_time = res.get('Q3', res.get('SQ3'))
                best_lap_time = min((t for t in [q1_time, q2_time, q3_time] if pd.notna(t)), default=None)
                
                laps_count = len(sprint_qual_session.laps.pick_drivers(res['Abbreviation'])) if hasattr(sprint_qual_session, 'laps') and not sprint_qual_session.laps.pick_drivers(res['Abbreviation']).empty else 0
                
                if pd.notna(driver_number):
                    sprint_qual_times[driver_number] = best_lap_time

                sprint_qualifying_results.append({ 
                    "position": position, "driver_number": driver_number, "full_name": res['FullName'], "team_name": res['TeamName'], 
                    "q1": format_lap_time(q1_time), "q2": format_lap_time(q2_time), "q3": format_lap_time(q3_time), 
                    "time": format_lap_time(best_lap_time), "laps": laps_count 
                })

        if 'Sprint' in available_sessions and hasattr(available_sessions['Sprint'], 'results') and not available_sessions['Sprint'].results.empty:
            available_tabs.extend(['Sprint Grid', 'Sprint'])
            sprint_session = available_sessions['Sprint']
            sprint_session.results['FullName'] = sprint_session.results['FirstName'] + ' ' + sprint_session.results['LastName']
            
            sprint_grid_df = sprint_session.results.sort_values(by="GridPosition")
            for _, res in sprint_grid_df.iterrows():
                grid_pos = int(res['GridPosition'])
                if grid_pos > 0:
                    driver_num = int(res['DriverNumber']) if pd.notna(res['DriverNumber']) else 0
                    qual_time = sprint_qual_times.get(driver_num)
                    sprint_grid_results.append({
                        "grid_position": grid_pos,
                        "driver_number": driver_num,
                        "full_name": res['FullName'],
                        "team_name": res['TeamName'],
                        "time": format_lap_time(qual_time)
                    })

            leader = sprint_session.results.iloc[0]
            leader_time, max_laps = leader.get('Time'), int(leader.get('Laps', 0))
            for index, (_, res) in enumerate(sprint_session.results.iterrows()):
                position = index + 1
                driver_number = int(res['DriverNumber']) if pd.notna(res['DriverNumber']) else 0
                current_laps = int(res.get('Laps', 0))
                time_display, gap_display, interval_display = res['Status'], "", ""
                if current_laps == max_laps and pd.notna(res.get('Time')):
                    total_time, gap, interval = None, None, None
                    if position == 1: total_time = res['Time']
                    else:
                        gap = res['Time']
                        if pd.notna(leader_time): total_time = leader_time + gap
                        if position == 2: interval = gap
                        else:
                            ahead_row = sprint_session.results.loc[sprint_session.results['Position'] == (position - 1)]
                            if not ahead_row.empty:
                                ahead = ahead_row.iloc[0]
                                if pd.notna(ahead.get('Time')): interval = gap - ahead.get('Time')
                    time_display, gap_display, interval_display = format_lap_time(total_time), format_gap(gap), format_gap(interval)
                else:
                    if position > 1:
                        ahead_row = sprint_session.results.loc[sprint_session.results['Position'] == (position - 1)]
                        if not ahead_row.empty:
                            ahead = ahead_row.iloc[0]
                            lap_diff = int(ahead.get('Laps', 0)) - current_laps
                            if lap_diff > 0: interval_display = f"+{lap_diff} Lap" + ("s" if lap_diff > 1 else "")
                sprint_results.append({ "position": position, "driver_number": driver_number, "full_name": res['FullName'], "team_name": res['TeamName'], "status": res['Status'], "points": int(res.get('Points', 0)), "laps": current_laps, "time": time_display, "gap_to_leader": gap_display, "interval": interval_display })
        
        if 'Race' in available_sessions and hasattr(available_sessions['Race'], 'results') and not available_sessions['Race'].results.empty:
            available_tabs.extend(['Starting Grid', 'Race'])
            race_session = available_sessions['Race']
            race_session.results['FullName'] = race_session.results['FirstName'] + ' ' + race_session.results['LastName']
            leader = race_session.results.iloc[0]
            leader_time, max_laps = leader.get('Time'), int(leader.get('Laps', 0))
            race_winner_info = { "full_name": leader['FullName'], "time": format_lap_time(leader_time) }
            grid_df = race_session.results.sort_values(by="GridPosition")
            for _, res in grid_df.iterrows():
                grid_position = int(res['GridPosition']) if pd.notna(res['GridPosition']) else 0
                driver_number = int(res['DriverNumber']) if pd.notna(res['DriverNumber']) else 0
                if grid_position > 0:
                    starting_grid.append({ "grid_position": grid_position, "driver_number": driver_number, "full_name": res['FullName'], "team_name": res['TeamName'] })
            for index, (_, res) in enumerate(race_session.results.iterrows()):
                position = index + 1
                driver_number = int(res['DriverNumber']) if pd.notna(res['DriverNumber']) else 0
                current_laps = int(res.get('Laps', 0))
                time_display, gap_display, interval_display = res['Status'], "", ""
                if current_laps == max_laps and pd.notna(res.get('Time')):
                    total_time, gap, interval = None, None, None
                    if position == 1: total_time = res['Time']
                    else:
                        gap = res['Time']
                        if pd.notna(leader_time): total_time = leader_time + gap
                        if position == 2: interval = gap
                        else:
                            ahead_row = race_session.results.loc[race_session.results['Position'] == (position - 1)]
                            if not ahead_row.empty:
                                ahead = ahead_row.iloc[0]
                                if pd.notna(ahead.get('Time')): interval = gap - ahead.get('Time')
                    time_display, gap_display, interval_display = format_lap_time(total_time), format_gap(gap), format_gap(interval)
                else:
                    if position > 1:
                        ahead_row = race_session.results.loc[race_session.results['Position'] == (position - 1)]
                        if not ahead_row.empty:
                            ahead = ahead_row.iloc[0]
                            lap_diff = int(ahead.get('Laps', 0)) - current_laps
                            if lap_diff > 0: interval_display = f"+{lap_diff} Lap" + ("s" if lap_diff > 1 else "")
                results.append({ "position": position, "abbreviation": str(res.get('Abbreviation', '')), "driver_number": driver_number, "full_name": res['FullName'], "team_name": res['TeamName'], "status": res['Status'], "points": int(res.get('Points', 0)), "laps": current_laps, "time": time_display, "gap_to_leader": gap_display, "interval": interval_display })
            
            fastest = race_session.laps.pick_fastest()
            if fastest is not None:
                driver_lookup = race_session.results.loc[race_session.results['Abbreviation'] == fastest['Driver']]
                if not driver_lookup.empty:
                    driver_data = driver_lookup.iloc[0]
                    fastest_lap_info = {
                        "full_name": driver_data['FullName'], "team_name": driver_data['TeamName'],
                        "lap_time": format_lap_time(fastest['LapTime']), "lap_number": int(fastest['LapNumber'])
                    }

            # --- EXTRACT TYRE STRATEGY PRO & PIT STOPS ---
            tyre_strategy = []
            if not race_session.laps.empty and hasattr(race_session, 'results') and not race_session.results.empty:
                try:
                    for _, drv_row in race_session.results.iterrows():
                        abbr = str(drv_row.get('Abbreviation', ''))
                        full_name = str(drv_row.get('FullName', ''))
                        team_name = str(drv_row.get('TeamName', ''))
                        pos = int(drv_row.get('Position', 99)) if pd.notna(drv_row.get('Position')) else 99
                        dr_num = int(drv_row.get('DriverNumber', 0)) if pd.notna(drv_row.get('DriverNumber')) else 0
                        
                        dr_laps = race_session.laps.pick_driver(abbr)
                        if not dr_laps.empty:
                            stints = []
                            current_stint = None
                            for _, lap in dr_laps.sort_values('LapNumber').iterrows():
                                compound = str(lap.get('Compound', 'UNKNOWN')).upper()
                                stint_num = int(lap.get('Stint', 1)) if pd.notna(lap.get('Stint')) else 1
                                lap_num = int(lap.get('LapNumber', 0)) if pd.notna(lap.get('LapNumber')) else 0

                                if current_stint is None:
                                    current_stint = {
                                        "stint": stint_num,
                                        "compound": compound,
                                        "start_lap": lap_num,
                                        "end_lap": lap_num,
                                        "laps": 1
                                    }
                                elif current_stint["stint"] == stint_num and current_stint["compound"] == compound:
                                    current_stint["end_lap"] = lap_num
                                    current_stint["laps"] += 1
                                else:
                                    stints.append(current_stint)
                                    current_stint = {
                                        "stint": stint_num,
                                        "compound": compound,
                                        "start_lap": lap_num,
                                        "end_lap": lap_num,
                                        "laps": 1
                                    }
                            if current_stint is not None:
                                stints.append(current_stint)

                            # Pit stop laps
                            pit_laps = []
                            if 'PitInTime' in dr_laps.columns:
                                pit_rows = dr_laps[dr_laps['PitInTime'].notna()]
                                pit_laps = [int(p) for p in pit_rows['LapNumber'].tolist() if pd.notna(p)]

                            tyre_strategy.append({
                                "driver": abbr,
                                "full_name": full_name,
                                "team_name": team_name,
                                "driver_number": dr_num,
                                "position": pos,
                                "total_laps": len(dr_laps),
                                "stints": stints,
                                "pit_laps": pit_laps
                            })

                    tyre_strategy.sort(key=lambda x: x["position"])
                    if tyre_strategy:
                        available_tabs.append("Tyre Strategy")
                except Exception as e:
                    print(f"  -> Error calculating tyre strategy: {e}")

            # --- EXTRACT SPEED TRAP & SECTORS (PURPLE MATRIX) ---
            speed_traps = []
            sector_matrix = []
            try:
                if not race_session.laps.empty and hasattr(race_session, 'results') and not race_session.results.empty:
                    valid_laps = race_session.laps.dropna(subset=['Sector1Time', 'Sector2Time', 'Sector3Time'])
                    
                    overall_best_s1 = valid_laps['Sector1Time'].min() if not valid_laps.empty else None
                    overall_best_s2 = valid_laps['Sector2Time'].min() if not valid_laps.empty else None
                    overall_best_s3 = valid_laps['Sector3Time'].min() if not valid_laps.empty else None
                    
                    has_st = 'SpeedST' in race_session.laps.columns
                    has_fl = 'SpeedFL' in race_session.laps.columns

                    def fmt_sec(td):
                        if pd.isna(td) or td is None: return "-"
                        return f"{td.total_seconds():.3f}"

                    for _, drv_row in race_session.results.iterrows():
                        abbr = str(drv_row.get('Abbreviation', ''))
                        full_name = str(drv_row.get('FullName', ''))
                        team_name = str(drv_row.get('TeamName', ''))
                        dr_num = int(drv_row.get('DriverNumber', 0)) if pd.notna(drv_row.get('DriverNumber')) else 0
                        pos = int(drv_row.get('Position', 99)) if pd.notna(drv_row.get('Position')) else 99

                        dr_laps = race_session.laps.pick_driver(abbr)
                        if dr_laps.empty:
                            continue

                        # Speed trap
                        max_speed = 0.0
                        if has_st and dr_laps['SpeedST'].notna().any():
                            max_speed = float(dr_laps['SpeedST'].max())
                        elif has_fl and dr_laps['SpeedFL'].notna().any():
                            max_speed = float(dr_laps['SpeedFL'].max())

                        speed_traps.append({
                            "driver": abbr,
                            "full_name": full_name,
                            "team_name": team_name,
                            "driver_number": dr_num,
                            "speed": round(max_speed, 1),
                            "position": pos
                        })

                        # Best sectors
                        dr_valid = dr_laps.dropna(subset=['Sector1Time', 'Sector2Time', 'Sector3Time'])
                        best_s1 = dr_valid['Sector1Time'].min() if not dr_valid.empty else None
                        best_s2 = dr_valid['Sector2Time'].min() if not dr_valid.empty else None
                        best_s3 = dr_valid['Sector3Time'].min() if not dr_valid.empty else None

                        fastest_lap = dr_laps.pick_fastest()
                        actual_lap_time = fastest_lap['LapTime'] if (fastest_lap is not None and pd.notna(fastest_lap.get('LapTime'))) else None

                        ideal_lap_seconds = 0
                        if best_s1 is not None and best_s2 is not None and best_s3 is not None:
                            ideal_lap_seconds = (best_s1 + best_s2 + best_s3).total_seconds()

                        potential_gain = 0.0
                        if actual_lap_time is not None and ideal_lap_seconds > 0:
                            actual_seconds = actual_lap_time.total_seconds()
                            potential_gain = round(actual_seconds - ideal_lap_seconds, 3)

                        sector_matrix.append({
                            "driver": abbr,
                            "full_name": full_name,
                            "team_name": team_name,
                            "driver_number": dr_num,
                            "position": pos,
                            "s1": fmt_sec(best_s1),
                            "s1_purple": (best_s1 == overall_best_s1) if (best_s1 is not None and overall_best_s1 is not None) else False,
                            "s2": fmt_sec(best_s2),
                            "s2_purple": (best_s2 == overall_best_s2) if (best_s2 is not None and overall_best_s2 is not None) else False,
                            "s3": fmt_sec(best_s3),
                            "s3_purple": (best_s3 == overall_best_s3) if (best_s3 is not None and overall_best_s3 is not None) else False,
                            "ideal_lap": format_lap_time(timedelta(seconds=ideal_lap_seconds)) if ideal_lap_seconds > 0 else "-",
                            "actual_lap": format_lap_time(actual_lap_time) if actual_lap_time is not None else "-",
                            "potential_gain": potential_gain,
                            "top_speed": round(max_speed, 1)
                        })

                    speed_traps.sort(key=lambda x: x["speed"], reverse=True)
                    for idx, item in enumerate(speed_traps):
                        item["rank"] = idx + 1

                    sector_matrix.sort(key=lambda x: x["position"])

                    if speed_traps or sector_matrix:
                        available_tabs.append("Speed & Sectors")
            except Exception as e:
                print(f"  -> Error calculating speed traps & sectors: {e}")

            weather_info = []
            if hasattr(race_session, 'weather_data') and race_session.weather_data is not None and not race_session.weather_data.empty:
                for _, row in race_session.weather_data.iterrows():
                    time_delta = row.get('Time')
                    minutes = 0
                    if pd.notna(time_delta):
                        minutes = time_delta.total_seconds() / 60.0
                    
                    weather_info.append({
                        "time_offset": round(minutes, 1),
                        "air_temp": float(row.get('AirTemp', 0)),
                        "track_temp": float(row.get('TrackTemp', 0)),
                        "humidity": float(row.get('Humidity', 0)),
                        "rainfall": bool(row.get('Rainfall', False))
                    })
        
            # --- EXTRACT LAP-BY-LAP POSITION CHART, GAP CHART, & LAP TIMES CHART ---
            lap_chart = []
            gap_chart = []
            lap_times_chart = []
            if not race_session.laps.empty:
                try:
                    lap_df = race_session.laps[['LapNumber', 'Driver', 'Position', 'Time', 'LapTime']].dropna(subset=['LapNumber', 'Driver', 'Position'])
                    lap_numbers = sorted(lap_df['LapNumber'].unique().astype(int))
                    for lap_num in lap_numbers:
                        lap_rows = lap_df[lap_df['LapNumber'] == lap_num]
                        lap_entry = {"lap": int(lap_num)}
                        gap_entry = {"lap": int(lap_num)}
                        times_entry = {"lap": int(lap_num)}
                        
                        leader_row = lap_rows[lap_rows['Position'] == 1]
                        leader_time = None
                        if not leader_row.empty:
                            leader_time = leader_row.iloc[0]['Time']

                        for _, row in lap_rows.iterrows():
                            pos_val = int(row['Position'])
                            drv = str(row['Driver'])
                            if pos_val > 0:
                                lap_entry[drv] = pos_val
                            
                            if leader_time is not None and pd.notna(row.get('Time')) and pd.notna(leader_time):
                                gap = (row['Time'] - leader_time).total_seconds()
                                if gap >= 0 and gap < 180: # Ignore absurd gaps
                                    gap_entry[drv] = round(gap, 3)

                            # Extract individual lap times
                            if pd.notna(row.get('LapTime')):
                                lap_time_sec = row['LapTime'].total_seconds()
                                if lap_time_sec > 0 and lap_time_sec < 300: # Filter out absurd lap times
                                    times_entry[drv] = round(lap_time_sec, 3)

                        lap_chart.append(lap_entry)
                        if len(gap_entry) > 1:
                            gap_chart.append(gap_entry)
                        if len(times_entry) > 1:
                            lap_times_chart.append(times_entry)
                            
                    if lap_chart:
                        available_tabs.append("Lap Chart")
                    if gap_chart:
                        available_tabs.append("Race Progression")
                    if lap_times_chart:
                        available_tabs.append("Lap Times")
                except Exception as e:
                    print(f"  -> Gagal memproses lap chart / gap chart / lap times: {e}")
        
        final_data = {
            "race_info": { "name": event['EventName'], "location": event['Location'], "country": str(event.get('Country', '')) },
            "available_tabs": available_tabs, "race_winner": race_winner_info, "pole_position": pole_sitter_info,
            "fastest_lap": fastest_lap_info, "results": results if results else None,
            "tyre_strategy": tyre_strategy if tyre_strategy else None,
            "speed_traps": speed_traps if speed_traps else None,
            "sector_matrix": sector_matrix if sector_matrix else None,
            "weather_info": weather_info if weather_info else None,
            "starting_grid": starting_grid if starting_grid else None,
            "qualifying_results": qualifying_results if qualifying_results else None,
            "sprint_results": sprint_results if sprint_results else None,
            "sprint_grid_results": sprint_grid_results if sprint_grid_results else None,
            "sprint_qualifying_results": sprint_qualifying_results if sprint_qualifying_results else None,
            "practice1_results": practice1_results if practice1_results else None,
            "practice2_results": practice2_results if practice2_results else None,
            "practice3_results": practice3_results if practice3_results else None,
            "lap_chart": lap_chart if lap_chart else None,
            "gap_chart": gap_chart if gap_chart else None,
            "lap_times_chart": lap_times_chart if lap_times_chart else None,
        }


        with open(CACHE_FILE, "w") as f:
            json.dump(final_data, f, indent=2)
        print(f"✅ Perhitungan DETAIL SUPER LENGKAP (dgn tab dinamis) selesai.")
        return final_data
    except Exception as e:
        print(f"❌ Error saat menghitung detail balapan: {e}")
        traceback.print_exc()
        return {"error": str(e), "message": "Gagal memproses data sesi. Pastikan semua sesi yang relevan sudah selesai."}

# --- Endpoint /api/clear_cache/{year} (Tidak berubah) ---
def get_championship_cache_filename(year: int):
    return f"championship_cache_{year}.json"

@app.get("/api/clear_cache/{year}")
def clear_cache(year: int):
    championship_cache = get_championship_cache_filename(year)
    dashboard_cache = get_dashboard_cache_filename(year)
    all_races_cache = f"all_races_cache_{year}.json"
    messages = []
    for i in range(1, 25):
        race_detail_cache = f"race_detail_cache_{year}_{i}.json"
        if os.path.exists(race_detail_cache):
            os.remove(race_detail_cache)
    if os.path.exists(championship_cache): os.remove(championship_cache); messages.append(f"Cache klasemen untuk {year} dihapus.")
    if os.path.exists(dashboard_cache): os.remove(dashboard_cache); messages.append(f"Cache dashboard untuk {year} dihapus.")
    if os.path.exists(all_races_cache): os.remove(all_races_cache); messages.append(f"Cache semua balapan untuk {year} dihapus.")
    messages.append(f"Semua cache detail balapan untuk {year} sudah dibersihkan.")
    return {"messages": messages}

# =======================================================================
# --- Endpoint /api/telemetry/{year}/{round_number} (Head-to-Head) ---
# =======================================================================
@app.get("/api/telemetry/{year}/{round_number}")
def get_telemetry_compare(year: int, round_number: int, drivers: str = "VER,NOR", lap: int = None):
    driver_list = [d.strip().upper() for d in drivers.split(',')]
    driver_list = driver_list[:10] # Max 10 drivers
    
    if len(driver_list) < 1:
        return {"error": "Pilih minimal 1 pembalap."}

    CACHE_FILE = os.path.join("cache", f"telemetry_{year}_{round_number}_{'_'.join(driver_list)}_lap{lap}.json")
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
        except Exception:
            pass

    try:
        session = fastf1.get_session(year, round_number, 'R')
        session.load(telemetry=True, laps=True, weather=False, messages=False)

        driver_data = {}
        binned_dfs = []

        ref_driver = driver_list[0]
        
        for drv in driver_list:
            drv_laps = session.laps.pick_drivers(drv)
            if drv_laps.empty:
                continue

            if lap is not None:
                lap_df = drv_laps.loc[drv_laps['LapNumber'] == lap]
                target_lap = lap_df.iloc[0] if not lap_df.empty else None
            else:
                target_lap = drv_laps.pick_fastest()

            if target_lap is None or pd.isna(target_lap.get('LapTime')):
                continue
                
            drv_info = session.get_driver(drv)
            team = str(drv_info.get('TeamName', '')) if drv_info is not None else ""
            name = f"{drv_info.get('FirstName', '')} {drv_info.get('LastName', '')}".strip() if drv_info is not None else drv

            tel = target_lap.get_telemetry()
            
            tel['Elapsed'] = (tel['Time'] - tel['Time'].iloc[0]).dt.total_seconds()
            tel['DRSActive'] = tel['DRS'].apply(lambda x: 1 if x in [10, 12, 14, 1] else 0) if 'DRS' in tel else 0
            
            s_filtered = tel[tel['Speed'] > 30]['Speed']
            min_speed = round(float(s_filtered.min()), 1) if not s_filtered.empty else round(float(tel['Speed'].min()), 1)
            
            driver_data[drv] = {
                "name": name,
                "team": team,
                "lap_time": str(target_lap['LapTime']).split("0 days ")[-1] if pd.notna(target_lap.get('LapTime')) else None,
                "compound": str(target_lap.get('Compound', 'UNKNOWN')),
                "max_speed": round(float(tel['Speed'].max()), 1),
                "min_speed": min_speed,
                "avg_speed": round(float(tel['Speed'].mean()), 1)
            }
            
            binned = tel.groupby(tel['Distance'] // 10 * 10).mean(numeric_only=True).reset_index(names='BinnedDist')
            binned.columns = [c if c == 'BinnedDist' else f"{c}_{drv}" for c in binned.columns]
            binned_dfs.append(binned)

        if not binned_dfs:
            return {"error": "Tidak ada data telemetry untuk pembalap yang dipilih."}
            
        merged = binned_dfs[0]
        for df in binned_dfs[1:]:
            merged = pd.merge(merged, df, on='BinnedDist', how='outer').sort_values('BinnedDist')
            
        merged = merged.ffill().bfill().fillna(0)
        
        valid_drivers = list(driver_data.keys())
        data_points = []
        for _, row in merged.iterrows():
            pt = {"distance": int(row['BinnedDist'])}
            ref_elapsed = float(row.get(f'Elapsed_{ref_driver}', 0))
            
            max_speed = -1
            dominant = valid_drivers[0] if valid_drivers else None
            
            pt["x"] = float(row.get(f'X_{valid_drivers[0]}', 0))
            pt["y"] = float(row.get(f'Y_{valid_drivers[0]}', 0))

            for drv in valid_drivers:
                speed = round(float(row.get(f'Speed_{drv}', 0)), 1)
                elapsed = float(row.get(f'Elapsed_{drv}', 0))
                g = row.get(f'nGear_{drv}', 0)
                
                pt[f"speed_{drv}"] = speed
                pt[f"throttle_{drv}"] = round(float(row.get(f'Throttle_{drv}', 0)), 1)
                pt[f"brake_{drv}"] = 1 if row.get(f'Brake_{drv}', 0) > 0 else 0
                pt[f"gear_{drv}"] = int(g) if pd.notna(g) else 0
                pt[f"drs_{drv}"] = 1 if row.get(f'DRSActive_{drv}', 0) >= 0.5 else 0
                
                if drv != ref_driver:
                    pt[f"delta_{drv}"] = round(elapsed - ref_elapsed, 3)
                
                if speed > max_speed:
                    max_speed = speed
                    dominant = drv
                    
            pt["dominant_driver"] = dominant
            data_points.append(pt)
            
        # --- Smooth Dominant Driver (Mini-Sectors) ---
        chunk_size = 250
        chunks = {}
        for pt in data_points:
            c_idx = pt["distance"] // chunk_size
            if c_idx not in chunks:
                chunks[c_idx] = {drv: [] for drv in valid_drivers}
            for drv in valid_drivers:
                chunks[c_idx][drv].append(pt.get(f"speed_{drv}", 0))
        
        chunk_winners = {}
        for c_idx, drv_speeds in chunks.items():
            best_drv = valid_drivers[0] if valid_drivers else None
            best_avg = -1
            for drv, speeds in drv_speeds.items():
                if speeds:
                    avg = sum(speeds) / len(speeds)
                    if avg > best_avg:
                        best_avg = avg
                        best_drv = drv
            chunk_winners[c_idx] = best_drv
            
        for pt in data_points:
            c_idx = pt["distance"] // chunk_size
            pt["dominant_driver"] = chunk_winners.get(c_idx, valid_drivers[0] if valid_drivers else None)
            
        result = {
            "drivers": valid_drivers,
            "driver_info": driver_data,
            "telemetry": data_points
        }
        
        os.makedirs("cache", exist_ok=True)
        with open(CACHE_FILE, "w") as f:
            json.dump(result, f, indent=2)
            
        return result
    except Exception as e:
        import traceback
        traceback.print_exc()
        return {"error": str(e), "message": "Gagal memproses telemetry"}

@app.get("/api/telemetry-drivers/{year}/{round_number}")
def get_telemetry_drivers(year: int, round_number: int):
    try:
        session = fastf1.get_session(year, round_number, 'R')
        session.load(telemetry=False, laps=False, weather=False, messages=False)
        drivers_list = []
        if hasattr(session, 'results') and not session.results.empty:
            for _, row in session.results.iterrows():
                abbr = row.get('Abbreviation')
                if pd.notna(abbr) and abbr:
                    drivers_list.append({
                        "abbreviation": str(abbr),
                        "full_name": f"{row.get('FirstName', '')} {row.get('LastName', '')}".strip(),
                        "team_name": row.get('TeamName', '')
                    })
        return drivers_list
    except Exception as e:
        print(f"Error getting telemetry drivers: {e}")
        return []

# =======================================================================
# --- Endpoint /api/championship/{year} (DENGAN PERBAIKAN PRA-MUSIM) ---
# =======================================================================
@app.get("/api/championship/{year}")
def get_championship_standings(year: int):
    CACHE_FILE = get_championship_cache_filename(year)
    if os.path.exists(CACHE_FILE):
        file_mod_time = datetime.fromtimestamp(os.path.getmtime(CACHE_FILE))
        if datetime.now() - file_mod_time < timedelta(hours=CACHE_DURATION_HOURS):
            print("✅ Menyajikan data dari CACHE (Championship)...")
            with open(CACHE_FILE, "r") as f:
                return json.load(f)
    try:
        print("⚙️ Menghitung total klasemen (Teams & Drivers) dengan data lengkap...")
        schedule = fastf1.get_event_schedule(year, include_testing=False)
        official_races = schedule[schedule["EventName"].str.contains("Grand Prix", na=False)]
        today = pd.to_datetime("today").normalize()
        races_to_process = official_races[official_races["EventDate"].dt.normalize() <= today]
        
        # --- PERUBAHAN DI SINI: Penanganan Pra-Musim ---
        if races_to_process.empty:
            print(f"  -> Musim {year} belum dimulai. Mengirim status pre_season untuk Championship.")
            pre_season_data = {
                "year": year,
                "status": "pre_season",
                "message": f"The {year} season has not started yet. Championship standings will be available after the first race.",
                "teams": [],
                "drivers": []
            }
            with open(CACHE_FILE, "w") as f:
                json.dump(pre_season_data, f, indent=2)
            return pre_season_data
        # --- AKHIR PERUBAHAN ---

        last_race_round = races_to_process['RoundNumber'].max()
        print(f"  -> Ronde balapan terakhir teridentifikasi: {last_race_round}")

        all_results_df = []
        for index, race in races_to_process.iterrows():
            sessions_to_check = ["R", "Sprint", "Q"]
            for session_type in sessions_to_check:
                try:
                    session = fastf1.get_session(year, race["RoundNumber"], session_type)
                    session.load(telemetry=False, weather=False, laps=False, messages=False)
                    if hasattr(session, "results") and not session.results.empty:
                        needed = ["DriverNumber", "Abbreviation", "FirstName", "LastName", "TeamName", "Position"]
                        if all(c in session.results.columns for c in needed):
                            sub_df = session.results[needed].copy()
                            sub_df["Points"] = pd.to_numeric(session.results.get("Points", 0), errors="coerce").fillna(0.0)
                            sub_df["Position"] = pd.to_numeric(sub_df["Position"], errors="coerce").fillna(99)
                            sub_df["SessionType"] = session_type
                            sub_df["RoundNumber"] = int(race["RoundNumber"])
                            sub_df["EventName"] = str(race.get("EventName", ""))
                            sub_df["Location"] = str(race.get("Location", ""))
                            all_results_df.append(sub_df)
                except Exception as e:
                    continue
        if not all_results_df:
            return {"error": "Tidak ada data balapan yang berhasil diproses oleh FastF1."}

        df_full = pd.concat(all_results_df, ignore_index=True)
        print(f"DEBUG CHAMPIONSHIP: total session rows = {len(df_full)}")
        df_full.dropna(subset=['FirstName', 'LastName'], inplace=True)
        df_full['FullName'] = df_full['FirstName'] + ' ' + df_full['LastName']
        
        # Hanya R dan Sprint yang menghasilkan poin kejuaraan
        df_points_sessions = df_full[df_full["SessionType"].isin(["R", "Sprint"])]
        df_race_only = df_full[df_full["SessionType"] == "R"]

        team_points = df_points_sessions.groupby("TeamName")["Points"].sum()
        team_wins = df_race_only[df_race_only["Position"] == 1].groupby("TeamName").size()
        team_podiums = df_race_only[df_race_only["Position"] <= 3].groupby("TeamName").size()
        team_standings = pd.DataFrame(team_points).rename(columns={"Points": "points"})
        team_standings["wins"] = team_wins
        team_standings["podiums"] = team_podiums
        team_standings.fillna(0, inplace=True); team_standings = team_standings.astype(int).reset_index()
        team_standings.rename(columns={"TeamName": "name"}, inplace=True)
        
        df_last_race = df_points_sessions[df_points_sessions["RoundNumber"] == last_race_round]
        last_race_team_points = df_last_race.groupby("TeamName")["Points"].sum().reset_index()
        last_race_team_points.rename(columns={"Points": "points_last_race", "TeamName": "name"}, inplace=True)
        
        team_standings = pd.merge(team_standings, last_race_team_points, on="name", how="left")
        team_standings["points_last_race"] = team_standings["points_last_race"].fillna(0).astype(int)
        
        team_standings = team_standings.sort_values(by="points", ascending=False).reset_index(drop=True)
        team_standings["position"] = team_standings.index + 1
        team_standings["id"] = team_standings["name"].str.lower().str.replace(" ", "_", regex=False)
        
        driver_standings = df_points_sessions.groupby('FullName').agg(
            team=('TeamName', 'last'),
            points=('Points', 'sum'),
            driver_number=('DriverNumber', 'last'),
            abbreviation=('Abbreviation', 'last')
        ).reset_index()

        driver_wins = df_race_only[df_race_only["Position"] == 1].groupby("FullName").size().rename('wins')
        driver_podiums = df_race_only[df_race_only["Position"] <= 3].groupby("FullName").size().rename('podiums')
        last_race_driver_points = df_last_race.groupby("FullName")["Points"].sum().rename('points_last_race')
        
        driver_standings = driver_standings.merge(driver_wins, on="FullName", how="left")
        driver_standings = driver_standings.merge(driver_podiums, on="FullName", how="left")
        driver_standings = driver_standings.merge(last_race_driver_points, on="FullName", how="left")
        
        cols_to_fill = ['wins', 'podiums', 'points_last_race']
        driver_standings[cols_to_fill] = driver_standings[cols_to_fill].fillna(0).astype(int)
        driver_standings['driver_number'] = pd.to_numeric(driver_standings['driver_number'], errors='coerce').fillna(0).astype(int)

        driver_standings = driver_standings.sort_values(by="points", ascending=False).reset_index(drop=True)
        driver_standings["position"] = driver_standings.index + 1
        driver_standings.rename(columns={"FullName": "name"}, inplace=True)
        driver_standings["id"] = driver_standings["name"].str.lower().str.replace(" ", "_", regex=False)

        final_data = {
            "year": year, 
            "teams": team_standings.to_dict(orient="records"), 
            "drivers": driver_standings.to_dict(orient="records"),
            "session_results": df_full[['RoundNumber', 'FullName', 'TeamName', 'Position', 'Points', 'SessionType', 'Abbreviation', 'EventName', 'Location']].to_dict(orient="records")
        }
        final_data = apply_f1_official_standings(final_data)
        with open(CACHE_FILE, "w") as f:
            json.dump(final_data, f, indent=2)
        print("✅ Perhitungan Championship (Teams & Drivers) lengkap selesai. Data disimpan ke cache.")
        return final_data
    except Exception as e:
        print(f"❌ Error saat menghitung klasemen: {e}")
        traceback.print_exc()
        return {"error": f"Gagal menghitung klasemen: {str(e)}"}

# =======================================================================
# --- ENDPOINTS PROFIL DRIVER & TEAM (DEDICATED ANALYTICS) ---
# =======================================================================
@app.get("/api/driver/{year}/{driver_id}")
def get_driver_profile(year: int, driver_id: str):
    try:
        champ_data = get_championship_standings(year)
        if "error" in champ_data:
            return champ_data

        drivers = champ_data.get("drivers", [])
        clean_id = driver_id.lower().replace("-", "_")

        # Cari driver berdasarkan ID, Nama, atau Abbr
        driver = next((d for d in drivers if d["id"] == clean_id 
                       or d["name"].lower() == clean_id.replace("_", " ") 
                       or d.get("abbreviation", "").lower() == clean_id), None)
        
        if not driver:
            return {"error": f"Driver '{driver_id}' not found in {year} season."}

        # Cari rekan setim
        teammate = next((d for d in drivers if d["team"] == driver["team"] and d["name"] != driver["name"]), None)

        session_results = champ_data.get("session_results", [])
        driver_races = [r for r in session_results if r["FullName"] == driver["name"] and r["SessionType"] == "R"]
        driver_races = sorted(driver_races, key=lambda x: x["RoundNumber"])

        progression = []
        cum_points = 0.0
        positions_classified = []
        dnfs = 0

        for r in driver_races:
            rnd = r["RoundNumber"]
            pts = float(r.get("Points", 0))
            # Tambahkan poin sprint jika ada di ronde ini
            sprint_pts = sum(float(s.get("Points", 0)) for s in session_results if s["FullName"] == driver["name"] and s["SessionType"] == "Sprint" and s["RoundNumber"] == rnd)
            total_round_pts = pts + sprint_pts
            cum_points += total_round_pts

            pos = int(r["Position"])
            if pos < 90:
                positions_classified.append(pos)
            else:
                dnfs += 1

            tm_r = next((x for x in session_results if x["FullName"] == (teammate["name"] if teammate else "") and x["RoundNumber"] == rnd and x["SessionType"] == "R"), None)
            
            progression.append({
                "round": rnd,
                "race_name": r.get("EventName", f"Round {rnd}"),
                "location": r.get("Location", ""),
                "position": pos if pos < 90 else "DNF",
                "points": total_round_pts,
                "cumulative_points": cum_points,
                "teammate_position": int(tm_r["Position"]) if (tm_r and int(tm_r["Position"]) < 90) else ("DNF" if tm_r else "-"),
                "teammate_points": float(tm_r.get("Points", 0)) if tm_r else 0.0
            })

        # Head to Head vs Teammate
        race_ahead = 0
        tm_race_ahead = 0
        quali_ahead = 0
        tm_quali_ahead = 0

        if teammate:
            # Race H2H
            for r in driver_races:
                rnd = r["RoundNumber"]
                tm_r = next((x for x in session_results if x["FullName"] == teammate["name"] and x["RoundNumber"] == rnd and x["SessionType"] == "R"), None)
                if tm_r:
                    if int(r["Position"]) < int(tm_r["Position"]):
                        race_ahead += 1
                    elif int(tm_r["Position"]) < int(r["Position"]):
                        tm_race_ahead += 1

            # Quali H2H
            driver_qualis = [q for q in session_results if q["FullName"] == driver["name"] and q["SessionType"] == "Q"]
            for q in driver_qualis:
                rnd = q["RoundNumber"]
                tm_q = next((x for x in session_results if x["FullName"] == teammate["name"] and x["RoundNumber"] == rnd and x["SessionType"] == "Q"), None)
                if tm_q:
                    if int(q["Position"]) < int(tm_q["Position"]):
                        quali_ahead += 1
                    elif int(tm_q["Position"]) < int(q["Position"]):
                        tm_quali_ahead += 1

        poles = sum(1 for q in session_results if q["FullName"] == driver["name"] and q["SessionType"] == "Q" and int(q.get("Position", 99)) == 1)
        best_finish = min(positions_classified) if positions_classified else None
        avg_finish = round(sum(positions_classified) / len(positions_classified), 1) if positions_classified else None

        return {
            "name": driver["name"],
            "id": driver["id"],
            "abbreviation": driver.get("abbreviation", ""),
            "driver_number": driver.get("driver_number", 0),
            "team": driver["team"],
            "position": driver["position"],
            "points": driver["points"],
            "wins": driver.get("wins", 0),
            "podiums": driver.get("podiums", 0),
            "poles": poles,
            "best_finish": best_finish,
            "avg_finish": avg_finish,
            "dnfs": dnfs,
            "progression": progression,
            "teammate": {
                "name": teammate["name"],
                "id": teammate["id"],
                "abbreviation": teammate.get("abbreviation", ""),
                "driver_number": teammate.get("driver_number", 0),
                "points": teammate["points"],
                "position": teammate["position"],
                "race_h2h": { "driver_ahead": race_ahead, "teammate_ahead": tm_race_ahead },
                "quali_h2h": { "driver_ahead": quali_ahead, "teammate_ahead": tm_quali_ahead }
            } if teammate else None
        }
    except Exception as e:
        traceback.print_exc()
        return {"error": f"Gagal memuat profil driver: {str(e)}"}

@app.get("/api/team/{year}/{team_id}")
def get_team_profile(year: int, team_id: str):
    try:
        champ_data = get_championship_standings(year)
        if "error" in champ_data:
            return champ_data

        teams = champ_data.get("teams", [])
        clean_id = team_id.lower().replace("-", "_")

        team = next((t for t in teams if t["id"] == clean_id or t["name"].lower() == clean_id.replace("_", " ")), None)
        if not team:
            return {"error": f"Team '{team_id}' not found in {year} season."}

        drivers = [d for d in champ_data.get("drivers", []) if d["team"] == team["name"]]
        total_team_points = max(float(team["points"]), 1.0)
        
        team_drivers = []
        for d in drivers:
            share = round((float(d["points"]) / total_team_points) * 100, 1)
            team_drivers.append({
                "name": d["name"],
                "id": d["id"],
                "abbreviation": d.get("abbreviation", ""),
                "driver_number": d.get("driver_number", 0),
                "points": d["points"],
                "position": d["position"],
                "points_share": share
            })

        session_results = champ_data.get("session_results", [])
        team_races = [r for r in session_results if r["TeamName"] == team["name"] and r["SessionType"] in ["R", "Sprint"]]
        
        progression = []
        rounds = sorted(list(set(r["RoundNumber"] for r in team_races)))
        cum_points = 0.0

        for rnd in rounds:
            rnd_pts = sum(float(r.get("Points", 0)) for r in team_races if r["RoundNumber"] == rnd)
            cum_points += rnd_pts
            first_entry = next((r for r in team_races if r["RoundNumber"] == rnd), {})
            progression.append({
                "round": rnd,
                "race_name": first_entry.get("EventName", f"Round {rnd}"),
                "location": first_entry.get("Location", ""),
                "points": rnd_pts,
                "cumulative_points": cum_points
            })

        return {
            "name": team["name"],
            "id": team["id"],
            "position": team["position"],
            "points": team["points"],
            "wins": team.get("wins", 0),
            "podiums": team.get("podiums", 0),
            "drivers": team_drivers,
            "progression": progression
        }
    except Exception as e:
        traceback.print_exc()
        return {"error": f"Gagal memuat profil team: {str(e)}"}
