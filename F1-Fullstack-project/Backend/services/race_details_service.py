import pandas as pd
import fastf1
import logging
from datetime import timedelta
from config.cache import set_advanced_cache

from services.fastf1_safe import (
    has_rows,
    is_valid_year,
    load_event_schedule,
    load_session_safe,
    safe_getattr,
)
from services import openf1_service
from services import openf1_lap_fallback

DETAIL_LOAD_KWARGS = dict(laps=True, telemetry=False, weather=True, messages=True)
LIGHT_LOAD_KWARGS = dict(laps=True, telemetry=False, weather=False, messages=False)


def _classified_status_label(classified_position, status):
    """FastF1's classification code -> the app's status vocabulary.

    'W' is a withdrawal (did not start) and 'D'/'E' a disqualification, so they
    must not be lumped into "DNF": a non-starter is not a retirement, and the
    race table should say so.
    """
    status_text = str(status or "").strip().lower()
    code = str(classified_position or "").strip().upper()
    if code == "W" or "did not start" in status_text:
        return "DNS"
    if code in ("D", "E") or "disqualif" in status_text or "excluded" in status_text:
        return "DSQ"
    if code == "R":
        return "DNF"
    return None


def _empty_race_payload(event: pd.Series, status: str, message: str) -> dict:
    """Shape every response shares, so the UI can rely on all keys existing."""
    return {
        "race_info": {
            "name": event["EventName"],
            "location": event.get("Location", ""),
            "country": str(event.get("Country", "")),
        },
        "status": status,
        "message": message,
        "available_tabs": [],
        "race_winner": None,
        "pole_position": None,
        "fastest_lap": None,
        "results": None,
        "starting_grid": None,
        "qualifying_results": None,
        "sprint_results": None,
        "sprint_grid_results": None,
        "sprint_qualifying_results": None,
        "practice1_results": None,
        "practice2_results": None,
        "practice3_results": None,
        "tyre_strategy": None,
        "speed_traps": None,
        "sector_matrix": None,
        "weather_info": None,
        "lap_chart": None,
        "gap_chart": None,
        "lap_times_chart": None,
    }


def _compute_race_details(year: int, round_number: int, cache_file: str = None):
    print(f"Menghitung data DETAIL SUPER LENGKAP untuk {year} Ronde {round_number}...")

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

    # --- OpenF1 fallback -------------------------------------------------
    # FastF1's results frame is empty or NaN-filled while F1's own archive has
    # not finalised a session, even hours after the race. OpenF1's
    # session_result is already complete in that window, so it stands in for
    # the classification only. Everything derived from FastF1 laps (tyre
    # strategy, speed traps, sectors, charts) is untouched.
    _openf1_key_cache: dict[str, int] = {}

    def openf1_session_key(session_name: str, session_code: str):
        """Cached OpenF1 `session_key` lookup; None when OpenF1 has no match.

        `session_name` is the app's label ('Sprint', 'Race', ...); the cache is
        keyed on it because a race weekend has at most one of each.
        """
        key = _openf1_key_cache.get(session_name)
        if key is None:
            # The circuit disambiguates a season's 20+ sessions named
            # "Race"; without it session_key_for refuses to guess.
            key = openf1_service.session_key_for(
                year, round_number, session_code,
                circuit=event.get("Location"),
            )
            _openf1_key_cache[session_name] = key if key is not None else 0
        return key or None

    def openf1_rows_for(session_name: str, session_code: str) -> list:
        """Classification rows from OpenF1, or [] when it has nothing."""
        try:
            key = openf1_session_key(session_name, session_code)
            rows = openf1_service.fetch_classification(
                key, year, round_number, session_code,
            )
            return rows or []
        except Exception as e:  # noqa: BLE001 - a fallback must never break the page
            logging.warning(
                "OpenF1 fallback failed for %s/%s/%s: %s: %s",
                year, round_number, session_code, type(e).__name__, e,
            )
            return []

    def results_are_finalised(session) -> bool:
        """True when FastF1's results carry real laps and timing.

        F1's archive reports `Position` immediately but leaves `Laps`, `Time`,
        `GridPosition` and `Points` as NaN until the classification is locked,
        so a non-empty frame is not the same thing as a usable one.
        """
        results = safe_getattr(session, "results")
        if results is None or getattr(results, "empty", True):
            return False
        laps = results.get("Laps") if "Laps" in results else None
        if laps is None or laps.isna().all():
            return False
        return bool(laps.notna().any())

    def process_practice_session(session):
        # `hasattr(session, 'laps')` is True even before load, so the old guard
        # raised DataNotLoadedError on a partially-loaded session. has_rows
        # answers "loaded AND non-empty".
        laps = safe_getattr(session, "laps")
        if laps is None or getattr(laps, "empty", True):
            return []

        drivers = pd.unique(laps['Driver'])
        
        # Pre-group laps by driver ONCE instead of calling pick_drivers()
        # per driver, which re-scans the whole lap frame each time.
        # groupby yields plain DataFrames, so the fastest-lap row is found
        # with idxmin on the pre-masked LapTime column rather than
        # pick_fastest() (a Laps-only method).
        laps_by_driver = {
            drv: grp for drv, grp in laps.groupby('Driver', sort=False)
        }
        valid_laptimes = laps[laps['LapTime'].notna()]
        fastest_idx_by_driver = (
            valid_laptimes['LapTime'].groupby(valid_laptimes['Driver'], sort=False).idxmin()
            if not valid_laptimes.empty else {}
        )

        results = []
        for drv in drivers:
            drv_laps = laps_by_driver.get(drv)
            if drv_laps is None or drv_laps.empty:
                continue

            fastest_lap = None
            if drv in fastest_idx_by_driver:
                fastest_lap = laps.loc[fastest_idx_by_driver[drv]]

            if fastest_lap is None:
                continue

            try:
                driver_info = session.get_driver(drv)
            except Exception:
                continue

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
    schedule = load_event_schedule(year)
    if schedule is None or schedule.empty:
        return {
            "error": f"Round {round_number} not found for year {year}. "
                     f"The schedule may be incomplete or the round does not exist."
        }

    event_df = schedule[schedule["RoundNumber"] == round_number]
    if event_df.empty:
        return {"error": f"Round {round_number} not found for year {year}. The schedule may be incomplete or the round does not exist."}
    event = event_df.iloc[0]
    
    # --- FAST EXIT UNTUK BALAPAN MASA DEPAN (Mencegah timeout FastF1) ---
    today = pd.to_datetime("today").normalize()
    event_date = pd.to_datetime(event["EventDate"]).normalize()
    if today < (event_date - timedelta(days=3)):
        print(f"  Balapan {event['EventName']} masih di masa depan ({event['EventDate'].strftime('%Y-%m-%d')}). Returning instant response.")
        final_data = _empty_race_payload(
            event, "Upcoming",
            "Sesi balapan ini belum dimulai. Data sesi akan tersedia setelah sesi selesai.",
        )
        if cache_file:
            set_advanced_cache(cache_file, final_data)
        return final_data

    SESSION_MAP = {
        'Practice 1': 'FP1', 'Practice 2': 'FP2', 'Practice 3': 'FP3',
        'Qualifying': 'Q', 'Sprint Qualifying': 'SQ', 'Sprint': 'S', 'Race': 'R'
    }
    
    now_utc = pd.to_datetime("now", utc=True)
    for i in range(1, 6):
        session_key = f'Session{i}'
        date_key = f'Session{i}DateUtc' if f'Session{i}DateUtc' in event else f'Session{i}Date'
        if session_key in event and pd.notna(event[session_key]):
            name = event[session_key]
            if name in SESSION_MAP:
                # Lewati sesi jika waktu mulainya masih di masa depan
                if date_key in event and pd.notna(event[date_key]):
                    try:
                        s_date = pd.to_datetime(event[date_key])
                        if s_date.tz is None:
                            s_date = s_date.tz_localize("UTC")
                        if s_date > now_utc:
                            print(f"  Sesi '{name}' belum berlangsung ({s_date}). Melewati.")
                            continue
                    except Exception:
                        pass
                session_obj = load_session_safe(
                    year, round_number, SESSION_MAP[name], **DETAIL_LOAD_KWARGS
                )
                if session_obj is not None:
                    available_sessions[name] = session_obj
                    print(f"  -> Sesi '{name}' ditemukan dan dimuat (dengan laps & messages).")

    
    pole_sitter_info, race_winner_info, results, fastest_lap_info, starting_grid, qualifying_results, sprint_results, sprint_grid_results, sprint_qualifying_results = None, None, [], None, [], [], [], [], []
    practice1_results, practice2_results, practice3_results = [], [], []
    tyre_strategy, speed_traps, sector_matrix, weather_info = [], [], [], []
    lap_chart, gap_chart, lap_times_chart = [], [], []
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

    if 'Qualifying' in available_sessions and has_rows(available_sessions['Qualifying'], 'results'):
        available_tabs.append('Qualifying')
        qual_session = available_sessions['Qualifying']
        qual_session.results['FullName'] = qual_session.results['FirstName'] + ' ' + qual_session.results['LastName']
        pole_sitter_result = qual_session.results.iloc[0]
        pole_time = min((t for t in [pole_sitter_result.get('Q1'), pole_sitter_result.get('Q2'), pole_sitter_result.get('Q3')] if pd.notna(t)), default=None)
        pole_sitter_info = { "full_name": pole_sitter_result['FullName'], "time": format_lap_time(pole_time) }
        # Count laps per driver ONCE. The previous line called
        # pick_drivers() twice per driver inside the loop.
        quali_lap_counts = (
            safe_getattr(qual_session, 'laps').groupby('Driver', sort=False).size().to_dict()
            if has_rows(qual_session, 'laps') else {}
        )
        for index, (_, res) in enumerate(qual_session.results.iterrows()):
            position = index + 1
            driver_number = int(res['DriverNumber']) if pd.notna(res['DriverNumber']) else 0
            best_lap_time = min((t for t in [res.get('Q1'), res.get('Q2'), res.get('Q3')] if pd.notna(t)), default=None)
            laps_count = int(quali_lap_counts.get(res['Abbreviation'], 0))
            qualifying_results.append({ "position": position, "driver_number": driver_number, "full_name": res['FullName'], "team_name": res['TeamName'], "q1": format_lap_time(res.get('Q1')), "q2": format_lap_time(res.get('Q2')), "q3": format_lap_time(res.get('Q3')), "time": format_lap_time(best_lap_time), "laps": laps_count })

    sprint_qual_times = {}
    if 'Sprint Qualifying' in available_sessions and has_rows(available_sessions['Sprint Qualifying'], 'results'):
        available_tabs.append('Sprint Qualifying')
        sprint_qual_session = available_sessions['Sprint Qualifying']
        sprint_qual_session.results['FullName'] = sprint_qual_session.results['FirstName'] + ' ' + sprint_qual_session.results['LastName']
        
        # Count laps per driver ONCE (was pick_drivers() twice per driver).
        sq_lap_counts = (
            safe_getattr(sprint_qual_session, 'laps').groupby('Driver', sort=False).size().to_dict()
            if has_rows(sprint_qual_session, 'laps') else {}
        )

        for index, (_, res) in enumerate(sprint_qual_session.results.iterrows()):
            position = index + 1
            driver_number = int(res['DriverNumber']) if pd.notna(res['DriverNumber']) else 0
            
            q1_time = res.get('Q1', res.get('SQ1'))
            q2_time = res.get('Q2', res.get('SQ2'))
            q3_time = res.get('Q3', res.get('SQ3'))
            best_lap_time = min((t for t in [q1_time, q2_time, q3_time] if pd.notna(t)), default=None)
            
            laps_count = int(sq_lap_counts.get(res['Abbreviation'], 0))
            
            if pd.notna(driver_number):
                sprint_qual_times[driver_number] = best_lap_time

            sprint_qualifying_results.append({ 
                "position": position, "driver_number": driver_number, "full_name": res['FullName'], "team_name": res['TeamName'], 
                "q1": format_lap_time(q1_time), "q2": format_lap_time(q2_time), "q3": format_lap_time(q3_time), 
                "time": format_lap_time(best_lap_time), "laps": laps_count 
            })

    if 'Sprint' in available_sessions:
        sprint_session = available_sessions['Sprint']
        if results_are_finalised(sprint_session):
            available_tabs.extend(['Sprint Grid', 'Sprint'])
            sprint_session.results['FullName'] = sprint_session.results['FirstName'] + ' ' + sprint_session.results['LastName']

            sprint_grid_df = sprint_session.results.sort_values(by="GridPosition")
            for _, res in sprint_grid_df.iterrows():
                try:
                    grid_pos = int(res['GridPosition'])
                except (ValueError, TypeError):
                    grid_pos = 0
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
            leader_time = leader.get('Time')
            # F1 returns NaN for Laps on sessions whose results are not finalised
            # yet; int(nan) raises ValueError and took the whole payload down.
            leader_laps = leader.get('Laps', 0)
            max_laps = int(leader_laps) if pd.notna(leader_laps) else 0
            # Index results by Position once; the interval math below looked up
            # the row one place ahead with a full-frame boolean scan per driver.
            results_by_position = sprint_session.results.set_index('Position')
            for index, (_, res) in enumerate(sprint_session.results.iterrows()):
                position = index + 1
                driver_number = int(res['DriverNumber']) if pd.notna(res['DriverNumber']) else 0
                # NaN-safe: an unfinalised session has no Laps yet.
                res_laps = res.get('Laps', 0)
                current_laps = int(res_laps) if pd.notna(res_laps) else 0
                time_display, gap_display, interval_display = res['Status'], "", ""
                res_status = res['Status']

                classified_status = _classified_status_label(
                    res.get('ClassifiedPosition', ''), res.get('Status', '')
                )
                if classified_status:
                    time_display = classified_status
                    res_status = classified_status
                elif current_laps == max_laps and pd.notna(res.get('Time')):
                    total_time, gap, interval = None, None, None
                    if position == 1: total_time = res['Time']
                    else:
                        gap = res['Time']
                        if pd.notna(leader_time): total_time = leader_time + gap
                        if position == 2: interval = gap
                        else:
                            ahead = results_by_position.loc[position - 1] if (position - 1) in results_by_position.index else None
                            if ahead is not None and pd.notna(ahead.get('Time')): interval = gap - ahead.get('Time')
                    time_display, gap_display, interval_display = format_lap_time(total_time), format_gap(gap), format_gap(interval)
                else:
                    if position > 1:
                        ahead = results_by_position.loc[position - 1] if (position - 1) in results_by_position.index else None
                        if ahead is not None:
                            ahead_laps = ahead.get('Laps', 0)
                            ahead_laps = int(ahead_laps) if pd.notna(ahead_laps) else 0
                            lap_diff = ahead_laps - current_laps
                            if lap_diff > 0: interval_display = f"+{lap_diff} Lap" + ("s" if lap_diff > 1 else "")
                sprint_results.append({ "position": position, "driver_number": driver_number, "full_name": res['FullName'], "team_name": res['TeamName'], "status": res_status, "points": int(res.get('Points', 0)) if pd.notna(res.get('Points', 0)) else 0, "laps": current_laps, "time": time_display, "gap_to_leader": gap_display, "interval": interval_display })
        else:
            # FastF1 has no usable classification for this session. OpenF1's
            # session_result is already final in that window, so use it for the
            # table only — the lap-derived data above is unaffected either way.
            fallback_rows = openf1_rows_for('Sprint', 'S')
            if fallback_rows:
                available_tabs.extend(['Sprint Grid', 'Sprint'])
                sprint_results = fallback_rows
                print(f"  -> OpenF1 fallback menyediakan {len(fallback_rows)} baris klasifikasi Sprint.")
    
    if 'Race' in available_sessions:
        race_session = available_sessions['Race']
        if results_are_finalised(race_session):
            available_tabs.extend(['Starting Grid', 'Race'])
            race_session.results['FullName'] = race_session.results['FirstName'] + ' ' + race_session.results['LastName']
            leader = race_session.results.iloc[0]
            leader_time = leader.get('Time')
            # Same NaN guard as the Sprint block: an unfinalised session reports
            # NaN for Laps and int(nan) kills the whole endpoint.
            race_leader_laps = leader.get('Laps', 0)
            max_laps = int(race_leader_laps) if pd.notna(race_leader_laps) else 0
            race_winner_info = { "full_name": leader['FullName'], "time": format_lap_time(leader_time) }
            grid_df = race_session.results.sort_values(by="GridPosition")
            # Index results by Position once (same reason as the sprint block).
            results_by_position = race_session.results.set_index('Position')
            results_by_abbr = race_session.results.set_index('Abbreviation')
            for _, res in grid_df.iterrows():
                grid_position = int(res['GridPosition']) if pd.notna(res['GridPosition']) else 0
                driver_number = int(res['DriverNumber']) if pd.notna(res['DriverNumber']) else 0
                if grid_position > 0:
                    starting_grid.append({ "grid_position": grid_position, "driver_number": driver_number, "full_name": res['FullName'], "team_name": res['TeamName'] })
            for index, (_, res) in enumerate(race_session.results.iterrows()):
                position = index + 1
                driver_number = int(res['DriverNumber']) if pd.notna(res['DriverNumber']) else 0
                # NaN-safe: an unfinalised session has no Laps yet.
                res_laps = res.get('Laps', 0)
                current_laps = int(res_laps) if pd.notna(res_laps) else 0
                time_display, gap_display, interval_display = res['Status'], "", ""
                res_status = res['Status']

                classified_status = _classified_status_label(
                    res.get('ClassifiedPosition', ''), res.get('Status', '')
                )
                if classified_status:
                    time_display = classified_status
                    res_status = classified_status
                elif current_laps == max_laps and pd.notna(res.get('Time')):
                    total_time, gap, interval = None, None, None
                    if position == 1: total_time = res['Time']
                    else:
                        gap = res['Time']
                        if pd.notna(leader_time): total_time = leader_time + gap
                        if position == 2: interval = gap
                        else:
                            ahead = results_by_position.loc[position - 1] if (position - 1) in results_by_position.index else None
                            if ahead is not None and pd.notna(ahead.get('Time')): interval = gap - ahead.get('Time')
                    time_display, gap_display, interval_display = format_lap_time(total_time), format_gap(gap), format_gap(interval)
                else:
                    if position > 1:
                        ahead = results_by_position.loc[position - 1] if (position - 1) in results_by_position.index else None
                        if ahead is not None:
                            ahead_laps = ahead.get('Laps', 0)
                            ahead_laps = int(ahead_laps) if pd.notna(ahead_laps) else 0
                            lap_diff = ahead_laps - current_laps
                            if lap_diff > 0: interval_display = f"+{lap_diff} Lap" + ("s" if lap_diff > 1 else "")
                results.append({ "position": position, "abbreviation": str(res.get('Abbreviation', '')), "driver_number": driver_number, "full_name": res['FullName'], "team_name": res['TeamName'], "status": res_status, "points": int(res.get('Points', 0)) if pd.notna(res.get('Points', 0)) else 0, "laps": current_laps, "time": time_display, "gap_to_leader": gap_display, "interval": interval_display })
        else:
            # Same fallback as the Sprint block: OpenF1 has the classification
            # F1's own archive has not published yet. The winner/grid/fastest-lap
            # data above stays empty rather than being guessed from it.
            fallback_rows = openf1_rows_for('Race', 'R')
            if fallback_rows:
                available_tabs.extend(['Starting Grid', 'Race'])
                results = fallback_rows
                print(f"  -> OpenF1 fallback menyediakan {len(fallback_rows)} baris klasifikasi Race.")

        # --- Fastest lap, tyre strategy, speed traps and charts ----------
        # These are derived from FastF1's LAP data, not from the results
        # frame, so they work regardless of which branch populated the
        # classification above (FastF1 finalised or OpenF1 fallback).

        # Ensure results_by_abbr is available for fastest-lap lookup
        # even when the else (OpenF1 fallback) branch was taken.
        if 'FullName' not in race_session.results.columns or race_session.results['FullName'].isna().all():
            if 'FirstName' in race_session.results.columns and 'LastName' in race_session.results.columns:
                race_session.results['FullName'] = race_session.results['FirstName'] + ' ' + race_session.results['LastName']
        if 'Abbreviation' in race_session.results.columns:
            results_by_abbr = race_session.results.set_index('Abbreviation')
        else:
            results_by_abbr = pd.DataFrame()  # empty fallback

        fastest = safe_getattr(race_session, 'laps')
        if fastest is not None and not fastest.empty:
            fastest = fastest.pick_fastest()
        if fastest is not None and not getattr(fastest, 'empty', True):
            driver_lookup = (
                results_by_abbr.loc[fastest['Driver']]
                if not results_by_abbr.empty and fastest['Driver'] in results_by_abbr.index else None
            )
            if driver_lookup is None:
                # Try get_driver as a fallback
                try:
                    driver_lookup = race_session.get_driver(fastest['Driver'])
                except Exception:
                    pass
            if driver_lookup is not None:
                driver_data = driver_lookup
                fl_time = format_lap_time(fastest['LapTime'])
                fastest_lap_info = {
                    "full_name": str(driver_data['FullName']),
                    "team_name": str(driver_data['TeamName']),
                    "time": fl_time,
                    "lap_time": fl_time,
                    "lap_number": int(fastest['LapNumber']) if pd.notna(fastest.get('LapNumber')) else None,
                }
        # --- EXTRACT TYRE STRATEGY PRO & PIT STOPS ---
        tyre_strategy = []
        if has_rows(race_session, 'laps') and has_rows(race_session, 'results'):
            try:
                # Pre-group laps by driver ONCE. The previous implementation
                # called laps.pick_driver(abbr) per driver, which re-scans the
                # whole lap DataFrame for every row of the results table
                # (deprecated API + O(drivers x laps) work).
                laps_by_driver = {
                    drv: grp.sort_values('LapNumber')
                    for drv, grp in race_session.laps.groupby('Driver', sort=False)
                }

                for _, drv_row in race_session.results.iterrows():
                    abbr = str(drv_row.get('Abbreviation', ''))
                    full_name = str(drv_row.get('FullName', ''))
                    team_name = str(drv_row.get('TeamName', ''))
                    pos = int(drv_row.get('Position', 99)) if pd.notna(drv_row.get('Position')) else 99
                    dr_num = int(drv_row.get('DriverNumber', 0)) if pd.notna(drv_row.get('DriverNumber')) else 0

                    dr_laps = laps_by_driver.get(abbr)
                    if dr_laps is None or dr_laps.empty:
                        continue

                    # Pull the three needed columns into Python lists once,
                    # then run the stint state machine over plain values
                    # instead of paying iterrows() boxing per lap.
                    stint_nums = dr_laps['Stint'].tolist()
                    compounds = dr_laps['Compound'].tolist()
                    lap_nums = dr_laps['LapNumber'].tolist()

                    stints = []
                    current_stint = None
                    for stint_num, compound, lap_num in zip(stint_nums, compounds, lap_nums):
                        stint_no = int(stint_num) if pd.notna(stint_num) else 1
                        comp = str(compound if pd.notna(compound) else 'UNKNOWN').upper()
                        lap_no = int(lap_num) if pd.notna(lap_num) else 0

                        if current_stint is None:
                            current_stint = {
                                "stint": stint_no,
                                "compound": comp,
                                "start_lap": lap_no,
                                "end_lap": lap_no,
                                "laps": 1
                            }
                        elif current_stint["stint"] == stint_no and current_stint["compound"] == comp:
                            current_stint["end_lap"] = lap_no
                            current_stint["laps"] += 1
                        else:
                            stints.append(current_stint)
                            current_stint = {
                                "stint": stint_no,
                                "compound": comp,
                                "start_lap": lap_no,
                                "end_lap": lap_no,
                                "laps": 1
                            }
                    if current_stint is not None:
                        stints.append(current_stint)

                    # Pit stop laps
                    pit_laps = []
                    if 'PitInTime' in dr_laps.columns:
                        pit_rows = dr_laps[dr_laps['PitInTime'].notna()]
                        pit_laps = [int(p) for p in pit_rows['LapNumber'].tolist() if pd.notna(p)]

                    tyre_strategy.append({
                        "driver": abbr,
                        "full_name": full_name,
                        "team_name": team_name,
                        "driver_number": dr_num,
                        "position": pos,
                        "total_laps": len(dr_laps),
                        "stints": stints,
                        "pit_laps": pit_laps
                    })

                tyre_strategy.sort(key=lambda x: x["position"])
                if tyre_strategy:
                    available_tabs.append("Tyre Strategy")
            except Exception as e:
                logging.error(f"Error calculating tyre strategy: {e}")

        # --- EXTRACT SPEED TRAP & SECTORS (PURPLE MATRIX) ---
        speed_traps = []
        sector_matrix = []
        try:
            if has_rows(race_session, 'laps') and has_rows(race_session, 'results'):
                sector_cols = ['Sector1Time', 'Sector2Time', 'Sector3Time']
                valid_laps = race_session.laps.dropna(subset=sector_cols)

                overall_best_s1 = valid_laps['Sector1Time'].min() if not valid_laps.empty else None
                overall_best_s2 = valid_laps['Sector2Time'].min() if not valid_laps.empty else None
                overall_best_s3 = valid_laps['Sector3Time'].min() if not valid_laps.empty else None

                has_st = 'SpeedST' in race_session.laps.columns
                has_fl = 'SpeedFL' in race_session.laps.columns

                def fmt_sec(td):
                    if pd.isna(td) or td is None: return "-"
                    return f"{td.total_seconds():.3f}"

                # Compute every per-driver reduction ONCE with a single
                # groupby each, instead of re-scanning that driver's laps
                # (dropna + three min() + pick_fastest + max) on every
                # iteration of the results loop.
                best_sectors_by_driver = (
                    valid_laps.groupby('Driver', sort=False)[sector_cols].min()
                    if not valid_laps.empty else None
                )

                speed_col = 'SpeedST' if has_st else ('SpeedFL' if has_fl else None)
                if speed_col:
                    speed_max_by_driver = race_session.laps.groupby('Driver', sort=False)[speed_col].max()
                    # A driver with an all-NaN speed column must fall back to
                    # 0.0, preserving the legacy `.notna().any()` guard.
                    speed_present_by_driver = (
                        race_session.laps.groupby('Driver', sort=False)[speed_col]
                        .apply(lambda s: bool(s.notna().any()))
                    )
                else:
                    speed_max_by_driver = speed_present_by_driver = None

                valid_laptimes = race_session.laps[race_session.laps['LapTime'].notna()]
                fastest_idx_by_driver = (
                    valid_laptimes['LapTime'].groupby(valid_laptimes['Driver'], sort=False).idxmin()
                    if not valid_laptimes.empty else None
                )

                for _, drv_row in race_session.results.iterrows():
                    abbr = str(drv_row.get('Abbreviation', ''))
                    full_name = str(drv_row.get('FullName', ''))
                    team_name = str(drv_row.get('TeamName', ''))
                    dr_num = int(drv_row.get('DriverNumber', 0)) if pd.notna(drv_row.get('DriverNumber')) else 0
                    pos = int(drv_row.get('Position', 99)) if pd.notna(drv_row.get('Position')) else 99

                    # A driver absent from the laps entirely is skipped,
                    # matching the old `if dr_laps.empty: continue`.
                    if best_sectors_by_driver is not None and abbr not in best_sectors_by_driver.index \
                            and (speed_max_by_driver is None or abbr not in speed_max_by_driver.index):
                        continue

                    # Speed trap
                    max_speed = 0.0
                    if speed_max_by_driver is not None and abbr in speed_present_by_driver.index:
                        if bool(speed_present_by_driver.loc[abbr]):
                            max_speed = float(speed_max_by_driver.loc[abbr])

                    speed_traps.append({
                        "driver": abbr,
                        "full_name": full_name,
                        "team_name": team_name,
                        "driver_number": dr_num,
                        "speed": round(max_speed, 1),
                        "position": pos
                    })

                    # Best sectors
                    if best_sectors_by_driver is not None and abbr in best_sectors_by_driver.index:
                        best_row = best_sectors_by_driver.loc[abbr]
                        best_s1, best_s2, best_s3 = best_row[sector_cols[0]], best_row[sector_cols[1]], best_row[sector_cols[2]]
                    else:
                        best_s1 = best_s2 = best_s3 = None

                    actual_lap_time = None
                    if fastest_idx_by_driver is not None and abbr in fastest_idx_by_driver.index:
                        lt = race_session.laps.loc[fastest_idx_by_driver.loc[abbr], 'LapTime']
                        actual_lap_time = lt if pd.notna(lt) else None

                    ideal_lap_seconds = 0
                    if best_s1 is not None and best_s2 is not None and best_s3 is not None:
                        ideal_lap_seconds = (best_s1 + best_s2 + best_s3).total_seconds()

                    potential_gain = 0.0
                    if actual_lap_time is not None and ideal_lap_seconds > 0:
                        actual_seconds = actual_lap_time.total_seconds()
                        potential_gain = round(actual_seconds - ideal_lap_seconds, 3)

                    sector_matrix.append({
                        "driver": abbr,
                        "full_name": full_name,
                        "team_name": team_name,
                        "driver_number": dr_num,
                        "position": pos,
                        "s1": fmt_sec(best_s1),
                        "s1_purple": (best_s1 == overall_best_s1) if (best_s1 is not None and overall_best_s1 is not None) else False,
                        "s2": fmt_sec(best_s2),
                        "s2_purple": (best_s2 == overall_best_s2) if (best_s2 is not None and overall_best_s2 is not None) else False,
                        "s3": fmt_sec(best_s3),
                        "s3_purple": (best_s3 == overall_best_s3) if (best_s3 is not None and overall_best_s3 is not None) else False,
                        "ideal_lap": format_lap_time(timedelta(seconds=ideal_lap_seconds)) if ideal_lap_seconds > 0 else "-",
                        "actual_lap": format_lap_time(actual_lap_time) if actual_lap_time is not None else "-",
                        "potential_gain": potential_gain,
                        "top_speed": round(max_speed, 1)
                    })

                speed_traps.sort(key=lambda x: x["speed"], reverse=True)
                for idx, item in enumerate(speed_traps):
                    item["rank"] = idx + 1

                sector_matrix.sort(key=lambda x: x["position"])

                if speed_traps or sector_matrix:
                    available_tabs.append("Speed & Sectors")
        except Exception as e:
            logging.error(f"Error calculating speed traps & sectors: {e}")


        # Fallback: if laps were empty but we have sector_matrix or results,
        # derive fastest_lap_info so it is never None for a completed race.
        if fastest_lap_info is None and sector_matrix:
            valid_sectors = [s for s in sector_matrix if s.get("actual_lap") and s["actual_lap"] != "-"]
            if valid_sectors:
                best = min(valid_sectors, key=lambda s: s["actual_lap"])
                fastest_lap_info = {
                    "full_name": best["full_name"],
                    "team_name": best["team_name"],
                    "time": best["actual_lap"],
                    "lap_time": best["actual_lap"],
                    "lap_number": None,
                }

        weather_info = []
        weather_rows = safe_getattr(race_session, 'weather_data')
        if weather_rows is not None and not getattr(weather_rows, 'empty', True):
            for _, row in weather_rows.iterrows():
                time_delta = row.get('Time')
                minutes = 0
                if pd.notna(time_delta):
                    minutes = time_delta.total_seconds() / 60.0

                weather_info.append({
                    "time_offset": round(minutes, 1),
                    "air_temp": float(row.get('AirTemp', 0)),
                    "track_temp": float(row.get('TrackTemp', 0)),
                    "humidity": float(row.get('Humidity', 0)),
                    "rainfall": bool(row.get('Rainfall', False))
                })

        # --- EXTRACT LAP-BY-LAP POSITION CHART, GAP CHART, & LAP TIMES CHART ---
        lap_chart = []
        gap_chart = []
        lap_times_chart = []
        if has_rows(race_session, 'laps'):
            try:
                raw_laps = safe_getattr(race_session, 'laps')
                if raw_laps is not None and not raw_laps.empty:
                    lap_cols = ['LapNumber', 'Driver', 'Position', 'Time', 'LapTime']
                    available_cols = [c for c in lap_cols if c in raw_laps.columns]
                    lap_df = raw_laps[available_cols].dropna(subset=['LapNumber', 'Driver']).copy()

                    # Reconstruct cumulative session time per driver if Time is missing/NaN
                    if 'Time' in lap_df.columns and 'LapTime' in lap_df.columns and lap_df['Time'].isna().any():
                        lap_df = lap_df.sort_values(by=['Driver', 'LapNumber'])
                        for _, grp in lap_df.groupby('Driver'):
                            if grp['Time'].isna().any() and grp['LapTime'].notna().any():
                                cum = grp['LapTime'].cumsum()
                                lap_df.loc[grp.index, 'Time'] = grp['Time'].fillna(cum)

                    grouped_by_lap = {int(k): grp.copy() for k, grp in lap_df.groupby('LapNumber', sort=False)}
                    lap_numbers = sorted(grouped_by_lap.keys())

                    for lap_num in lap_numbers:
                        lap_rows = grouped_by_lap[lap_num]
                        lap_entry = {"lap": int(lap_num)}
                        gap_entry = {"lap": int(lap_num)}
                        times_entry = {"lap": int(lap_num)}

                        # Reconstruct positions if Position is NaN or missing
                        if 'Position' in lap_rows.columns:
                            has_invalid_pos = lap_rows['Position'].isna().any() or (lap_rows['Position'] <= 0).any()
                        else:
                            has_invalid_pos = True
                            lap_rows['Position'] = None

                        if has_invalid_pos and 'Time' in lap_rows.columns:
                            time_valid = lap_rows[lap_rows['Time'].notna()].sort_values('Time')
                            ranks = {row.Driver: rank + 1 for rank, row in enumerate(time_valid.itertuples())}
                            for idx, row in lap_rows.iterrows():
                                if pd.isna(row.get('Position')) or row.get('Position', 0) <= 0:
                                    if row['Driver'] in ranks:
                                        lap_rows.at[idx, 'Position'] = ranks[row['Driver']]

                        # Find leader_time from Position == 1 or min Time
                        leader_time = None
                        if 'Position' in lap_rows.columns and 'Time' in lap_rows.columns:
                            pos_1 = lap_rows[lap_rows['Position'] == 1]
                            if not pos_1.empty and pd.notna(pos_1['Time'].iloc[0]):
                                leader_time = pos_1['Time'].iloc[0]
                            else:
                                valid_times = lap_rows[lap_rows['Time'].notna()]['Time']
                                if not valid_times.empty:
                                    leader_time = valid_times.min()

                        for row in lap_rows.itertuples(index=False):
                            drv = str(row.Driver)

                            # Lap chart position
                            pos_val = getattr(row, 'Position', None)
                            if pd.notna(pos_val) and int(pos_val) > 0:
                                lap_entry[drv] = int(pos_val)

                            # Gap chart
                            row_time = getattr(row, 'Time', None)
                            if leader_time is not None and pd.notna(row_time) and pd.notna(leader_time):
                                gap = (row_time - leader_time).total_seconds()
                                if 0 <= gap < 180:
                                    gap_entry[drv] = round(gap, 3)

                            # Lap times chart - independent of Position
                            row_lap_time = getattr(row, 'LapTime', None)
                            if pd.notna(row_lap_time):
                                lap_time_sec = row_lap_time.total_seconds()
                                if 0 < lap_time_sec < 300:
                                    times_entry[drv] = round(lap_time_sec, 3)

                        if len(lap_entry) > 1:
                            lap_chart.append(lap_entry)
                        if len(gap_entry) > 1:
                            gap_chart.append(gap_entry)
                        if len(times_entry) > 1:
                            lap_times_chart.append(times_entry)

                    if lap_chart:
                        available_tabs.append("Lap Chart")
                    if gap_chart:
                        available_tabs.append("Race Progression")
                    if lap_times_chart:
                        available_tabs.append("Lap Times")
            except Exception as e:
                logging.error(f"Gagal memproses chart: {e}")

    # --- OpenF1 enrichment: lap-derived blocks FastF1 cannot serve --------
    # For many 2026 rounds F1's timing archive carries no session data at
    # all ("No data for this session!"): FastF1 still reports the
    # classification (backfilled from Ergast/Jolpica) while every
    # lap-derived block above stays empty. OpenF1 publishes its own
    # laps/stints/weather for those sessions, so every *empty* block is
    # rebuilt from it below. FastF1 output is never replaced, only filled
    # in — rounds its archive can serve stay exactly as they were.
    race_session_obj = available_sessions.get('Race')
    if race_session_obj is None or not has_rows(race_session_obj, 'laps'):
        try:
            position_by_number = {
                int(row['driver_number']): int(row['position'])
                for row in results
                if row.get('driver_number') is not None and row.get('position') is not None
            } if results else {}
            race_blocks = openf1_lap_fallback.build_race_blocks(
                openf1_session_key('Race', 'R'), position_by_number,
            )

            filled = []
            if race_blocks:
                if fastest_lap_info is None and race_blocks.get('fastest_lap'):
                    fastest_lap_info = race_blocks['fastest_lap']
                    filled.append('fastest lap')
                if not tyre_strategy and race_blocks.get('tyre_strategy'):
                    tyre_strategy = race_blocks['tyre_strategy']
                    if 'Tyre Strategy' not in available_tabs:
                        available_tabs.append('Tyre Strategy')
                    filled.append('tyre strategy')
                if not speed_traps and race_blocks.get('speed_traps'):
                    speed_traps = race_blocks['speed_traps']
                    filled.append('speed traps')
                if not sector_matrix and race_blocks.get('sector_matrix'):
                    sector_matrix = race_blocks['sector_matrix']
                    if 'Speed & Sectors' not in available_tabs:
                        available_tabs.append('Speed & Sectors')
                    filled.append('sectors')
                if not weather_info and race_blocks.get('weather_info'):
                    weather_info = race_blocks['weather_info']
                    filled.append('weather')
                if not lap_chart and race_blocks.get('lap_chart'):
                    lap_chart = race_blocks['lap_chart']
                    if 'Lap Chart' not in available_tabs:
                        available_tabs.append('Lap Chart')
                    filled.append('lap chart')
                if not gap_chart and race_blocks.get('gap_chart'):
                    gap_chart = race_blocks['gap_chart']
                    if 'Race Progression' not in available_tabs:
                        available_tabs.append('Race Progression')
                    filled.append('race progression')
                if not lap_times_chart and race_blocks.get('lap_times_chart'):
                    lap_times_chart = race_blocks['lap_times_chart']
                    if 'Lap Times' not in available_tabs:
                        available_tabs.append('Lap Times')
                    filled.append('lap times')

            # Sessions without a FastF1 classification (practices, sprint
            # qualifying) get their fastest-lap tables from OpenF1 too.
            practice_targets = [
                ('Practice 1', 'FP1', practice1_results),
                ('Practice 2', 'FP2', practice2_results),
                ('Practice 3', 'FP3', practice3_results),
            ]
            for tab_name, session_code, current in practice_targets:
                if current:
                    continue
                rows = openf1_lap_fallback.build_fastest_lap_rows(
                    openf1_session_key(tab_name, session_code),
                )
                if not rows:
                    continue
                if tab_name == 'Practice 1':
                    practice1_results = rows
                elif tab_name == 'Practice 2':
                    practice2_results = rows
                else:
                    practice3_results = rows
                if tab_name not in available_tabs:
                    available_tabs.append(tab_name)
                filled.append(tab_name)

            if not sprint_qualifying_results:
                rows = openf1_lap_fallback.build_fastest_lap_rows(
                    openf1_session_key('Sprint Qualifying', 'SQ'),
                )
                if rows:
                    sprint_qualifying_results = rows
                    if 'Sprint Qualifying' not in available_tabs:
                        available_tabs.append('Sprint Qualifying')
                    filled.append('Sprint Qualifying')

            if filled:
                print(f"  -> OpenF1 fallback mengisi: {', '.join(filled)}.")
            else:
                print("  -> OpenF1 fallback: tidak ada data tambahan untuk race ini.")
        except Exception as e:  # noqa: BLE001 - enrichment must never break the page
            logging.warning(
                "OpenF1 enrichment failed for %s/%s: %s: %s",
                year, round_number, type(e).__name__, e,
            )

    race_status = "Completed" if results else ("Ongoing" if available_tabs else "Upcoming")

    final_data = {
        "race_info": { "name": event['EventName'], "location": event['Location'], "country": str(event.get('Country', '')) },
        "status": race_status,
        "last_updated": pd.Timestamp.utcnow().isoformat(),
        "available_tabs": available_tabs, "race_winner": race_winner_info, "pole_position": pole_sitter_info,
        "fastest_lap": fastest_lap_info, "results": results if results else None,
        "tyre_strategy": tyre_strategy if tyre_strategy else None,
        "speed_traps": speed_traps if speed_traps else None,
        "sector_matrix": sector_matrix if sector_matrix else None,
        "weather_info": weather_info if weather_info else None,
        "starting_grid": starting_grid if starting_grid else None,
        "qualifying_results": qualifying_results if qualifying_results else None,
        "sprint_results": sprint_results if sprint_results else None,
        "sprint_grid_results": sprint_grid_results if sprint_grid_results else None,
        "sprint_qualifying_results": sprint_qualifying_results if sprint_qualifying_results else None,
        "practice1_results": practice1_results if practice1_results else None,
        "practice2_results": practice2_results if practice2_results else None,
        "practice3_results": practice3_results if practice3_results else None,
        "lap_chart": lap_chart if lap_chart else None,
        "gap_chart": gap_chart if gap_chart else None,
        "lap_times_chart": lap_times_chart if lap_times_chart else None,
    }

    def clean_nans(obj):
        if isinstance(obj, list):
            return [clean_nans(i) for i in obj]
        elif isinstance(obj, dict):
            return {k: clean_nans(v) for k, v in obj.items()}
        else:
            if pd.isna(obj):
                return None
        return obj
        
    cleaned = clean_nans(final_data)
    if cache_file and "error" not in cleaned:
        try:
            set_advanced_cache(cache_file, cleaned)
            logging.info(f"[RaceDetails] Cache saved to {cache_file}")
        except Exception as e:
            logging.error(f"Failed to save cache to {cache_file}: {e}")
    return cleaned


def compute_fastf1_race_details(year: int, round_number: int, cache_file: str = None):
    """
    Public entry point.

    A round outside the calendar is a client error, so it gets a clean error
    envelope (rendered by the UI as a not-found state). Anything else that
    goes wrong inside the calculation is logged and also answered with a
    clean envelope — this endpoint must never surface a 500, because the
    caller has no way to distinguish "session data missing" from "server
    crashed".
    """
    if not is_valid_year(year) or not isinstance(round_number, int) or round_number < 1:
        return {
            "error": f"Round {round_number} is not a valid race round for {year}."
        }

    try:
        return _compute_race_details(year, round_number, cache_file)
    except Exception as e:  # noqa: BLE001
        logging.error(
            f"Race details failed for {year}/{round_number}: {e}", exc_info=True
        )
        return {"error": "Race detail data is currently unavailable."}

