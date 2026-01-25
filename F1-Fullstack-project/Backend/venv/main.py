# main.py 

import os
import json
from datetime import datetime, timedelta

import pandas as pd
import fastf1
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import traceback

app = FastAPI()

# Middleware CORS (tidak berubah)
origins = ["http://localhost:5173"]
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
        # Variabel baru untuk perbandingan waktu yang akurat (dengan timezone)
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
        final_data = { "year": year, "last_race_name": last_race_name, "team_standings": [], "driver_standings": [], "race_analytics": [], "next_race_event": None }

        if all_driver_results:
            df_all_drivers = pd.concat(all_driver_results, ignore_index=True)
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
            print(f"✅ Menyajikan data dari CACHE (Detail Race Lengkap {year}-{round_number})...")
            with open(CACHE_FILE, "r") as f:
                return json.load(f)

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
        
        SESSION_MAP = {
            'Practice 1': 'FP1', 'Practice 2': 'FP2', 'Practice 3': 'FP3',
            'Qualifying': 'Q', 'Sprint Qualifying': 'SQ', 'Sprint': 'S', 'Race': 'R'
        }
        
        for i in range(1, 6):
            session_key = f'Session{i}'
            if session_key in event and pd.notna(event[session_key]):
                name = event[session_key]
                if name in SESSION_MAP:
                    try:
                        session_obj = fastf1.get_session(year, round_number, SESSION_MAP[name])
                        session_obj.load(laps=True, telemetry=False, weather=False, messages=True)
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
                results.append({ "position": position, "driver_number": driver_number, "full_name": res['FullName'], "team_name": res['TeamName'], "status": res['Status'], "points": int(res.get('Points', 0)), "laps": current_laps, "time": time_display, "gap_to_leader": gap_display, "interval": interval_display })
            
            fastest = race_session.laps.pick_fastest()
            if fastest is not None:
                driver_lookup = race_session.results.loc[race_session.results['Abbreviation'] == fastest['Driver']]
                if not driver_lookup.empty:
                    driver_data = driver_lookup.iloc[0]
                    fastest_lap_info = {
                        "full_name": driver_data['FullName'], "team_name": driver_data['TeamName'],
                        "lap_time": format_lap_time(fastest['LapTime']), "lap_number": int(fastest['LapNumber'])
                    }
        
        final_data = {
            "race_info": { "name": event['EventName'], "location": event['Location'] },
            "available_tabs": available_tabs, "race_winner": race_winner_info, "pole_position": pole_sitter_info,
            "fastest_lap": fastest_lap_info, "results": results if results else None,
            "starting_grid": starting_grid if starting_grid else None,
            "qualifying_results": qualifying_results if qualifying_results else None,
            "sprint_results": sprint_results if sprint_results else None,
            "sprint_grid_results": sprint_grid_results if sprint_grid_results else None,
            "sprint_qualifying_results": sprint_qualifying_results if sprint_qualifying_results else None,
            "practice1_results": practice1_results if practice1_results else None,
            "practice2_results": practice2_results if practice2_results else None,
            "practice3_results": practice3_results if practice3_results else None,
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
            sessions_to_check = ["R", "Sprint"]
            for session_type in sessions_to_check:
                try:
                    session = fastf1.get_session(year, race["RoundNumber"], session_type)
                    session.load(telemetry=False, weather=False, laps=False, messages=False)
                    if hasattr(session, "results") and not session.results.empty:
                        needed = ["DriverNumber", "Abbreviation", "FirstName", "LastName", "TeamName", "Points", "Position"]
                        if all(c in session.results.columns for c in needed):
                            sub_df = session.results[needed].copy()
                            sub_df["Points"] = pd.to_numeric(sub_df["Points"], errors="coerce").fillna(0.0)
                            sub_df["Position"] = pd.to_numeric(sub_df["Position"], errors="coerce").fillna(99)
                            sub_df["SessionType"] = session_type
                            sub_df["RoundNumber"] = race["RoundNumber"] 
                            all_results_df.append(sub_df)
                except Exception as e:
                    continue
        if not all_results_df:
            return {"error": "Tidak ada data balapan yang berhasil diproses oleh FastF1."}

        df_full = pd.concat(all_results_df, ignore_index=True)
        df_full.dropna(subset=['FirstName', 'LastName'], inplace=True)
        df_full['FullName'] = df_full['FirstName'] + ' ' + df_full['LastName']
        
        df_race_only = df_full[df_full["SessionType"] == "R"]
        team_points = df_full.groupby("TeamName")["Points"].sum()
        team_wins = df_race_only[df_race_only["Position"] == 1].groupby("TeamName").size()
        team_podiums = df_race_only[df_race_only["Position"] <= 3].groupby("TeamName").size()
        team_standings = pd.DataFrame(team_points).rename(columns={"Points": "points"})
        team_standings["wins"] = team_wins
        team_standings["podiums"] = team_podiums
        team_standings.fillna(0, inplace=True); team_standings = team_standings.astype(int).reset_index()
        team_standings.rename(columns={"TeamName": "name"}, inplace=True)
        
        df_last_race = df_full[df_full["RoundNumber"] == last_race_round]
        last_race_team_points = df_last_race.groupby("TeamName")["Points"].sum().reset_index()
        last_race_team_points.rename(columns={"Points": "points_last_race", "TeamName": "name"}, inplace=True)
        
        team_standings = pd.merge(team_standings, last_race_team_points, on="name", how="left")
        team_standings["points_last_race"] = team_standings["points_last_race"].fillna(0).astype(int)
        
        team_standings = team_standings.sort_values(by="points", ascending=False).reset_index(drop=True)
        team_standings["position"] = team_standings.index + 1
        team_standings["id"] = team_standings["name"].str.lower().str.replace(" ", "_", regex=False)
        
        driver_standings = df_full.groupby('FullName').agg(
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
        }
        with open(CACHE_FILE, "w") as f:
            json.dump(final_data, f, indent=2)
        print("✅ Perhitungan Championship (Teams & Drivers) lengkap selesai. Data disimpan ke cache.")
        return final_data
    except Exception as e:
        print(f"❌ Error saat menghitung klasemen: {e}")
        traceback.print_exc()
        return {"error": f"Gagal menghitung klasemen: {str(e)}"}