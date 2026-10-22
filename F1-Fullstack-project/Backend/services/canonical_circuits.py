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

    # 1. Try by round number if numeric
    if identifier is not None:
        cache_key = str(identifier).strip()
        if cache_key in _CIRCUIT_CACHE:
            return _CIRCUIT_CACHE[cache_key]

        candidate = DATA_DIR / f"{cache_key}.json"
        if candidate.exists():
            try:
                with open(candidate, "r", encoding="utf-8") as f:
                    data = json.load(f)
                _CIRCUIT_CACHE[cache_key] = data
                return data
            except Exception as e:
                logger.warning(
                    f"Failed to read canonical circuit data for round {identifier}: {e}"
                )

        # 2. Try by circuit key in by_key/
        candidate_key = DATA_DIR / "by_key" / f"{cache_key}.json"
        if candidate_key.exists():
            try:
                with open(candidate_key, "r", encoding="utf-8") as f:
                    data = json.load(f)
                _CIRCUIT_CACHE[cache_key] = data
                return data
            except Exception as e:
                logger.warning(
                    f"Failed to read canonical circuit data for key {identifier}: {e}"
                )

    # 3. Fallback search by country / location
    search_terms = [
        s.lower().strip()
        for s in (country or "", location or "")
        if s and len(s.strip()) > 2
    ]
    if search_terms:
        for file in DATA_DIR.glob("*.json"):
            if not file.stem.isdigit():
                continue
            try:
                with open(file, "r", encoding="utf-8") as f:
                    data = json.load(f)
                cty = data.get("country", "").lower()
                loc = data.get("location", "").lower()
                nm = data.get("circuit_name", "").lower()
                if any(t in cty or t in loc or t in nm for t in search_terms):
                    if identifier is not None:
                        _CIRCUIT_CACHE[str(identifier)] = data
                    return data
            except Exception:
                continue

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
