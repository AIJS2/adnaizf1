import logging
import pandas as pd
import fastf1

def compute_fastf1_dashboard(year: int):
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
        return final_data
    except Exception as e:
        logging.error(f"Error pada server: {e}", exc_info=True)
        return {"error": "Terjadi kesalahan internal saat memproses data."}
