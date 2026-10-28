import type { CircuitGeometry } from '../data/circuitPaths';
import type { LiveTimingCircuit } from '../types/f1';

/**
 * Convert the bundled canonical geometry into the same shape the live timing
 * feed uses for its circuit payload.  Used when no session is live so the map
 * can preview the next round instead of rendering an empty card.
 */
export function buildPreviewCircuit(geom: CircuitGeometry): LiveTimingCircuit {
  const xs = geom.points.map((point) => point.x);
  const ys = geom.points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);

  // Canonical geometry is stored in raw surveying units (tens of thousands),
  // so stroke widths of 5–18 would render sub-pixel. Rescale to a 1000-unit
  // canvas with padding, matching the backend's live circuit viewBoxes.
  const span = Math.max(width, height);
  const scale = 900 / span;
  const offsetX = 50 + ((span - width) * scale) / 2;
  const offsetY = 50 + ((span - height) * scale) / 2;
  const path =
    geom.points
      .map(
        (point, index) =>
          `${index === 0 ? 'M' : 'L'} ${(offsetX + (point.x - minX) * scale).toFixed(1)} ${(
            offsetY + (point.y - minY) * scale
          ).toFixed(1)}`,
      )
      .join(' ') + ' Z';

  return {
    key: `preview-${geom.round}`,
    name: geom.name,
    location: geom.location,
    country: geom.country,
    viewBox: `0 0 ${(span * scale + 100).toFixed(0)} ${(span * scale + 100).toFixed(0)}`,
    path,
  };
}
