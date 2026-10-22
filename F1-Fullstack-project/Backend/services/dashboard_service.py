import logging
import pandas as pd

from services.fastf1_safe import (
    has_rows,
    is_valid_year,
    load_event_schedule,
    load_session_safe,
    safe_getattr,
)

RACE_LOAD_KWARGS = dict(telemetry=False, weather=False, laps=False, messages=False)
ANALYTICS_LOAD_KWARGS = dict(laps=False, telemetry=False, weather=False, messages=False)

F1_SEASON_START = 1950
F1_SEASON_END = 2100


def _empty_season(year: int, message: str) -> dict:
    """The honest payload for a season with no data to report."""
    return {
        "year": year,
        "status": "pre_season",
        "message": message,
        "team_standings": [],
        "driver_standings": [],
        "race_analytics": [],
        "next_race_event": None,
        "total_races": 0,
    }


def _find_next_session(schedule: pd.DataFrame, now_utc: pd.Timestamp):
    """First session on the calendar that starts after *now_utc*.

    Falls back to the next event's EventDate (Race) when FastF1 returns
    null Session*Date fields (offline/fallback schedule source).
    """
    fallback_event = None

    for _, event in schedule.iterrows():
        # Track the first event whose EventDate is still in the future
        # as a fallback in case all Session*Date fields are null.
        try:
            event_date = pd.to_datetime(event.get("EventDate"), utc=True)
        except (TypeError, ValueError):
            event_date = None
        if event_date is not None and event_date > now_utc and fallback_event is None:
            try:
                fallback_round = int(event.get("RoundNumber"))
            except (TypeError, ValueError):
                fallback_round = None
            fallback_event = {
                "name": f"{event['EventName']} - Race",
                "date": event_date.isoformat(),
                "round": fallback_round,
            }

        for i in range(1, 6):
            session_name_col = f"Session{i}"
            session_date_col = f"Session{i}Date"
            if session_date_col in event and pd.notna(event[session_date_col]):
                try:
                    session_date = pd.to_datetime(event[session_date_col], utc=True)
                except (TypeError, ValueError):
                    continue
                if session_date > now_utc:
                    session_name = event.get(session_name_col, "Session")
                    try:
                        rnd = int(event.get("RoundNumber"))
                    except (TypeError, ValueError):
                        rnd = None
                    return {
                        "name": f"{event['EventName']} - {session_name}",
                        "date": session_date.isoformat(),
                        "round": rnd,
                    }

    return fallback_event


def _build_driver_standings(
    races_to_process: pd.DataFrame, last_race_round: int, year: int
):
    """Aggregate per-driver / per-team points from every race + sprint."""
    all_driver_results = []
    last_race_driver_results = []
    team_wins_map = {}

    for _, race in races_to_process.iterrows():
        try:
            round_number = int(race["RoundNumber"])
        except (TypeError, ValueError):
            logging.warning(f"Skipping race with unreadable RoundNumber: {race}")
            continue

        is_last_race = round_number == last_race_round

        for session_type in ("R", "Sprint"):
            session = load_session_safe(
                year, round_number, session_type, **RACE_LOAD_KWARGS
            )
            if session is None:
                continue

            results = safe_getattr(session, "results")
            if results is None or getattr(results, "empty", True):
                continue

            needed = ["FirstName", "LastName", "TeamName", "Points", "Position"]
            if not set(needed).issubset(set(results.columns)):
                logging.warning(
                    f"Session {year}/{round_number}/{session_type} results missing "
                    f"columns {set(needed) - set(results.columns)}; skipped."
                )
                continue

            sub = results[needed].copy()
            sub["Points"] = pd.to_numeric(sub["Points"], errors="coerce").fillna(0.0)
            sub["Position"] = pd.to_numeric(sub["Position"], errors="coerce")
            all_driver_results.append(sub)
            if is_last_race:
                last_race_driver_results.append(sub)

            # Track wins per team: a win is a race finish in P1 (sprints excluded)
            # so constructor win totals reflect official Grand Prix victories only.
            if session_type == "R":
                p1_rows = sub[sub["Position"] == 1.0]
                for _, row in p1_rows.iterrows():
                    team_name = row["TeamName"]
                    if team_name and str(team_name).strip():
                        team_wins_map[team_name] = team_wins_map.get(team_name, 0) + 1

    if not all_driver_results:
        return None, None

    df_all_drivers = pd.concat(all_driver_results, ignore_index=True)
    print(f"DEBUG DASHBOARD: total session rows = {len(df_all_drivers)}")
    df_all_teams = df_all_drivers[["TeamName", "Points"]]
    total_team_standings = df_all_teams.groupby("TeamName", as_index=False)[
        "Points"
    ].sum()

    # Add race wins computed above (official race wins only, no sprint wins).
    total_team_standings["wins"] = (
        total_team_standings["TeamName"]
        .apply(lambda x: team_wins_map.get(x, 0))
        .astype(int)
    )

    if last_race_driver_results:
        df_last_race = pd.concat(last_race_driver_results, ignore_index=True)
        last_race_team_points = df_last_race.groupby("TeamName", as_index=False)[
            "Points"
        ].sum()
        last_race_team_points.rename(
            columns={"Points": "points_last_race"}, inplace=True
        )
        dashboard_teams = pd.merge(
            total_team_standings, last_race_team_points, on="TeamName", how="left"
        )
        dashboard_teams["points_last_race"] = (
            dashboard_teams["points_last_race"].fillna(0).astype(int)
        )
    else:
        dashboard_teams = total_team_standings.copy()
        dashboard_teams["points_last_race"] = 0

    dashboard_teams = dashboard_teams.sort_values(
        by="Points", ascending=False
    ).reset_index(drop=True)
    dashboard_teams.rename(
        columns={"TeamName": "name", "Points": "points"}, inplace=True
    )

    df_all_drivers.dropna(subset=["FirstName", "LastName"], inplace=True)
    df_all_drivers["FullName"] = (
        df_all_drivers["FirstName"] + " " + df_all_drivers["LastName"]
    )
    dashboard_drivers = (
        df_all_drivers.groupby("FullName")
        .agg(points=("Points", "sum"), team=("TeamName", "last"))
        .reset_index()
    )
    dashboard_drivers = dashboard_drivers.sort_values(
        by="points", ascending=False
    ).reset_index(drop=True)
    dashboard_drivers.rename(columns={"FullName": "name"}, inplace=True)

    return dashboard_teams, dashboard_drivers


def _build_race_analytics(schedule: pd.DataFrame, year: int, today: pd.Timestamp):
    """The last two finished races plus the next two upcoming ones.

    Four entries keep the dashboard card visually balanced with the seven-row
    driver standings list (2 finished + 2 upcoming; a live race adds a fifth).
    """
    analytics = []

    try:
        official = schedule[schedule["EventName"].str.contains("Grand Prix", na=False)]
        event_date = official["EventDate"].dt.normalize()
        completed = official[event_date < today]
        ongoing = official[event_date == today]
        upcoming = official[event_date > today]
        races_for_analytics = pd.concat(
            [completed.tail(2), ongoing.head(1), upcoming.head(2)]
        )
    except Exception as e:  # noqa: BLE001
        logging.warning(f"Could not select races for analytics ({year}): {e}")
        return analytics

    for _, race in races_for_analytics.iterrows():
        try:
            race_date = pd.to_datetime(race["EventDate"], errors="coerce").normalize()
            if pd.isna(race_date):
                continue
        except (TypeError, ValueError, OSError):
            continue

        status = "Finished"
        if race_date > today:
            status = "Upcoming"
        elif race_date == today:
            status = "Ongoing"

        # Use race_date (already a normalized, validated Timestamp) to build
        # the ISO date string — avoids a second pd.to_datetime + strftime call
        # that can raise OSError on Windows for certain Timestamp values.
        race_info = {
            "round": int(race["RoundNumber"]),
            "name": race["EventName"],
            "date": race_date.date().isoformat(),
            "location": race.get("Location", ""),
            "status": status,
            "winner": None,
        }

        if status == "Finished":
            session = load_session_safe(
                year, race_info["round"], "R", **ANALYTICS_LOAD_KWARGS
            )
            winner_name = "Data not available"
            if session is not None and has_rows(session, "results"):
                try:
                    winner = safe_getattr(session, "results").iloc[0]
                    winner_name = f"{winner['FirstName']} {winner['LastName']}"
                except Exception:  # noqa: BLE001
                    pass
            race_info["winner"] = winner_name

        if not any(d["name"] == race_info["name"] for d in analytics):
            analytics.append(race_info)

    return analytics


def compute_fastf1_dashboard(year: int):
    # A year outside the F1 era cannot have a schedule. Report pre-season with
    # empty standings instead of surfacing FastF1's own lookup failure.
    if not is_valid_year(year):
        print(f"  -> Tahun {year} di luar rentang musim F1. Mengirim pre_season.")
        return _empty_season(year, f"The {year} season has no data.")

    logging.info("[Dashboard] Computing dashboard data...")
    today = pd.to_datetime("today").normalize()
    now_utc = pd.to_datetime("now", utc=True)

    schedule = load_event_schedule(year, include_testing=False)
    if schedule is None or schedule.empty:
        print(f"  -> Tidak ada jadwal untuk musim {year}. Mengirim status pre_season.")
        return _empty_season(
            year,
            f"The {year} season has not started yet. Data will be available "
            f"after the first race.",
        )

    try:
        official_races = schedule[
            schedule["EventName"].str.contains("Grand Prix", na=False)
        ]
        event_dates = official_races["EventDate"].dt.normalize()
        completed_races = official_races[event_dates < today].copy()
        ongoing_races = official_races[event_dates == today].copy()
    except Exception as e:  # noqa: BLE001
        logging.warning(f"Could not partition schedule for {year}: {e}")
        return _empty_season(year, f"The {year} season schedule could not be read.")

    # Penanganan Pra-Musim (sudah diupdate dengan logika countdown)
    if completed_races.empty and ongoing_races.empty:
        print(f"  -> Musim {year} belum dimulai. Mengirim status pre_season.")
        pre_season_data = _empty_season(
            year,
            f"The {year} season has not started yet. Data will be available "
            f"after the first race.",
        )
        pre_season_data["total_races"] = len(official_races)
        pre_season_data["next_race_event"] = _find_next_session(schedule, now_utc)
        return pre_season_data

    last_race = completed_races.iloc[-1] if not completed_races.empty else None
    last_race_name = last_race["EventName"] if last_race is not None else "N/A"
    try:
        last_race_round = int(last_race["RoundNumber"]) if last_race is not None else 0
    except (TypeError, ValueError):
        last_race_round = 0
    if last_race is not None:
        print(
            f"  -> Balapan terakhir teridentifikasi: {last_race_name} (Ronde {last_race_round})"
        )

    races_to_process = pd.concat([completed_races, ongoing_races])

    final_data = {
        "year": year,
        "last_race_name": last_race_name,
        "team_standings": [],
        "driver_standings": [],
        "race_analytics": [],
        "next_race_event": None,
        "total_races": len(official_races),
    }

    dashboard_teams, dashboard_drivers = _build_driver_standings(
        races_to_process, last_race_round, year
    )
    if dashboard_teams is not None:
        final_data["team_standings"] = dashboard_teams.to_dict(orient="records")
    if dashboard_drivers is not None:
        final_data["driver_standings"] = dashboard_drivers.to_dict(orient="records")

    next_race_event = _find_next_session(schedule, now_utc)
    if next_race_event:
        print(
            f"  -> Sesi selanjutnya ditemukan: {next_race_event['name']} "
            f"pada {next_race_event['date']}"
        )
        final_data["next_race_event"] = next_race_event
    else:
        print(f"  -> Tidak ada sesi balapan selanjutnya di musim {year}.")

    final_data["race_analytics"] = _build_race_analytics(schedule, year, today)

    from services.championship_service import clean_nans

    return clean_nans(final_data)
