import logging
import pandas as pd
import fastf1

def compute_fastf1_championship(year: int):
    try:
        print("⚙️ Menghitung total klasemen (Teams & Drivers) dengan data lengkap...")
        schedule = fastf1.get_event_schedule(year, include_testing=False)
        official_races = schedule[schedule["EventName"].str.contains("Grand Prix", na=False)]
        today = pd.to_datetime("today").normalize()
        races_to_process = official_races[official_races["EventDate"].dt.normalize() <= today]
        
        if races_to_process.empty:
            print(f"  -> Musim {year} belum dimulai. Mengirim status pre_season untuk Championship.")
            pre_season_data = {
                "year": year,
                "status": "pre_season",
                "message": f"The {year} season has not started yet. Championship standings will be available after the first race.",
                "teams": [],
                "drivers": []
            }
            return pre_season_data

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
        return final_data
    except Exception as e:
        logging.error(f"Error pada server: {e}", exc_info=True)
        return {"error": "Terjadi kesalahan internal saat memproses data."}
