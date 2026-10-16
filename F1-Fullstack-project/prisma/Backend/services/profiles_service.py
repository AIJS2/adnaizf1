import logging
from services.championship_service import (
    clean_nans,
    is_dnf_classified,
    is_dns_status,
)


def _safe_float(value, default: float = 0.0) -> float:
    """Coerce a backend numeric field (number or numeric string) to float."""
    try:
        if value is None or value == "":
            return default
        return float(value)
    except (TypeError, ValueError):
        return default

def _safe_int(value, default: int = 0) -> int:
    try:
        if value is None or value == "":
            return default
        return int(float(value))
    except (TypeError, ValueError):
        return default


def _grid_position(row) -> int:
    """Starting grid slot; 0 when FastF1 has no value (pit lane / unknown)."""
    grid_val = row.get("GridPosition", 0)
    if str(grid_val).lower() in ("nan", "", "none"):
        return 0
    return _safe_int(grid_val, 0)


def _session_result_label(row):
    """Render one race/sprint row's result: position, DNF, DNS, or '-'."""
    if not row:
        return None
    if is_dns_status(row.get("Status")):
        return "DNS"
    if is_dnf_classified(row.get("ClassifiedPosition"), row.get("Status")):
        return "DNF"
    pos = _safe_int(row.get("Position", 99), 99)
    return pos if pos < 90 else "-"


def _incident_detail(row, driver_name: str = "", abbreviation: str = ""):
    """One entry of the dnf_details / dns_details breakdown arrays.

    Covers both points-scoring sessions: Grand Prix (`R`) and Sprint.
    """
    return {
        "round": _safe_int(row.get("RoundNumber", 0)),
        "race_name": row.get("EventName") or f"Round {row.get('RoundNumber', '?')}",
        "location": row.get("Location", ""),
        "session_type": "Sprint" if row.get("SessionType") == "Sprint" else "Race",
        "status": str(row.get("Status", "")),
        "grid": _grid_position(row),
        "position_text": "DNS" if is_dns_status(row.get("Status")) else "DNF",
        "driver_name": driver_name,
        "driver_abbreviation": abbreviation,
    }

def process_driver_profile(champ_data: dict, year: int, driver_id: str):
    try:
        drivers = champ_data.get("drivers", [])
        clean_id = str(driver_id or "").lower().replace("-", "_")

        # Cari driver berdasarkan ID, Nama, atau Abbr
        driver = next(
            (
                d for d in drivers
                if d.get("id") == clean_id
                or str(d.get("name", "")).lower() == clean_id.replace("_", " ")
                or str(d.get("abbreviation", "")).lower() == clean_id
            ),
            None,
        )

        if not driver:
            return {"error": f"Driver '{driver_id}' not found in {year} season."}

        # Cari rekan setim
        teammate = next(
            (
                d for d in drivers
                if d.get("team") == driver.get("team") and d.get("name") != driver.get("name")
            ),
            None,
        )

        session_results = champ_data.get("session_results", [])
        driver_name = driver.get("name", "")

        if not session_results or len(session_results) == 0:
            # No session results available — fall back to standings-only profile (no mock data)
            return clean_nans({
                "name": driver_name,
                "id": driver.get("id", ""),
                "abbreviation": driver.get("abbreviation", ""),
                "driver_number": _safe_int(driver.get("driver_number", 0)),
                "team": driver.get("team", ""),
                "position": _safe_int(driver.get("position", 0)),
                "points": _safe_float(driver.get("points", 0)),
                "wins": _safe_int(driver.get("wins", 0)),
                "podiums": _safe_int(driver.get("podiums", 0)),
                "poles": _safe_int(driver.get("poles", 0)),
                "best_finish": None,
                "avg_finish": None,
                "dnfs": 0,
                "dnss": 0,
                "race_dnfs": 0,
                "sprint_dnfs": 0,
                "race_dnss": 0,
                "sprint_dnss": 0,
                "dnf_details": [],
                "dns_details": [],
                "progression": [],
                "teammate": {
                    "name": teammate.get("name", "") if teammate else "",
                    "id": teammate.get("id", "") if teammate else "",
                    "abbreviation": teammate.get("abbreviation", "") if teammate else "",
                    "driver_number": _safe_int(teammate.get("driver_number", 0)) if teammate else 0,
                    "points": _safe_float(teammate.get("points", 0)) if teammate else 0,
                    "position": _safe_int(teammate.get("position", 0)) if teammate else 0,
                    "race_h2h": {"driver_ahead": 0, "teammate_ahead": 0},
                    "quali_h2h": {"driver_ahead": 0, "teammate_ahead": 0},
                } if teammate else None,
            })

        # Index every session row by (FullName, RoundNumber, SessionType) ONCE.
        by_key = {
            (r.get("FullName"), r.get("RoundNumber"), r.get("SessionType")): r
            for r in session_results
        }

        # Sprint points per round, pre-summed for this driver only.
        sprint_pts_by_round = {}
        for s in session_results:
            if s.get("SessionType") == "Sprint" and s.get("FullName") == driver_name:
                rnd = s.get("RoundNumber")
                sprint_pts_by_round[rnd] = sprint_pts_by_round.get(rnd, 0.0) + _safe_float(
                    s.get("Points", 0)
                )

        driver_races = sorted(
            (
                r for r in session_results
                if r.get("FullName") == driver_name and r.get("SessionType") == "R"
            ),
            key=lambda x: x.get("RoundNumber", 0),
        )

        # Every points-scoring race-weekend session (Grand Prix + Sprint) is
        # scanned for DNF/DNS incidents. This uses the exact predicates the
        # championship endpoint uses, so the driver card, /stats, and the
        # championship table always agree on the totals.
        driver_weekend_sessions = sorted(
            (
                r for r in session_results
                if r.get("FullName") == driver_name
                and r.get("SessionType") in ("R", "Sprint")
            ),
            key=lambda x: (x.get("RoundNumber", 0), str(x.get("SessionType", ""))),
        )

        teammate_name = teammate.get("name", "") if teammate else ""
        driver_abbreviation = driver.get("abbreviation", "")

        progression = []
        cum_points = 0.0
        positions_classified = []
        dnfs = 0
        dnss = 0
        race_dnfs = 0
        sprint_dnfs = 0
        race_dnss = 0
        sprint_dnss = 0
        dnf_details = []
        dns_details = []

        for r in driver_weekend_sessions:
            is_sprint = r.get("SessionType") == "Sprint"
            if is_dns_status(r.get("Status")):
                dnss += 1
                if is_sprint:
                    sprint_dnss += 1
                else:
                    race_dnss += 1
                dns_details.append(_incident_detail(r, driver_name, driver_abbreviation))
            elif is_dnf_classified(r.get("ClassifiedPosition"), r.get("Status")):
                dnfs += 1
                if is_sprint:
                    sprint_dnfs += 1
                else:
                    race_dnfs += 1
                dnf_details.append(_incident_detail(r, driver_name, driver_abbreviation))

        def _teammate_position(tm_row):
            if not tm_row:
                return "—"
            if is_dns_status(tm_row.get("Status")):
                return "DNS"
            if is_dnf_classified(tm_row.get("ClassifiedPosition"), tm_row.get("Status")):
                return "DNF"
            pos = _safe_int(tm_row.get("Position", 99), 99)
            # A missing position (null / legacy sentinel) must render as "-",
            # never as "P99".
            return pos if pos < 90 else "-"

        for r in driver_races:
            rnd = r.get("RoundNumber", 0)
            pts = _safe_float(r.get("Points", 0))
            # Tambahkan poin sprint jika ada di ronde ini (O(1) lookup)
            sprint_pts = sprint_pts_by_round.get(rnd, 0.0)
            total_round_pts = pts + sprint_pts
            cum_points += total_round_pts

            pos = _safe_int(r.get("Position", 99), 99)
            status_str = str(r.get("Status", "")).lower()
            classified_pos = str(r.get("ClassifiedPosition", ""))

            is_dns = "did not start" in status_str or "dns" in status_str
            is_dnf = classified_pos in ("R", "D", "E", "W")

            if not (is_dns or is_dnf) and pos < 90:
                positions_classified.append(pos)

            tm_r = by_key.get((teammate_name, rnd, "R"))  # O(1) lookup
            sprint_r = by_key.get((driver_name, rnd, "Sprint"))  # O(1) lookup

            progression.append({
                "round": rnd,
                "race_name": r.get("EventName") or f"Round {rnd}",
                "location": r.get("Location", ""),
                # Never expose the legacy 99 sentinel: a missing classification
                # shows as "-" (or the real DNF/DNS status).
                "position": "DNS" if is_dns else ("DNF" if is_dnf else (pos if pos < 90 else "-")),
                "grid_position": _grid_position(r),
                "status": str(r.get("Status", "")),
                "points": total_round_pts,
                "race_points": pts,
                "sprint_points": sprint_pts,
                "sprint_position": _session_result_label(sprint_r),
                "sprint_status": str(sprint_r.get("Status", "")) if sprint_r else None,
                "cumulative_points": cum_points,
                "teammate_position": _teammate_position(tm_r),
                "teammate_points": _safe_float(tm_r.get("Points", 0)) if tm_r else 0.0,
            })

        # Head to Head vs Teammate
        race_ahead = 0
        tm_race_ahead = 0
        quali_ahead = 0
        tm_quali_ahead = 0

        if teammate:
            for r in driver_races:
                rnd = r.get("RoundNumber", 0)
                tm_r = by_key.get((teammate_name, rnd, "R"))
                if not tm_r:
                    continue
                my_pos = _safe_int(r.get("Position", 99), 99)
                tm_pos = _safe_int(tm_r.get("Position", 99), 99)
                if my_pos < tm_pos:
                    race_ahead += 1
                elif tm_pos < my_pos:
                    tm_race_ahead += 1

            driver_qualis = [
                q for q in session_results
                if q.get("FullName") == driver_name and q.get("SessionType") == "Q"
            ]
            for q in driver_qualis:
                rnd = q.get("RoundNumber", 0)
                tm_q = by_key.get((teammate_name, rnd, "Q"))
                if not tm_q:
                    continue
                my_pos = _safe_int(q.get("Position", 99), 99)
                tm_pos = _safe_int(tm_q.get("Position", 99), 99)
                if my_pos < tm_pos:
                    quali_ahead += 1
                elif tm_pos < my_pos:
                    tm_quali_ahead += 1

        poles = sum(
            1 for q in session_results
            if q.get("FullName") == driver_name
            and q.get("SessionType") == "Q"
            and _safe_int(q.get("Position", 99), 99) == 1
        )
        best_finish = min(positions_classified) if positions_classified else None
        avg_finish = (
            round(sum(positions_classified) / len(positions_classified), 1)
            if positions_classified else None
        )

        return clean_nans({
            "name": driver_name,
            "id": driver.get("id", ""),
            "abbreviation": driver.get("abbreviation", ""),
            "driver_number": _safe_int(driver.get("driver_number", 0)),
            "team": driver.get("team", ""),
            "position": _safe_int(driver.get("position", 0)),
            "points": _safe_float(driver.get("points", 0)),
            "wins": _safe_int(driver.get("wins", 0)),
            "podiums": _safe_int(driver.get("podiums", 0)),
            "poles": poles,
            "best_finish": best_finish,
            "avg_finish": avg_finish,
            "dnfs": dnfs,
            "dnss": dnss,
            "race_dnfs": race_dnfs,
            "sprint_dnfs": sprint_dnfs,
            "race_dnss": race_dnss,
            "sprint_dnss": sprint_dnss,
            "dnf_details": dnf_details,
            "dns_details": dns_details,
            "progression": progression,
            "teammate": {
                "name": teammate_name,
                "id": teammate.get("id", ""),
                "abbreviation": teammate.get("abbreviation", ""),
                "driver_number": _safe_int(teammate.get("driver_number", 0)),
                "points": _safe_float(teammate.get("points", 0)),
                "position": _safe_int(teammate.get("position", 0)),
                "race_h2h": {"driver_ahead": race_ahead, "teammate_ahead": tm_race_ahead},
                "quali_h2h": {"driver_ahead": quali_ahead, "teammate_ahead": tm_quali_ahead},
            } if teammate else None,
        })
    except Exception as e:
        logging.error(f"Error memuat profil driver: {e}", exc_info=True)
        return {"error": "Driver profile data is currently unavailable."}

def process_team_profile(champ_data: dict, year: int, team_id: str):
    try:
        teams = champ_data.get("teams", [])
        clean_id = str(team_id or "").lower().replace("-", "_")

        team = next(
            (
                t for t in teams
                if t.get("id") == clean_id
                or str(t.get("name", "")).lower() == clean_id.replace("_", " ")
            ),
            None,
        )
        if not team:
            return {"error": f"Team '{team_id}' not found in {year} season."}

        team_name = team.get("name", "")
        drivers = [
            d for d in champ_data.get("drivers", []) if d.get("team") == team_name
        ]

        # A team on 0 points must not divide by zero; the share is simply 0%.
        total_team_points = max(_safe_float(team.get("points", 0)), 1.0)

        team_drivers = []
        for d in drivers:
            share = round((_safe_float(d.get("points", 0)) / total_team_points) * 100, 1)
            team_drivers.append({
                "name": d.get("name", ""),
                "id": d.get("id", ""),
                "abbreviation": d.get("abbreviation", ""),
                "driver_number": _safe_int(d.get("driver_number", 0)),
                "points": _safe_float(d.get("points", 0)),
                "position": _safe_int(d.get("position", 0)),
                "points_share": share,
            })

        session_results = champ_data.get("session_results", [])

        if not session_results or len(session_results) == 0:
            return clean_nans({
                "name": team_name,
                "id": team.get("id", ""),
                "position": _safe_int(team.get("position", 0)),
                "points": _safe_float(team.get("points", 0)),
                "wins": _safe_int(team.get("wins", 0)),
                "podiums": _safe_int(team.get("podiums", 0)),
                "dnfs": 0,
                "dnss": 0,
                "race_dnfs": 0,
                "sprint_dnfs": 0,
                "race_dnss": 0,
                "sprint_dnss": 0,
                "dnf_details": [],
                "dns_details": [],
                "drivers": team_drivers,
                "progression": [],
            })

        team_races = [
            r for r in session_results
            if r.get("TeamName") == team_name and r.get("SessionType") in ("R", "Sprint")
        ]

        # DNF/DNS are counted across every points-scoring race session (Grand
        # Prix + Sprint) with the same predicates /stats uses, so the team card
        # and the championship table can never disagree.
        dnfs = 0
        dnss = 0
        race_dnfs = 0
        sprint_dnfs = 0
        race_dnss = 0
        sprint_dnss = 0
        dnf_details = []
        dns_details = []

        for r in sorted(
            team_races,
            key=lambda x: (x.get("RoundNumber", 0), str(x.get("SessionType", "")), str(x.get("FullName", ""))),
        ):
            is_sprint = r.get("SessionType") == "Sprint"
            row_driver_name = r.get("FullName", "")
            row_abbreviation = r.get("Abbreviation", "")
            if is_dns_status(r.get("Status")):
                dnss += 1
                if is_sprint:
                    sprint_dnss += 1
                else:
                    race_dnss += 1
                dns_details.append(_incident_detail(r, row_driver_name, row_abbreviation))
            elif is_dnf_classified(r.get("ClassifiedPosition"), r.get("Status")):
                dnfs += 1
                if is_sprint:
                    sprint_dnfs += 1
                else:
                    race_dnfs += 1
                dnf_details.append(_incident_detail(r, row_driver_name, row_abbreviation))

        progression = []
        rounds = sorted({r.get("RoundNumber", 0) for r in team_races})
        cum_points = 0.0

        for rnd in rounds:
            rnd_pts = sum(
                _safe_float(r.get("Points", 0)) for r in team_races if r.get("RoundNumber") == rnd
            )
            cum_points += rnd_pts
            first_entry = next(
                (r for r in team_races if r.get("RoundNumber") == rnd), {}
            )
            progression.append({
                "round": rnd,
                "race_name": first_entry.get("EventName") or f"Round {rnd}",
                "location": first_entry.get("Location", ""),
                "points": rnd_pts,
                "cumulative_points": cum_points,
            })

        return clean_nans({
            "name": team_name,
            "id": team.get("id", ""),
            "position": _safe_int(team.get("position", 0)),
            "points": _safe_float(team.get("points", 0)),
            "wins": _safe_int(team.get("wins", 0)),
            "podiums": _safe_int(team.get("podiums", 0)),
            "dnfs": dnfs,
            "dnss": dnss,
            "race_dnfs": race_dnfs,
            "sprint_dnfs": sprint_dnfs,
            "race_dnss": race_dnss,
            "sprint_dnss": sprint_dnss,
            "dnf_details": dnf_details,
            "dns_details": dns_details,
            "drivers": team_drivers,
            "progression": progression,
        })
    except Exception as e:
        logging.error(f"Error memuat profil team: {e}", exc_info=True)
        return {"error": "Team profile data is currently unavailable."}
