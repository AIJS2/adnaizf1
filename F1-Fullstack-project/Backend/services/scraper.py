import logging
import json
import os
import time
import httpx
from bs4 import BeautifulSoup
import asyncio

# TTL for the scraped-standings fallback snapshot (24h).
# Championship standings only change after a race, so re-scraping more often
# than this only adds load to formula1.com without changing the answer.
SCRAPE_CACHE_TTL_HOURS = int(os.environ.get("F1_SCRAPE_CACHE_TTL_HOURS", "24"))

# Directory used for the on-disk fallback snapshot. Resolved against the
# package directory (not the process CWD) so it works identically under
# `uvicorn main:app`, `python -m`, and inside the Docker image.
FALLBACK_DIR = os.environ.get(
    "F1_SCRAPE_FALLBACK_DIR",
    os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "cache"),
)

# Explicit list of FIA driver abbreviations. formula1.com renders the driver
# table with the 3-letter code concatenated onto the name
# (e.g. "Kimi AntonelliANT"), so it has to be stripped -- but ONLY when the
# trailing 3 characters are a real abbreviation. A bare `[A-Z]{3}$` strip also
# eats the tail of legitimate surnames: "Max VERSTAPPEN" -> "Max VERSTAP",
# "Kimi ANTONELLI" -> "Kimi ANTONE", "Lewis HAMILTON" -> "Lewis HAMIL".
KNOWN_DRIVER_ABBREVIATIONS = frozenset({
    "ALB", "ALO", "ANT", "BEA", "BOR", "BOT", "COL", "DEV", "DOO", "GAS",
    "HAD", "HAM", "HUL", "LAW", "LEC", "LIN", "MAG", "NOR", "OCO", "PER",
    "PIA", "RIC", "RUS", "SAI", "SAR", "STR", "TSU", "VER", "ZHO",
})


def strip_driver_abbreviation(raw_name: str) -> str:
    """Remove a trailing driver abbreviation, but only a real one.

    Returns `raw_name` unchanged when the suffix is not in
    KNOWN_DRIVER_ABBREVIATIONS, so ordinary surnames are never truncated.
    """
    if len(raw_name) <= 3:
        return raw_name
    suffix = raw_name[-3:]
    if suffix.isupper() and suffix in KNOWN_DRIVER_ABBREVIATIONS:
        return raw_name[:-3]
    return raw_name


def _fallback_candidates(year: int):
    """Paths to probe for the on-disk fallback snapshot, best-first."""
    filename = f"f1_official_standings_{year}.json"
    return [
        os.path.join(FALLBACK_DIR, filename),   # resolved relative to the package
        os.path.join(os.getcwd(), "Backend", "cache", filename),
        filename,                                # bare, for legacy layouts
    ]


def _load_fallback(year: int):
    """Load the fallback snapshot if present and not stale. Returns (teams, drivers)."""
    for path in _fallback_candidates(year):
        try:
            if not os.path.exists(path):
                continue
            age_hours = (time.time() - os.path.getmtime(path)) / 3600.0
            if age_hours > SCRAPE_CACHE_TTL_HOURS:
                logging.warning(
                    f"Fallback snapshot {path} is stale ({age_hours:.1f}h > "
                    f"{SCRAPE_CACHE_TTL_HOURS}h); ignoring."
                )
                continue
            with open(path, "r", encoding="utf-8") as f:
                official = json.load(f)
            logging.info(f"Using fallback standings from {path} ({age_hours:.1f}h old).")
            return official.get("teams", {}), official.get("drivers", {})
        except Exception as e:
            logging.warning(f"Could not read fallback snapshot {path}: {e}")
    return None, None


def _write_fallback(year: int, teams: dict, drivers: dict) -> None:
    """Persist a fresh scrape so a later outage has a snapshot to fall back to.

    Best-effort: a read-only or missing cache directory must never break a
    successful live scrape, so every failure is swallowed and logged.
    """
    try:
        os.makedirs(FALLBACK_DIR, exist_ok=True)
        path = os.path.join(FALLBACK_DIR, f"f1_official_standings_{year}.json")
        tmp = f"{path}.tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            json.dump({"year": year, "teams": teams, "drivers": drivers}, f)
        os.replace(tmp, path)  # atomic; avoids a half-written file on crash
        logging.info(f"Wrote fallback standings snapshot to {path}")
    except Exception as e:
        logging.warning(f"Could not write fallback standings snapshot: {e}")


async def apply_f1_official_standings(data: dict) -> dict:
    year = data.get('year')
    if not year:
        return data

    official_drivers = {}
    official_teams = {}

    try:
        # Scrape Teams and Drivers concurrently using httpx
        async with httpx.AsyncClient(timeout=10.0, follow_redirects=True) as client:
            headers = {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'}

            # Fetch both pages concurrently
            res_teams_task = client.get(f'https://www.formula1.com/en/results/{year}/team', headers=headers)
            res_drv_task = client.get(f'https://www.formula1.com/en/results/{year}/drivers', headers=headers)

            res_teams, res_drv = await asyncio.gather(res_teams_task, res_drv_task)

            res_teams.raise_for_status()
            res_drv.raise_for_status()

            # Parse Teams
            soup_teams = BeautifulSoup(res_teams.text, 'html.parser')
            table_teams = soup_teams.find('table')
            if table_teams:
                for row in table_teams.find_all('tr')[1:]:
                    cols = row.find_all(['th', 'td'])
                    if len(cols) >= 3:
                        t_name = cols[1].text.strip()
                        t_points = float(cols[2].text.strip())
                        official_teams[t_name] = t_points

            # Parse Drivers
            soup_drv = BeautifulSoup(res_drv.text, 'html.parser')
            table_drv = soup_drv.find('table')
            if table_drv:
                for row in table_drv.find_all('tr')[1:]:
                    cols = row.find_all(['th', 'td'])
                    if len(cols) >= 5:
                        d_name = cols[1].text.strip().replace('\xa0', ' ')
                        # Strip the concatenated 3-letter abbreviation, but only
                        # when it is a genuine driver code (see above).
                        d_name = strip_driver_abbreviation(d_name)
                        d_points = float(cols[4].text.strip())
                        official_drivers[d_name] = d_points

        logging.info(f"Live Scrape F1.com Success! Drivers: {len(official_drivers)}, Teams: {len(official_teams)}")

        # Persist a snapshot so a later outage has something to fall back to.
        _write_fallback(year, official_teams, official_drivers)

    except Exception as e:
        logging.error(f"Live Scrape failed for {year}, trying local fallback. Error: {e}", exc_info=True)
        fallback_teams, fallback_drivers = _load_fallback(year)
        if fallback_teams is not None or fallback_drivers is not None:
            official_teams = fallback_teams or official_teams
            official_drivers = fallback_drivers or official_drivers
        else:
            logging.error(
                f"No usable fallback standings for {year} in any of: "
                f"{_fallback_candidates(year)}"
            )

    if not official_teams and not official_drivers:
        return data  # Fallback to FastF1

    try:
        # Update dashboard data
        if 'team_standings' in data:
            for t in data['team_standings']:
                if t['name'] in official_teams:
                    t['points'] = official_teams[t['name']]
            data['team_standings'] = sorted(data['team_standings'], key=lambda x: x['points'], reverse=True)
            
        if 'driver_standings' in data:
            for d in data['driver_standings']:
                if d['name'] in official_drivers:
                    d['points'] = official_drivers[d['name']]
            data['driver_standings'] = sorted(data['driver_standings'], key=lambda x: x['points'], reverse=True)
            
        # Update championship data
        if 'teams' in data:
            for t in data['teams']:
                if t['name'] in official_teams:
                    t['points'] = official_teams[t['name']]
            data['teams'] = sorted(data['teams'], key=lambda x: x['points'], reverse=True)
            for i, t in enumerate(data['teams']): t['position'] = i + 1
            
        if 'drivers' in data:
            for d in data['drivers']:
                if d['name'] in official_drivers:
                    d['points'] = official_drivers[d['name']]
            data['drivers'] = sorted(data['drivers'], key=lambda x: x['points'], reverse=True)
            for i, d in enumerate(data['drivers']): d['position'] = i + 1
            
    except Exception as e:
        logging.error(f"Failed to apply official standings: {e}", exc_info=True)
        
    return data
