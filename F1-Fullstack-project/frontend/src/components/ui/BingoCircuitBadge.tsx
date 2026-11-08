/**
 * Compact SVG circuit badge for Bingo cells.
 * Shows the track outline of the active race's circuit — adds visual identity
 * to each cell without needing a per-cell image.
 */
import { useMemo } from 'react';
import { getCircuitGeometry } from '../../data/circuitPaths';
import { CircuitLookup } from '../../data/circuitPaths';

interface BingoCircuitBadgeProps {
  circuitLookup: CircuitLookup;
  /** Opacity of the circuit path (default 0.25 — decorative) */
  opacity?: number;
  className?: string;
}

export function BingoCircuitBadge({
  circuitLookup,
  opacity = 0.25,
  className = '',
}: BingoCircuitBadgeProps) {
  const geom = useMemo(() => getCircuitGeometry(circuitLookup), [circuitLookup]);

  if (!geom || !geom.points || geom.points.length === 0) return null;

  const pts = geom.points;
  // Scale to a small viewBox (60x36 aspect ratio)
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const w = maxX - minX || 1;
  const h = maxY - minY || 1;
  const pad = Math.max(w, h) * 0.08;
  const vb = `${minX - pad} ${minY - pad} ${w + pad * 2} ${h + pad * 2}`;

  // Build the closed path
  const pathStr = pts.reduce(
    (acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`,
    '',
  ) + ' Z';

  return (
    <svg
      viewBox={vb}
      className={`w-full h-full ${className}`}
      style={{ opacity }}
      aria-hidden="true"
    >
      <path
        d={pathStr}
        fill="none"
        stroke="currentColor"
        strokeWidth={Math.max(1.5, w * 0.015)}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
