import os
import sqlite3
import logging
from pathlib import Path
from typing import Dict, Any, List, Optional


def get_sqlite_conn() -> Optional[sqlite3.Connection]:
    """Resolves SQLite connection to f1_stats.db or DATABASE_URL."""
    env_db = os.environ.get("DATABASE_URL")
    if env_db and env_db.startswith("file:"):
        db_path = Path(env_db.replace("file:", "").strip()).resolve()
    else:
        # Check standard locations: Backend/f1_stats.db or prisma/dev.db
        backend_dir = Path(__file__).resolve().parent.parent
        db_path = backend_dir / "f1_stats.db"
        if not db_path.exists():
            root_prisma_db = backend_dir.parent / "prisma" / "dev.db"
            if root_prisma_db.exists():
                db_path = root_prisma_db

    if not db_path.exists():
        return None

    try:
        conn = sqlite3.connect(str(db_path))
        conn.row_factory = sqlite3.Row
        return conn
    except Exception as e:
        logging.warning(f"Could not connect to SQLite database at {db_path}: {e}")
        return None


def get_driver_standings_from_db(year: int = 2026) -> List[Dict[str, Any]]:
    conn = get_sqlite_conn()
    if not conn:
        return []

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT 
                s.position,
                s.points,
                s.wins,
                s.podiums,
                s.dnfs,
                s.dnss,
                s.points_last_race,
                d.id,
                d.name,
                d.abbreviation,
                d.driver_number,
                d.nationality,
                t.name as team_name,
                t.id as team_id,
                t.color as team_color
            FROM standings s
            JOIN drivers d ON s.driver_id = d.id
            LEFT JOIN teams t ON s.team_id = t.id
            WHERE s.year = ? AND s.type = 'DRIVER'
            ORDER BY s.position ASC
        """,
            (year,),
        )
        rows = cursor.fetchall()

        results = []
        for r in rows:
            results.append(
                {
                    "id": r["id"],
                    "name": r["name"],
                    "team": r["team_name"] or "",
                    "team_id": r["team_id"] or "",
                    "position": r["position"],
                    "points": float(r["points"]),
                    "wins": int(r["wins"]),
                    "podiums": int(r["podiums"]),
                    "dnfs": int(r["dnfs"]),
                    "dnss": int(r["dnss"]),
                    "abbreviation": r["abbreviation"] or "",
                    "driver_number": r["driver_number"],
                    "nationality": r["nationality"] or "",
                    "points_last_race": float(r["points_last_race"] or 0),
                    "color": r["team_color"] or "#EF4444",
                }
            )
        return results
    except Exception as e:
        logging.warning(f"Failed to query driver standings from SQLite: {e}")
        return []
    finally:
        conn.close()


def get_constructor_standings_from_db(year: int = 2026) -> List[Dict[str, Any]]:
    conn = get_sqlite_conn()
    if not conn:
        return []

    try:
        cursor = conn.cursor()
        cursor.execute(
            """
            SELECT 
                s.position,
                s.points,
                s.wins,
                s.podiums,
                s.dnfs,
                s.dnss,
                s.points_last_race,
                t.id,
                t.name,
                t.full_name,
                t.color,
                t.country
            FROM standings s
            JOIN teams t ON s.team_id = t.id
            WHERE s.year = ? AND s.type = 'CONSTRUCTOR'
            ORDER BY s.position ASC
        """,
            (year,),
        )
        rows = cursor.fetchall()

        results = []
        for r in rows:
            results.append(
                {
                    "id": r["id"],
                    "name": r["name"],
                    "full_name": r["full_name"] or r["name"],
                    "position": r["position"],
                    "points": float(r["points"]),
                    "wins": int(r["wins"]),
                    "podiums": int(r["podiums"]),
                    "dnfs": int(r["dnfs"]),
                    "dnss": int(r["dnss"]),
                    "points_last_race": float(r["points_last_race"] or 0),
                    "color": r["color"] or "#EF4444",
                    "country": r["country"] or "",
                }
            )
        return results
    except Exception as e:
        logging.warning(f"Failed to query constructor standings from SQLite: {e}")
        return []
    finally:
        conn.close()


def get_championship_from_db(year: int = 2026) -> Optional[Dict[str, Any]]:
    drivers = get_driver_standings_from_db(year)
    teams = get_constructor_standings_from_db(year)
    if not drivers and not teams:
        return None
    return {
        "year": year,
        "drivers": drivers,
        "teams": teams,
        "source": "sqlite_database",
    }
