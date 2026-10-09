import logging
import pandas as pd
import fastf1

def compute_fastf1_all_races(year: int):
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
                    logging.error(f"Gagal mengambil pemenang: {e}")
                    race_info["winner"] = "Data not available"
            all_races_data.append(race_info)
        return all_races_data
    except Exception as e:
        logging.error(f"Error pada server: {e}", exc_info=True)
        return {"error": "Terjadi kesalahan internal saat memproses data."}
