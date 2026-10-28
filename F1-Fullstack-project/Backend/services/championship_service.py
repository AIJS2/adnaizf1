import logging
import pandas as pd

from services.fastf1_safe import (
    is_valid_year,
    load_event_schedule,
    load_session_safe,
    safe_getattr,
)

LOAD_KWARGS = dict(telemetry=False, weather=False, laps=False, messages=False)

REQUIRED_COLUMNS = [
    "DriverNumber",
    "Abbreviation",
    "FirstName",
    "LastName",
    "TeamName",
    "Position",
    "Status",
    "ClassifiedPosition",
    "GridPosition",
]


def _empty_season(year: int, message: str) -> dict:
    """The honest payload for a season with no standings to report."""
    return {
        "year": year,
        "status": "pre_season",
        "message": message,
        "teams": [],
        "drivers": [],
        "session_results": [],
    }


def is_dns_status(status) -> bool:
    """True when a result row represents a Did-Not-Start (DNS).

    Shared with the driver/team profile endpoints so /stats and
    /driver|/team can never disagree on what counts as a DNS.
    """
    status_str = str(status or "").lower()
    return "did not start" in status_str or "dns" in status_str


def is_dnf_classified(classified_position, status=None) -> bool:
    """True when a result row is a DNF (retired / excluded / withdrawn).

    A DNS is never a DNF, so the DNS status takes precedence. Uses the exact
    predicate the profile endpoints use, keeping every surface consistent.
    """
    if is_dns_status(status):
        return False
    return str(classified_position or "") in ("R", "D", "E", "W")


def _collect_results(year: int, races_to_process: pd.DataFrame):
    """Load every race/sprint/qualifying result row for the given rounds."""
    all_results_df = []

    for _, race in races_to_process.iterrows():
        try:
            round_number = int(race["RoundNumber"])
        except (TypeError, ValueError):
            logging.warning(f"Skipping race with unreadable RoundNumber: {race}")
            continue
        for session_type in ("R", "Sprint", "Q"):
            session = load_session_safe(year, round_number, session_type, **LOAD_KWARGS)
            if session is None:
                continue

            results = safe_getattr(session, "results")
            if results is None or getattr(results, "empty", True):
                continue

            needed = [c for c in REQUIRED_COLUMNS if c in results.columns]
            if not set(REQUIRED_COLUMNS).issubset(set(results.columns)):
                # A partial results frame cannot feed the standings maths, so
                # skip this session rather than emit wrong numbers.
                logging.warning(
                    f"Session {year}/{round_number}/{session_type} results missing "
                    f"columns {set(REQUIRED_COLUMNS) - set(results.columns)}; skipped."
                )
                continue

            sub_df = results[needed].copy()
            sub_df["Points"] = pd.to_numeric(
                results.get("Points", 0), errors="coerce"
            ).fillna(0.0)
            # Keep a missing position as NaN (serialised as null) instead of
            # stamping a sentinel 99 — downstream code renders null as "-"
            # rather than "P99".
            sub_df["Position"] = pd.to_numeric(sub_df["Position"], errors="coerce")
            sub_df["SessionType"] = session_type
            sub_df["RoundNumber"] = int(round_number)
            sub_df["EventName"] = str(race.get("EventName", ""))
            sub_df["Location"] = str(race.get("Location", ""))
            all_results_df.append(sub_df)

    return all_results_df


def compute_fastf1_championship(year: int):
    # A year outside the F1 era cannot have a schedule. Answering "pre-season"
    # with empty standings is the honest payload, instead of a 500 or a
    # misleading "internal error" from FastF1's own schedule lookup.
    if not is_valid_year(year):
        logging.info(f"  -> Tahun {year} di luar rentang musim F1. Mengirim pre_season.")
        return _empty_season(
            year, f"No championship data exists for the {year} season."
        )

    logging.info("Menghitung total klasemen (Teams & Drivers) dengan data lengkap...")
    schedule = load_event_schedule(year, include_testing=False)
    if schedule is None or schedule.empty:
        logging.info(f"  -> Tidak ada jadwal untuk musim {year}. Mengirim status pre_season.")
        return _empty_season(
            year,
            f"The {year} season schedule is not available. Championship "
            f"standings will be available once races have run.",
        )

    official_races = schedule[
        schedule["EventName"].str.contains("Grand Prix", na=False)
    ]
    today = pd.Timestamp.now(tz="UTC").normalize()
    races_to_process = official_races[
        pd.to_datetime(official_races["EventDate"], utc=True).dt.normalize() <= today
    ]

    if races_to_process.empty:
        logging.info(
            f"  -> Musim {year} belum dimulai. Mengirim status pre_season untuk Championship."
        )
        return _empty_season(
            year,
            f"The {year} season has not started yet. Championship standings "
            f"will be available after the first race.",
        )

    last_race_round = races_to_process["RoundNumber"].max()
    logging.info(f"  -> Ronde balapan terakhir teridentifikasi: {last_race_round}")

    all_results_df = _collect_results(year, races_to_process)
    if not all_results_df:
        # Every session failed to load (upstream outage / data not yet
        # mirrored). Report empty standings rather than an error envelope so
        # the UI can render an explicit "no data" state.
        logging.warning(
            f"No race data could be loaded for {year}; returning empty standings."
        )
        return _empty_season(
            year,
            f"No race results are currently available for the {year} season.",
        )

    df_full = pd.concat(all_results_df, ignore_index=True)
    # Chronological order before `agg(team=("TeamName","last"))` so a mid-season
    # transfer resolves to the team at the latest round, not the last row seen.
    df_full = df_full.sort_values("RoundNumber", kind="stable")
    logging.info(f"DEBUG CHAMPIONSHIP: total session rows = {len(df_full)}")
    df_full.dropna(subset=["FirstName", "LastName"], inplace=True)
    df_full["FullName"] = df_full["FirstName"] + " " + df_full["LastName"]

    # Hanya R dan Sprint yang menghasilkan poin kejuaraan
    df_points_sessions = df_full[df_full["SessionType"].isin(["R", "Sprint"])]
    df_race_only = df_full[df_full["SessionType"] == "R"]

    # DNF/DNS are counted across every points-scoring race session (Grand Prix
    # + Sprint) with the same predicate the profile endpoints use, so /stats,
    # /driver and /team can never disagree on the totals.
    df_race_weekend = df_points_sessions
    weekend_status = df_race_weekend["Status"].astype(str).str.lower()
    weekend_dns = weekend_status.str.contains(
        "did not start", na=False
    ) | weekend_status.str.contains("dns", na=False)
    weekend_dnf = (
        df_race_weekend["ClassifiedPosition"].isin(["R", "D", "E", "W"]) & ~weekend_dns
    )

    team_points = df_points_sessions.groupby("TeamName")["Points"].sum()
    team_wins = df_race_only[df_race_only["Position"] == 1].groupby("TeamName").size()
    team_podiums = (
        df_race_only[df_race_only["Position"] <= 3].groupby("TeamName").size()
    )
    team_dnfs = df_race_weekend[weekend_dnf].groupby("TeamName").size()
    team_dnss = df_race_weekend[weekend_dns].groupby("TeamName").size()
    team_standings = pd.DataFrame(team_points).rename(columns={"Points": "points"})
    team_standings["wins"] = team_wins
    team_standings["podiums"] = team_podiums
    team_standings["dnfs"] = team_dnfs
    team_standings["dnss"] = team_dnss
    team_standings.fillna(0, inplace=True)
    team_standings = team_standings.astype(int).reset_index()
    team_standings.rename(columns={"TeamName": "name"}, inplace=True)

    df_last_race = df_points_sessions[
        df_points_sessions["RoundNumber"] == last_race_round
    ]
    last_race_team_points = (
        df_last_race.groupby("TeamName")["Points"].sum().reset_index()
    )
    last_race_team_points.rename(
        columns={"Points": "points_last_race", "TeamName": "name"}, inplace=True
    )

    team_standings = pd.merge(
        team_standings, last_race_team_points, on="name", how="left"
    )
    team_standings["points_last_race"] = (
        team_standings["points_last_race"].fillna(0).astype(int)
    )

    team_standings = team_standings.sort_values(
        by="points", ascending=False
    ).reset_index(drop=True)
    team_standings["position"] = team_standings.index + 1
    team_standings["id"] = (
        team_standings["name"].str.lower().str.replace(" ", "_", regex=False)
    )

    driver_standings = (
        df_points_sessions.groupby("FullName")
        .agg(
            team=("TeamName", "last"),
            points=("Points", "sum"),
            driver_number=("DriverNumber", "last"),
            abbreviation=("Abbreviation", "last"),
        )
        .reset_index()
    )

    driver_wins = (
        df_race_only[df_race_only["Position"] == 1]
        .groupby("FullName")
        .size()
        .rename("wins")
    )
    driver_podiums = (
        df_race_only[df_race_only["Position"] <= 3]
        .groupby("FullName")
        .size()
        .rename("podiums")
    )
    driver_dnfs = df_race_weekend[weekend_dnf].groupby("FullName").size().rename("dnfs")
    driver_dnss = df_race_weekend[weekend_dns].groupby("FullName").size().rename("dnss")
    last_race_driver_points = (
        df_last_race.groupby("FullName")["Points"].sum().rename("points_last_race")
    )

    driver_standings = driver_standings.merge(driver_wins, on="FullName", how="left")
    driver_standings = driver_standings.merge(driver_podiums, on="FullName", how="left")
    driver_standings = driver_standings.merge(driver_dnfs, on="FullName", how="left")
    driver_standings = driver_standings.merge(driver_dnss, on="FullName", how="left")
    driver_standings = driver_standings.merge(
        last_race_driver_points, on="FullName", how="left"
    )

    cols_to_fill = ["wins", "podiums", "dnfs", "dnss", "points_last_race"]
    driver_standings[cols_to_fill] = (
        driver_standings[cols_to_fill].fillna(0).astype(int)
    )
    driver_standings["driver_number"] = (
        pd.to_numeric(driver_standings["driver_number"], errors="coerce")
        .fillna(0)
        .astype(int)
    )

    driver_standings = driver_standings.sort_values(
        by="points", ascending=False
    ).reset_index(drop=True)
    driver_standings["position"] = driver_standings.index + 1
    driver_standings.rename(columns={"FullName": "name"}, inplace=True)
    driver_standings["id"] = (
        driver_standings["name"].str.lower().str.replace(" ", "_", regex=False)
    )

    final_data = {
        "year": year,
        "total_completed_rounds": int(last_race_round) if last_race_round else 0,
        "teams": team_standings.to_dict(orient="records"),
        "drivers": driver_standings.to_dict(orient="records"),
        "session_results": df_full[
            [
                "RoundNumber",
                "FullName",
                "TeamName",
                "Position",
                "Points",
                "SessionType",
                "Abbreviation",
                "EventName",
                "Location",
                "Status",
                "ClassifiedPosition",
                "GridPosition",
            ]
        ].to_dict(orient="records"),
    }

    return clean_nans(final_data)


def clean_nans(obj):
    """Recursively convert pandas NaN/NaT to None so the payload is JSON-safe."""
    if isinstance(obj, list):
        return [clean_nans(i) for i in obj]
    if isinstance(obj, dict):
        return {k: clean_nans(v) for k, v in obj.items()}
    try:
        if pd.isna(obj):
            return None
    except (TypeError, ValueError):
        pass
    return obj
