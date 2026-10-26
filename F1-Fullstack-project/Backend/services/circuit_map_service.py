"""Resolve the active circuit's real SVG outline from SignalR ``SessionInfo``.

The outlines are factual circuit geometry bundled from the MIT-licensed
``MisterSix2295/f1-circuits-svg`` project.  Only the single outline path is
kept, in ``Backend/data/circuit_paths.json``; the JSON also records the source
and licence so the attribution travels with the data.

The resolver deliberately returns ``None`` for an unknown circuit.  Drawing a
generic oval would present an invented track as if it were the real one, which
is exactly the problem this module exists to remove.
"""

from __future__ import annotations

import json
import logging
import threading
import unicodedata
from pathlib import Path
from typing import Any, Optional

logger = logging.getLogger(__name__)

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "circuit_paths.json"

_lock = threading.Lock()
_circuits: Optional[dict[str, dict]] = None
_alias_index: Optional[dict[str, str]] = None


def _normalize(value: Any) -> str:
    """Lowercase, strip accents and punctuation, and collapse whitespace."""
    text = unicodedata.normalize("NFKD", str(value or ""))
    text = "".join(ch for ch in text if not unicodedata.combining(ch))
    text = text.lower()
    cleaned = "".join(ch if ch.isalnum() else " " for ch in text)
    return " ".join(cleaned.split())


def _load() -> tuple[dict[str, dict], dict[str, str]]:
    global _circuits, _alias_index

    with _lock:
        if _circuits is not None and _alias_index is not None:
            return _circuits, _alias_index

        circuits: dict[str, dict] = {}
        aliases: dict[str, str] = {}
        try:
            raw = json.loads(_DATA_PATH.read_text(encoding="utf-8"))
            payload = raw.get("circuits") if isinstance(raw, dict) else None
            if isinstance(payload, dict):
                for key, circuit in payload.items():
                    if not isinstance(circuit, dict):
                        continue
                    circuits[str(key)] = circuit
                    names = {
                        key,
                        circuit.get("name"),
                        circuit.get("location"),
                        circuit.get("country"),
                        circuit.get("layout"),
                    }
                    names.update(circuit.get("aliases") or [])
                    for name in names:
                        normalized = _normalize(name)
                        if normalized:
                            aliases.setdefault(normalized, str(key))
        except (OSError, ValueError):
            logger.exception("Could not load bundled circuit paths from %s", _DATA_PATH)

        _circuits = circuits
        _alias_index = aliases
        return _circuits, _alias_index


def _candidates(session_info: dict[str, Any]) -> list[str]:
    """Most-specific-first strings the SignalR snapshot can use for a circuit."""
    if not isinstance(session_info, dict):
        return []

    meeting = session_info.get("Meeting") or {}
    if not isinstance(meeting, dict):
        meeting = {}
    circuit = meeting.get("Circuit") or session_info.get("Circuit") or {}
    if not isinstance(circuit, dict):
        circuit = {}

    return [
        circuit.get("ShortName"),
        circuit.get("Name"),
        meeting.get("Location"),
        meeting.get("Name"),
        session_info.get("Name"),
    ]


def resolve_circuit(session_info: dict[str, Any]) -> Optional[dict[str, Any]]:
    """Return the bundled outline for the circuit in *session_info*.

    ``SessionInfo.Meeting.Circuit.ShortName`` is the best identifier (for
    example ``"Austin"``); location and meeting name are fallbacks because the
    feed sometimes omits the short name.  The result includes ``key``,
    ``name``, ``location``, ``country``, ``layout``, ``viewBox`` and ``path``.
    """
    circuits, aliases = _load()
    if not circuits or not aliases:
        return None

    for candidate in _candidates(session_info):
        normalized = _normalize(candidate)
        if not normalized:
            continue

        exact = aliases.get(normalized)
        if exact:
            circuit = dict(circuits[exact])
            circuit["key"] = exact
            return circuit

        # Match whole aliases inside a longer string ("United States Grand
        # Prix" -> "united states"), preferring the most specific alias.
        padded = f" {normalized} "
        matches = [
            alias
            for alias in aliases
            if f" {alias} " in padded
        ]
        if matches:
            best = max(matches, key=len)
            circuit = dict(circuits[aliases[best]])
            circuit["key"] = aliases[best]
            return circuit

    return None
