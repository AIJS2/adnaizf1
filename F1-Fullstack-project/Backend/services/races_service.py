import logging
import pandas as pd

from services.fastf1_safe import (
    has_rows,
    is_valid_year,
    load_event_schedule,
    load_session_safe,
    safe_getattr,
)

LIGHT_LOAD_KWARGS = dict(telemetry=False, weather=False, messages=False, laps=False)


def compute_fastf1_all_races(year: int):
    """
    Every Grand Prix of a season with status and (once classified) winner.

    Returns a list — never an error envelope — so the races page can always
    render. A season with no schedule answers with an empty list, which the UI
    shows as "no races", rather than a misleading server error.
    """
    print(f"⚙️ Menghitung data SEMUA BALAPAN untuk tahun {year}...")

    if not is_valid_year(year):
        print(f"  -> Tahun {year} di luar rentang musim F1. Mengembalikan array kosong.")
        return []

    today = pd.to_datetime("today").normalize()
    schedule = load_event_schedule(year, include_testing=False)
    if schedule is None or schedule.empty:
        print(f"  -> Tidak ada jadwal resmi ditemukan untuk {year}. Mengembalikan array kosong.")
        return []

    try:
        official_races = schedule[schedule["EventName"].str.contains("Grand Prix", na=False)]
    except Exception as e:  # noqa: BLE001
        logging.warning(f"Could not filter schedule for {year}: {e}")
        return []

    if official_races.empty:
        print(f"  -> Tidak ada jadwal resmi ditemukan untuk {year}. Mengembalikan array kosong.")
        return []

    all_races_data = []
    for _, race in official_races.iterrows():
        try:
            race_date = pd.to_datetime(race["EventDate"]).normalize()
        except (TypeError, ValueError):
            logging.warning(f"Skipping race with unreadable EventDate: {race}")
            continue

        status = "Finished"
        if race_date > today:
            status = "Upcoming"
        elif race_date == today:
            status = "Ongoing"

        race_info = {
            "round": int(race["RoundNumber"]),
            "name": race["EventName"],
            "location": race.get("Location", ""),
            "country": race.get("Country", ""),
            "date": pd.to_datetime(race["EventDate"]).strftime("%Y-%m-%d"),
            "status": status,
            "winner": None,
            "winner_team": None,
        }

        if status == "Finished":
            session = load_session_safe(year, race_info["round"], "R", **LIGHT_LOAD_KWARGS)
            if session is not None and has_rows(session, "results"):
                try:
                    winner_data = safe_getattr(session, "results").iloc[0]
                    race_info["winner"] = f"{winner_data['FirstName']} {winner_data['LastName']}"
                    race_info["winner_team"] = winner_data["TeamName"]
                except Exception:  # noqa: BLE001
                    race_info["winner"] = "Data not available"
            else:
                # Session genuinely has no classified result yet.
                race_info["winner"] = "Data not available"

        all_races_data.append(race_info)

    return all_races_data
