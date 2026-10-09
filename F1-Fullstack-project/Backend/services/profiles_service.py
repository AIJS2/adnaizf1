import logging

def process_driver_profile(champ_data: dict, year: int, driver_id: str):
    try:
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
        dnss = 0

        for r in driver_races:
            rnd = r["RoundNumber"]
            pts = float(r.get("Points", 0))
            # Tambahkan poin sprint jika ada di ronde ini
            sprint_pts = sum(float(s.get("Points", 0)) for s in session_results if s["FullName"] == driver["name"] and s["SessionType"] == "Sprint" and s["RoundNumber"] == rnd)
            total_round_pts = pts + sprint_pts
            cum_points += total_round_pts

            pos = int(r["Position"])
            status_str = str(r.get("Status", "")).lower()
            
            is_dns = "did not start" in status_str or "dns" in status_str
            
            if pos < 90:
                positions_classified.append(pos)
            elif is_dns:
                dnss += 1
            else:
                dnfs += 1

            tm_r = next((x for x in session_results if x["FullName"] == (teammate["name"] if teammate else "") and x["RoundNumber"] == rnd and x["SessionType"] == "R"), None)
            
            progression.append({
                "round": rnd,
                "race_name": r.get("EventName", f"Round {rnd}"),
                "location": r.get("Location", ""),
                "position": pos if pos < 90 else ("DNS" if is_dns else "DNF"),
                "status": str(r.get("Status", "")),
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
            "dnss": dnss,
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
        logging.error(f"Error memuat profil driver: {e}", exc_info=True)
        return {"error": "Terjadi kesalahan internal saat memproses data."}

def process_team_profile(champ_data: dict, year: int, team_id: str):
    try:
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
        logging.error(f"Error memuat profil team: {e}", exc_info=True)
        return {"error": "Terjadi kesalahan internal saat memproses data."}
