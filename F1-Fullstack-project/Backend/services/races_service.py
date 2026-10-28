import logging
import pandas as pd

from services.fastf1_safe import (
    has_rows,
    is_valid_year,
    load_event_schedule,
    load_session_safe,
    safe_getattr,
)
from services.circuit_map_service import resolve_circuit

LIGHT_LOAD_KWARGS = dict(telemetry=False, weather=False, messages=False, laps=False)


def _is_sprint_event(race) -> bool:
    """
    True when an event runs a Sprint session.

    Derived from the FastF1 schedule row itself (`EventFormat` plus the
    Session1..Session5 names), never from a hardcoded venue list, so
    sprint-points maths (e.g. the championship simulator) follows the real
    calendar for any season.
    """
    if "sprint" in str(race.get("EventFormat", "")).lower():
        return True
    return any(
        "sprint" in str(race.get(f"Session{i}", "")).lower() for i in range(1, 6)
    )


def compute_fastf1_all_races(year: int):
    """
    Every Grand Prix of a season with status and (once classified) winner.

    Returns a list — never an error envelope — so the races page can always
    render. A season with no schedule answers with an empty list, which the UI
    shows as "no races", rather than a misleading server error.
    """
    logging.info(f"[Races] Computing all races for {year}...")

    if not is_valid_year(year):
        logging.info(
            f"  -> Tahun {year} di luar rentang musim F1. Mengembalikan array kosong."
        )
        return []

    today = pd.Timestamp.now(tz="UTC").normalize()
    schedule = load_event_schedule(year, include_testing=False)
    if schedule is None or schedule.empty:
        logging.info(
            f"  -> Tidak ada jadwal resmi ditemukan untuk {year}. Mengembalikan array kosong."
        )
        return []

    try:
        official_races = schedule[
            schedule["EventName"].str.contains("Grand Prix", na=False)
        ]
    except Exception as e:  # noqa: BLE001
        logging.warning(f"Could not filter schedule for {year}: {e}")
        return []

    if official_races.empty:
        logging.info(
            f"  -> Tidak ada jadwal resmi ditemukan untuk {year}. Mengembalikan array kosong."
        )
        return []

    all_races_data = []
    for _, race in official_races.iterrows():
        try:
            race_date = pd.to_datetime(race["EventDate"], utc=True, errors="coerce").normalize()
            if pd.isna(race_date):
                logging.warning(f"Skipping race with unparseable EventDate: {race}")
                continue
        except (TypeError, ValueError, OSError):
            logging.warning(f"Skipping race with unreadable EventDate: {race}")
            continue

        status = "Finished"
        if race_date > today:
            status = "Upcoming"
        elif race_date == today:
            status = "Ongoing"

        # Resolve circuit path & metadata
        circuit_data = resolve_circuit({
            "Meeting": {"Location": race.get("Location"), "Name": race["EventName"]},
            "Circuit": {"Name": str(race.get("OfficialEventName") or race.get("Location") or race["EventName"])}
        })
        circuit_name = circuit_data.get("name") if circuit_data else (race.get("Location") or race["EventName"])
        circuit_path = circuit_data.get("path") if circuit_data else None

        # Parse session dates
        fp1_date = None
        quali_date = None
        sprint_date = None
        for i in range(1, 6):
            s_name = str(race.get(f"Session{i}", ""))
            s_utc = race.get(f"Session{i}DateUtc")
            utc_str = s_utc.isoformat() if pd.notna(s_utc) and hasattr(s_utc, "isoformat") else (str(s_utc) if pd.notna(s_utc) and s_utc else None)
            low = s_name.lower()
            if "practice 1" in low or low == "fp1":
                fp1_date = utc_str
            elif "qualifying" in low and "sprint" not in low:
                quali_date = utc_str
            elif "sprint" in low:
                sprint_date = utc_str

        race_info = {
            "round": int(race["RoundNumber"]),
            "name": race["EventName"],
            "race_name": race["EventName"],
            "circuit": circuit_name,
            "location": race.get("Location", ""),
            "country": race.get("Country", ""),
            "date": race_date.strftime("%Y-%m-%d"),
            "status": status,
            "is_sprint": _is_sprint_event(race),
            "fp1_date": fp1_date,
            "quali_date": quali_date,
            "sprint_date": sprint_date,
            "circuit_svg": circuit_data,
            "circuit_path": circuit_path,
            "winner": None,
            "winner_team": None,
        }

        if status == "Finished":
            session = load_session_safe(
                year, race_info["round"], "R", **LIGHT_LOAD_KWARGS
            )
            if session is not None and has_rows(session, "results"):
                try:
                    winner_data = safe_getattr(session, "results").iloc[0]
                    race_info["winner"] = (
                        f"{winner_data['FirstName']} {winner_data['LastName']}"
                    )
                    race_info["winner_team"] = winner_data["TeamName"]
                except Exception:  # noqa: BLE001
                    race_info["winner"] = "Data not available"
            else:
                # Session genuinely has no classified result yet.
                race_info["winner"] = "Data not available"

        all_races_data.append(race_info)

    return all_races_data
