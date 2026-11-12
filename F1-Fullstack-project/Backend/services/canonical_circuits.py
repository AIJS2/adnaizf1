"""Canonical circuit geometry service.

Loads pre-computed, high-density canonical coordinates for all F1 circuits
(sourced from MultiViewer API / official F1 geometry), pre-rotated to match
the visual orientation of the CIRCUIT LAYOUT track maps in the frontend.
"""

from __future__ import annotations

import json
import logging
import math
from pathlib import Path
from typing import Any

import numpy as np

logger = logging.getLogger(__name__)

# Base path for cached canonical circuit files
DATA_DIR = Path(__file__).resolve().parent.parent / "data" / "circuits"

_CIRCUIT_CACHE: dict[str, dict[str, Any]] = {}


def _norm(value: str | None) -> str:
    import unicodedata

    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch)).lower()
    return " ".join("".join(ch if ch.isalnum() else " " for ch in text).split())


def _load_json(path: Path) -> dict[str, Any] | None:
    try:
        with open(path, "r", encoding="utf-8") as handle:
            return json.load(handle)
    except Exception as exc:
        logger.warning("Failed to read canonical circuit data from %s: %s", path, exc)
        return None


def get_canonical_circuit(
    identifier: int | str | None,
    country: str | None = None,
    location: str | None = None,
) -> dict[str, Any] | None:
    """Load canonical geometry for *identifier* (round number or circuit key).

    Supports fallbacks by country or location if round number is omitted or not found.
    """
    if not DATA_DIR.exists():
        return None

    alias_map = {
        "interlagos": "sao paulo",
        "abu dhabi": "yas marina",
        "yas marina": "yas marina",
        "catalunya": "barcelona",
        "montmelo": "barcelona",
        "cota": "austin",
        "americas": "austin",
        "usa": "united states",
        "uae": "united arab emirates",
        "uk": "great britain",
    }

    # Context is more reliable than a round number: round 1 means a different
    # circuit in different seasons.
    loc_term = alias_map.get(_norm(location), _norm(location))
    cty_term = alias_map.get(_norm(country), _norm(country))
    id_term = (
        alias_map.get(_norm(identifier), _norm(identifier))
        if identifier is not None and not str(identifier).strip().isdigit()
        else ""
    )
    if loc_term or cty_term or id_term:
        candidates: list[dict[str, Any]] = []
        for file in sorted(DATA_DIR.glob("**/*.json")):
            data = _load_json(file)
            if data is not None:
                candidates.append(data)

        for term in (loc_term, id_term):
            if not term or len(term) < 3:
                continue
            for data in candidates:
                loc = _norm(data.get("location"))
                name = _norm(data.get("circuit_name"))
                if term == loc or term == name or f" {term} " in f" {loc} " or f" {term} " in f" {name} ":
                    cache_key = f"context:{cty_term}:{loc_term}:{id_term}"
                    _CIRCUIT_CACHE[cache_key] = data
                    return data

        if cty_term:
            country_matches = [
                data
                for data in candidates
                if cty_term == _norm(data.get("country"))
            ]
            if len(country_matches) == 1:
                cache_key = f"context:{cty_term}:{loc_term}:{id_term}"
                _CIRCUIT_CACHE[cache_key] = country_matches[0]
                return country_matches[0]

    # Fall back to the identifier when no contextual match is available.
    if identifier is not None:
        cache_key = str(identifier).strip()
        if cache_key in _CIRCUIT_CACHE:
            return _CIRCUIT_CACHE[cache_key]

        candidate = DATA_DIR / f"{cache_key}.json"
        if candidate.exists():
            data = _load_json(candidate)
            if data is not None:
                _CIRCUIT_CACHE[cache_key] = data
                return data

        # Try by circuit key in by_key/.
        candidate_key = DATA_DIR / "by_key" / f"{cache_key}.json"
        if candidate_key.exists():
            data = _load_json(candidate_key)
            if data is not None:
                _CIRCUIT_CACHE[cache_key] = data
                return data

    # Last-resort contextual scan for partial/legacy metadata.
    candidates: list[dict[str, Any]] = []
    for file in sorted(DATA_DIR.glob("*.json")):
        if not file.stem.isdigit():
            continue
        data = _load_json(file)
        if data is not None:
            candidates.append(data)

    # Pass 1: Match specific location or identifier against location / circuit_name
    for term in (loc_term, id_term):
        if not term or len(term) < 3:
            continue
        for data in candidates:
            loc = _norm(data.get("location", ""))
            nm = _norm(data.get("circuit_name", ""))
            padded_loc = f" {loc} "
            padded_nm = f" {nm} "
            if term == loc or term == nm or f" {term} " in padded_loc or f" {term} " in padded_nm:
                if identifier is not None:
                    _CIRCUIT_CACHE[str(identifier)] = data
                return data

    # Pass 2: Match country (only if unambiguous or fallback)
    for term in (cty_term, loc_term, id_term):
        if not term or len(term) < 3:
            continue
        for data in candidates:
            cty = _norm(data.get("country", ""))
            loc = _norm(data.get("location", ""))
            nm = _norm(data.get("circuit_name", ""))
            if term == cty or f" {term} " in f" {cty} " or f" {term} " in f" {loc} " or f" {term} " in f" {nm} ":
                if identifier is not None:
                    _CIRCUIT_CACHE[str(identifier)] = data
                return data

    return None


def interpolate_canonical_coords(
    identifier: int | str | None,
    norm_distances: np.ndarray | list[float],
    country: str | None = None,
    location: str | None = None,
) -> tuple[np.ndarray, np.ndarray] | None:
    """Interpolate (X, Y) coordinates along canonical circuit geometry.

    *norm_distances* should be normalized cumulative arc-length distances
    in the range [0.0, 1.0].

    Returns (x_array, y_array) aligned with the orientation of CIRCUIT LAYOUT,
    or None if canonical data is unavailable.
    """
    circuit = get_canonical_circuit(identifier, country=country, location=location)
    if not circuit:
        return None

    ref_norms = np.array(circuit["norm_distance"], dtype=float)
    ref_x = np.array(circuit["x"], dtype=float)
    ref_y = np.array(circuit["y"], dtype=float)

    query_norms = np.asarray(norm_distances, dtype=float)
    query_norms = np.clip(query_norms, 0.0, 1.0)

    interp_x = np.interp(query_norms, ref_norms, ref_x)
    interp_y = np.interp(query_norms, ref_norms, ref_y)

    return interp_x, interp_y
