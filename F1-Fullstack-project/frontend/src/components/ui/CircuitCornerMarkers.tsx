import { useEffect, useMemo, useRef, useState } from 'react';
import type { CircuitCorner } from '../../data/circuitCorners';
import { computeCornerLayout, type PlacedCornerBadge } from '../../utils/cornerLayout';

export interface CircuitCornerMarkersProps {
  corners: CircuitCorner[];
  /** SVG path data for the same outline the labels are placed on. */
  path?: string;
  /** Explicit track centerline samples (e.g. from canonical geometry). */
  trackPoints?: Array<{ x: number; y: number }>;
  /** Explicit position sampler for normalized lap distance [0, 1]. */
  sample?: (d: number) => { x: number; y: number };
  /** Effective SVG viewBox, used to keep edge labels inside the frame. */
  viewBox: string;
  tone?: 'live' | 'preview' | 'overlay' | 'clean';
  /** Track stroke width in viewBox units. Defaults to 18 for live map. */
  trackWidth?: number;
  /** Badge radius, in viewBox units. */
  radius?: number;
  /**
   * Whether to render leader lines from corner apex to badge.
   * Defaults to false for the clean, line-free aesthetic seen in broadcast/console graphics.
   */
  showLeaderLines?: boolean;
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
    leader: 'rgba(255, 255, 255, 0.28)',
    anchor: 'rgba(255, 255, 255, 0.7)',
  },
  preview: {
    fill: 'rgba(3, 18, 24, 0.94)',
    ring: 'rgba(34, 211, 238, 0.82)',
    text: '#ecfeff',
    leader: 'rgba(34, 211, 238, 0.36)',
    anchor: 'rgba(34, 211, 238, 0.8)',
  },
  overlay: {
    fill: 'rgba(3, 3, 3, 0.92)',
    ring: 'rgba(255, 255, 255, 0.88)',
    text: '#ffffff',
    leader: 'rgba(255, 255, 255, 0.3)',
    anchor: 'rgba(255, 255, 255, 0.85)',
  },
  clean: {
    fill: 'rgba(20, 20, 24, 0.95)',
    ring: 'rgba(255, 255, 255, 0.45)',
    text: '#ffffff',
    leader: 'rgba(255, 255, 255, 0.2)',
    anchor: '#ffffff',
  },
} as const;

/**
 * Places a numbered badge beside every corner of a circuit without overlapping
 * badges or covering the track ribbon. Uses the deterministic cartographic
 * `computeCornerLayout` algorithm with multi-tier radial staggering and
 * collision-avoidance candidate selection.
 */
export function CircuitCornerMarkers({
  corners,
  path,
  trackPoints: explicitTrackPoints,
  sample: explicitSample,
  viewBox,
  tone = 'live',
  trackWidth = 18,
  radius,
  showLeaderLines = false,
}: CircuitCornerMarkersProps) {
  const probeRef = useRef<SVGPathElement | null>(null);
  const [labels, setLabels] = useState<PlacedCornerBadge[]>([]);

  const bounds = useMemo(() => parseViewBox(viewBox), [viewBox]);
  const span = Math.max(bounds.width, bounds.height, 1);
  const badgeRadius = radius ?? span * 0.026;
  const fontSize = badgeRadius * 0.86;
  const palette = PALETTES[tone];

  // If explicit sampler and track points are provided (e.g. TrackDominationMap),
  // we can calculate the layout immediately.
  const hasExplicitGeometry = Boolean(
    explicitSample && explicitTrackPoints && explicitTrackPoints.length > 0,
  );

  useEffect(() => {
    if (corners.length === 0) {
      setLabels([]);
      return;
    }

    // Direct geometric layout path
    if (explicitSample && explicitTrackPoints && explicitTrackPoints.length > 0) {
      const placed = computeCornerLayout({
        corners,
        sample: explicitSample,
        trackPoints: explicitTrackPoints,
        viewBox: bounds,
        trackWidth,
        badgeRadius,
      });
      setLabels(placed);
      return;
    }

    // SVG path probe layout
    const probe = probeRef.current;
    if (
      !probe ||
      !path ||
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

    const M = 160;
    const trackPoints: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < M; i++) {
      trackPoints.push(sample(i / M));
    }

    const placed = computeCornerLayout({
      corners,
      sample,
      trackPoints,
      viewBox: bounds,
      trackWidth,
      badgeRadius,
    });

    setLabels(placed);
  }, [
    badgeRadius,
    bounds,
    corners,
    explicitSample,
    explicitTrackPoints,
    path,
    trackWidth,
  ]);

  return (
    <g data-testid="circuit-corner-markers" pointerEvents="none" aria-hidden="true">
      {!hasExplicitGeometry && path && (
        <path ref={probeRef} d={path} fill="none" stroke="none" />
      )}
      {labels.map((label, index) => (
        <g
          key={`${label.number}-${label.letter ?? ''}-${index}`}
          data-testid={`corner-marker-${label.number}${label.letter ?? ''}`}
        >
          {/* Leader line from corner apex to badge perimeter (only when explicitly requested) */}
          {showLeaderLines && (
            <line
              x1={label.anchorX}
              y1={label.anchorY}
              x2={label.leaderEndX}
              y2={label.leaderEndY}
              stroke={palette.leader}
              strokeWidth={Math.max(0.75, badgeRadius * 0.08)}
              strokeLinecap="round"
            />
          )}
          {/* Subtle anchor dot at apex on the circuit centerline */}
          <circle
            cx={label.anchorX}
            cy={label.anchorY}
            r={Math.max(1.5, badgeRadius * 0.16)}
            fill={palette.anchor}
            className="corner-anchor-dot"
          />
          {/* Badge circle */}
          <circle
            cx={label.x}
            cy={label.y}
            r={label.radius}
            fill={palette.fill}
            stroke={palette.ring}
            strokeWidth={Math.max(1, badgeRadius * 0.11)}
            className="corner-badge-circle drop-shadow-md"
          />
          {/* Badge number */}
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
