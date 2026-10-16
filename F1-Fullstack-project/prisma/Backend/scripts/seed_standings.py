#!/usr/bin/env python3
"""
Seed script to populate SQLite database with 2026 F1 Championship standings.
Can be run directly with Python:
    python Backend/scripts/seed_standings.py
"""

import os
import sys
import json
import sqlite3
from datetime import datetime, timezone
from pathlib import Path

# Team hex colors
TEAM_COLORS = {
    "Mercedes": "#27F4D2",
    "Ferrari": "#E8002D",
    "McLaren": "#FF8000",
    "Red Bull Racing": "#3671C6",
    "Racing Bulls": "#6692FF",
    "Alpine": "#0090FF",
    "Haas F1 Team": "#B6BABD",
    "Audi": "#F51917",
    "Williams": "#00A3E0",
    "Aston Martin": "#229971",
    "Cadillac": "#FFD700",
}


def get_db_path() -> Path:
    env_db = os.environ.get("DATABASE_URL")
    if env_db and env_db.startswith("file:"):
        clean_path = env_db.replace("file:", "").strip()
        return Path(clean_path).resolve()

    backend_dir = Path(__file__).resolve().parent.parent
    return backend_dir / "f1_stats.db"


def init_schema(conn: sqlite3.Connection):
    cursor = conn.cursor()

    cursor.executescript("""
    DROP TABLE IF EXISTS standings;
    DROP TABLE IF EXISTS drivers;
    DROP TABLE IF EXISTS teams;

    CREATE TABLE IF NOT EXISTS teams (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT UNIQUE NOT NULL,
        full_name TEXT,
        color TEXT,
        logo_url TEXT,
        country TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS drivers (
        id TEXT PRIMARY KEY NOT NULL,
        name TEXT NOT NULL,
        abbreviation TEXT,
        driver_number INTEGER,
        nationality TEXT,
        team_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE SET NULL
    );

    CREATE TABLE IF NOT EXISTS standings (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        year INTEGER NOT NULL DEFAULT 2026,
        type TEXT NOT NULL, -- 'DRIVER' or 'CONSTRUCTOR'
        position INTEGER NOT NULL,
        points REAL NOT NULL DEFAULT 0,
        wins INTEGER NOT NULL DEFAULT 0,
        podiums INTEGER NOT NULL DEFAULT 0,
        dnfs INTEGER NOT NULL DEFAULT 0,
        points_last_race REAL DEFAULT 0,
        driver_id TEXT,
        team_id TEXT,
        created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
        FOREIGN KEY (driver_id) REFERENCES drivers (id) ON DELETE CASCADE,
        FOREIGN KEY (team_id) REFERENCES teams (id) ON DELETE CASCADE,
        UNIQUE (year, type, position)
    );

    CREATE INDEX IF NOT EXISTS idx_standings_year_type ON standings (year, type);
    """)
    conn.commit()


def seed_data(conn: sqlite3.Connection):
    cursor = conn.cursor()
    backend_dir = Path(__file__).resolve().parent.parent
    cache_file = backend_dir / "cache" / "championship_cache_2026.json"

    if not cache_file.exists():
        print(f"⚠️ Cache file not found at {cache_file}")
        return

    with open(cache_file, "r", encoding="utf-8") as f:
        data = json.load(f)

    teams = data.get("teams", [])
    drivers = data.get("drivers", [])
    now_iso = datetime.now(timezone.utc).isoformat()

    print(f"📊 Seeding {len(teams)} teams and {len(drivers)} drivers into SQLite...")

    # Seed Teams
    for t in teams:
        team_id = t.get("id") or t["name"].lower().replace(" ", "_")
        name = t["name"]
        color = TEAM_COLORS.get(name, "#EF4444")

        cursor.execute("""
            INSERT INTO teams (id, name, color, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                color = excluded.color,
                updated_at = excluded.updated_at;
        """, (team_id, name, color, now_iso, now_iso))

        pos = t.get("position")
        if pos:
            cursor.execute("""
                INSERT INTO standings (
                    year, type, position, points, wins, podiums, dnfs, points_last_race, team_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(year, type, position) DO UPDATE SET
                    points = excluded.points,
                    wins = excluded.wins,
                    podiums = excluded.podiums,
                    dnfs = excluded.dnfs,
                    points_last_race = excluded.points_last_race,
                    team_id = excluded.team_id,
                    updated_at = excluded.updated_at;
            """, (
                2026,
                "CONSTRUCTOR",
                pos,
                float(t.get("points", 0)),
                int(t.get("wins", 0)),
                int(t.get("podiums", 0)),
                int(t.get("dnfs", 0)),
                float(t.get("points_last_race", 0)),
                team_id,
                now_iso,
                now_iso
            ))

    # Seed Drivers
    for d in drivers:
        driver_id = d.get("id") or d["name"].lower().replace(" ", "_")
        name = d["name"]
        team_name = d.get("team")
        team_id = team_name.lower().replace(" ", "_") if team_name else None
        abbr = d.get("abbreviation")
        num = d.get("driver_number")

        cursor.execute("""
            INSERT INTO drivers (id, name, abbreviation, driver_number, team_id, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT(id) DO UPDATE SET
                name = excluded.name,
                abbreviation = excluded.abbreviation,
                driver_number = excluded.driver_number,
                team_id = excluded.team_id,
                updated_at = excluded.updated_at;
        """, (driver_id, name, abbr, num, team_id, now_iso, now_iso))

        pos = d.get("position")
        if pos:
            cursor.execute("""
                INSERT INTO standings (
                    year, type, position, points, wins, podiums, dnfs, points_last_race, driver_id, team_id, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                ON CONFLICT(year, type, position) DO UPDATE SET
                    points = excluded.points,
                    wins = excluded.wins,
                    podiums = excluded.podiums,
                    dnfs = excluded.dnfs,
                    points_last_race = excluded.points_last_race,
                    driver_id = excluded.driver_id,
                    team_id = excluded.team_id,
                    updated_at = excluded.updated_at;
            """, (
                2026,
                "DRIVER",
                pos,
                float(d.get("points", 0)),
                int(d.get("wins", 0)),
                int(d.get("podiums", 0)),
                int(d.get("dnfs", 0)),
                float(d.get("points_last_race", 0)),
                driver_id,
                team_id,
                now_iso,
                now_iso
            ))

    conn.commit()
    print("✅ Successfully seeded SQLite database with 2026 standings!")


def main():
    db_path = get_db_path()
    print(f"Connecting to SQLite database: {db_path}")
    db_path.parent.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(str(db_path))
    try:
        init_schema(conn)
        seed_data(conn)
    finally:
        conn.close()


if __name__ == "__main__":
    main()
