import { useEffect, useMemo, useRef, useState } from 'react';
import type { CircuitCorner } from '../../data/circuitCorners';

export interface CircuitCornerMarkersProps {
  corners: CircuitCorner[];
  /** SVG path data for the same outline the labels are placed on. */
  path: string;
  /** Effective SVG viewBox, used to keep edge labels inside the frame. */
  viewBox: string;
  tone?: 'live' | 'preview' | 'overlay';
  /** Extra separation from the track centreline, in viewBox units. */
  offset?: number;
  /** Badge radius, in viewBox units. */
  radius?: number;
}

interface LabelPoint extends CircuitCorner {
  x: number;
  y: number;
  anchorX: number;
  anchorY: number;
}

interface ViewBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

const FALLBACK_VIEWBOX: ViewBox = { x: 0, y: 0, width: 500, height: 500 };

function parseViewBox(value: string): ViewBox {
  const parts = (value || '').split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return FALLBACK_VIEWBOX;
  }
  const [x, y, width, height] = parts;
  if (width <= 0 || height <= 0) return FALLBACK_VIEWBOX;
  return { x, y, width, height };
}

const PALETTES = {
  live: {
    fill: 'rgba(8, 8, 8, 0.94)',
    ring: 'rgba(255, 255, 255, 0.72)',
    text: '#f8fafc',
    leader: 'rgba(255, 255, 255, 0.24)',
  },
  preview: {
    fill: 'rgba(3, 18, 24, 0.94)',
    ring: 'rgba(34, 211, 238, 0.82)',
    text: '#ecfeff',
    leader: 'rgba(34, 211, 238, 0.36)',
  },
  overlay: {
    fill: 'rgba(3, 3, 3, 0.9)',
    ring: 'rgba(255, 255, 255, 0.88)',
    text: '#ffffff',
    leader: 'rgba(255, 255, 255, 0.28)',
  },
} as const;

/**
 * Places a numbered badge beside every corner of a circuit.  Corner data is
 * stored as a fraction of the lap, so the badge is sampled from the rendered
 * SVG path with `getPointAtLength` instead of relying on an external XY frame.
 * Offsets point away from the circuit centroid, then a small repulsion pass
 * keeps tightly packed chicanes readable.
 */
export function CircuitCornerMarkers({
  corners,
  path,
  viewBox,
  tone = 'live',
  offset,
  radius,
}: CircuitCornerMarkersProps) {
  const probeRef = useRef<SVGPathElement | null>(null);
  const [labels, setLabels] = useState<LabelPoint[]>([]);

  const bounds = useMemo(() => parseViewBox(viewBox), [viewBox]);
  const span = Math.max(bounds.width, bounds.height, 1);
  const badgeRadius = radius ?? span * 0.028;
  const labelOffset = offset ?? span * 0.06;
  const fontSize = badgeRadius * 0.88;
  const palette = PALETTES[tone];

  useEffect(() => {
    const probe = probeRef.current;
    if (
      !probe ||
      !path ||
      corners.length === 0 ||
      typeof probe.getTotalLength !== 'function' ||
      typeof probe.getPointAtLength !== 'function'
    ) {
      setLabels([]);
      return;
    }

    let total = 0;
    try {
      total = probe.getTotalLength();
    } catch {
      total = 0;
    }
    if (!Number.isFinite(total) || total <= 0) {
      setLabels([]);
      return;
    }

    const sample = (fraction: number) => {
      const clamped = Math.max(0, Math.min(1, fraction));
      return probe.getPointAtLength(clamped * total);
    };

    // The centroid is a stable reference for "outside the circuit" on every
    // layout, including tracks that loop back on themselves.
    let cx = 0;
    let cy = 0;
    const centreSamples = 96;
    for (let index = 0; index < centreSamples; index += 1) {
      const point = sample(index / centreSamples);
      cx += point.x;
      cy += point.y;
    }
    cx /= centreSamples;
    cy /= centreSamples;

    const tangentSpan = 8 / total;
    const next: LabelPoint[] = corners.map((corner) => {
      const point = sample(corner.d);
      const before = sample(corner.d - tangentSpan);
      const after = sample(corner.d + tangentSpan);
      let nx = -(after.y - before.y);
      let ny = after.x - before.x;
      const length = Math.hypot(nx, ny) || 1;
      nx /= length;
      ny /= length;
      if ((point.x - cx) * nx + (point.y - cy) * ny < 0) {
        nx = -nx;
        ny = -ny;
      }
      return {
        ...corner,
        anchorX: point.x,
        anchorY: point.y,
        x: point.x + nx * labelOffset,
        y: point.y + ny * labelOffset,
      };
    });

    const separate = (iterations: number) => {
      const minimum = badgeRadius * 1.9;
      for (let iteration = 0; iteration < iterations; iteration += 1) {
        let moved = false;
        for (let i = 0; i < next.length; i += 1) {
          for (let j = i + 1; j < next.length; j += 1) {
            let dx = next[i].x - next[j].x;
            let dy = next[i].y - next[j].y;
            let distance = Math.hypot(dx, dy);
            if (distance < 0.001) {
              dx = i - j || 1;
              dy = 1;
              distance = Math.hypot(dx, dy);
            }
            if (distance < minimum) {
              const push = (minimum - distance) / 2;
              const ux = dx / distance;
              const uy = dy / distance;
              next[i].x += ux * push;
              next[i].y += uy * push;
              next[j].x -= ux * push;
              next[j].y -= uy * push;
              moved = true;
            }
          }
        }
        if (!moved) break;
      }
    };

    const clamp = () => {
      const margin = badgeRadius + 2;
      const minX = bounds.x + margin;
      const maxX = bounds.x + bounds.width - margin;
      const minY = bounds.y + margin;
      const maxY = bounds.y + bounds.height - margin;
      for (const label of next) {
        label.x = Math.max(minX, Math.min(label.x, maxX));
        label.y = Math.max(minY, Math.min(label.y, maxY));
      }
    };

    clamp();
    separate(14);
    clamp();
    separate(4);
    clamp();

    setLabels(next);
  }, [badgeRadius, bounds, corners, labelOffset, path]);

  return (
    <g data-testid="circuit-corner-markers" pointerEvents="none" aria-hidden="true">
      <path ref={probeRef} d={path} fill="none" stroke="none" />
      {labels.map((label, index) => (
        <g key={`${label.number}-${label.letter ?? ''}-${index}`}>
          <line
            x1={label.anchorX}
            y1={label.anchorY}
            x2={label.x}
            y2={label.y}
            stroke={palette.leader}
            strokeWidth={Math.max(0.75, badgeRadius * 0.08)}
          />
          <circle
            cx={label.x}
            cy={label.y}
            r={badgeRadius}
            fill={palette.fill}
            stroke={palette.ring}
            strokeWidth={Math.max(1, badgeRadius * 0.11)}
          />
          <text
            x={label.x}
            y={label.y}
            fill={palette.text}
            fontSize={fontSize}
            textAnchor="middle"
            dominantBaseline="central"
            className="font-mono font-black"
          >
            {label.number}
            {label.letter}
          </text>
        </g>
      ))}
    </g>
  );
}

export default CircuitCornerMarkers;
