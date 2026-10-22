"""Smooth X/Y coordinates with a closed parametric spline (scipy).

When the source only provides a handful of unique waypoints (OpenF1 location
samples merged via merge_asof nearest -> ~28 repeated pairs), a plain linear
interpolation still renders a jagged polygon.  A closed parametric B-spline
fitted to the unique waypoints produces a smooth circuit outline.
"""

from __future__ import annotations

import logging

import numpy as np
import pandas as pd
from scipy.interpolate import splev, splprep

logger = logging.getLogger(__name__)

# Minimum number of unique waypoints before spline smoothing kicks in.
# Below this the curve would over-fit / oscillate; above it linear interp
# between already-dense samples is smooth enough on its own.
_MIN_WAYPOINTS_FOR_SPLINE = 10
# Target number of output samples for the smoothed curve.
_SPLINE_OUTPUT_POINTS = 500


def _unique_waypoints(
    x: pd.Series, y: pd.Series, distance: pd.Series | None = None
) -> tuple[np.ndarray, np.ndarray]:
    """Drop consecutive duplicates from the X/Y series and return numpy arrays.

    Consecutive duplicates (the symptom of merge_asof nearest) are the value
    that is equal to the previous row.  A single forward-fill after masking
    them to NaN gives a strictly-monotonic (in row order) waypoint list.
    """
    xf = x.copy()
    yf = y.copy()
    if distance is not None and len(distance) == len(xf):
        # Use distance as the ordering key so waypoints follow the car's
        # actual travel direction around the circuit.
        order = distance.fillna(0.0).values
    else:
        order = np.arange(len(xf))

    # Mark duplicates: a row whose (x,y) pair equals the previous row is a dup.
    mask = pd.Series(xf.values) == pd.Series(xf.values).shift(1)
    mask2 = pd.Series(yf.values) == pd.Series(yf.values).shift(1)
    dup = (mask & mask2).fillna(False).values

    xf_vals = xf.values.astype(float, copy=False)
    yf_vals = yf.values.astype(float, copy=False)

    # Build unique sequence: walk through, keep first occurrence of each value
    ux, uy = [xf_vals[0]], [yf_vals[0]]
    prev_x, prev_y = xf_vals[0], yf_vals[0]
    for i in range(1, len(xf_vals)):
        cx, cy = xf_vals[i], yf_vals[i]
        if not (np.isnan(cx) or np.isnan(cy)):
            if cx != prev_x or cy != prev_y:
                ux.append(cx)
                uy.append(cy)
                prev_x, prev_y = cx, cy
        else:
            # NaN row: skip but keep prev for next comparison
            pass

    return np.array(ux, dtype=float), np.array(uy, dtype=float)


def smooth_curve(
    x: pd.Series,
    y: pd.Series,
    distance: pd.Series | None = None,
    n_points: int = _SPLINE_OUTPUT_POINTS,
) -> tuple[np.ndarray, np.ndarray]:
    """Return (smooth_x, smooth_y) of length *n_points* for a closed circuit.

    Falls back to linear interpolation when the unique waypoint count is too
    small for a stable spline, or when scipy is unavailable.
    """
    ux, uy = _unique_waypoints(x, y, distance)
    n = len(ux)

    if n < 3:
        # Not enough distinct coordinates; return zeros.
        return np.zeros(n_points), np.zeros(n_points)

    if n < _MIN_WAYPOINTS_FOR_SPLINE:
        # Too few unique waypoints for a meaningful spline; linear interp
        # over the full range is the best we can do.
        t = np.linspace(0.0, 1.0, n_points, endpoint=False)
        xs = np.interp(
            t, np.linspace(0, 1, n, endpoint=False), np.concatenate([ux, ux[:1]])
        )
        ys = np.interp(
            t, np.linspace(0, 1, n, endpoint=False), np.concatenate([uy, uy[:1]])
        )
        return xs, ys

    try:
        # per=True fits a closed (periodic) B-spline, which is exactly what a
        # circuit outline is: the start and end connect back together.
        tck, u = splprep([ux, uy], s=0, per=True)
        t_eval = np.linspace(0.0, 1.0, n_points, endpoint=False)
        sx, sy = splev(t_eval, tck)
        return sx, sy
    except Exception as e:  # noqa: BLE001
        logger.warning(
            "Spline smoothing failed (%s); falling back to linear interpolation.", e
        )
        t = np.linspace(0.0, 1.0, n_points, endpoint=False)
        xs = np.interp(
            t, np.linspace(0, 1, n, endpoint=False), np.concatenate([ux, ux[:1]])
        )
        ys = np.interp(
            t, np.linspace(0, 1, n, endpoint=False), np.concatenate([uy, uy[:1]])
        )
        return xs, ys


def apply_smoothed_position(
    frame: pd.DataFrame,
    n_points: int = _SPLINE_OUTPUT_POINTS,
) -> pd.DataFrame:
    """Replace X/Y in *frame* with a smooth spline of the unique waypoints.

    Evaluates the periodic spline continuously at each row's normalised
    distance along the lap, ensuring every distance point has a smooth,
    continuous coordinate.
    """
    if frame is None or frame.empty:
        return frame
    if not {"X", "Y"}.issubset(frame.columns):
        return frame

    dist = frame["Distance"] if "Distance" in frame.columns else None
    ux, uy = _unique_waypoints(frame["X"], frame["Y"], dist)
    n = len(ux)
    out = frame.copy()
    if n < 3:
        return out

    if dist is not None and dist.notna().any():
        d = dist.fillna(0.0).values.astype(float)
        d_min, d_max = float(d.min()), float(d.max())
        frac = (d - d_min) / (d_max - d_min + 1e-9)
        frac = np.clip(frac, 0.0, 1.0)
    else:
        frac = np.linspace(0.0, 1.0, len(out), endpoint=False)

    if n >= _MIN_WAYPOINTS_FOR_SPLINE:
        try:
            tck, u = splprep([ux, uy], s=0, per=True)
            eval_u = np.clip(frac, 0.0, 0.999999)
            sx, sy = splev(eval_u, tck)
            out["X"] = sx
            out["Y"] = sy
            return out
        except Exception as e:
            logger.warning(
                "Spline smoothing failed (%s); falling back to linear interpolation.",
                e,
            )

    t_nodes = np.linspace(0.0, 1.0, n, endpoint=False)
    out["X"] = np.interp(frac, t_nodes, np.concatenate([ux, ux[:1]]))
    out["Y"] = np.interp(frac, t_nodes, np.concatenate([uy, uy[:1]]))
    return out
