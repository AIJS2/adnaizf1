import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { getDriverColor } from '../../data/teamData';
import { getCircuitCorners } from '../../data/circuitCorners';
import type { LiveTimingCircuit, LiveTimingLine } from '../../types/f1';
import { CircuitCornerMarkers } from './CircuitCornerMarkers';

export interface LiveCircuitMapProps {
  circuit: LiveTimingCircuit;
  lines: LiveTimingLine[];
  /** Renders a calmer, dashed "next round" treatment when no session is live. */
  preview?: boolean;
  /** Draw the numbered corner badges. Defaults to true. */
  showCorners?: boolean;
  /** Colour treatment for the corner badges. */
  cornerTone?: 'live' | 'preview' | 'overlay';
}

interface TrackMapPoint {
  driver: string;
  team: string;
  x: number;
  y: number;
  color: string;
  status: string;
  inPit: boolean;
}

function padViewBox(value: string): string {
  const parts = (value || '').split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return '0 0 500 500';
  }
  const [x, y, width, height] = parts;
  if (width <= 0 || height <= 0) return '0 0 500 500';
  const padding = Math.max(width, height) * 0.08;
  return `${x - padding} ${y - padding} ${width + padding * 2} ${height + padding * 2}`;
}

/**
 * Draws the real circuit outline bundled by the backend and places every
 * running car on it with SVGPathElement.getPointAtLength(). The leader sits at
 * the start/finish point; the rest are spread by their gap in seconds.
 *
 * All session drivers (including those in PIT lane) are rendered so no driver
 * mysteriously disappears from the map. Cars in the pit lane are styled with
 * a subdued amber ring and badge.
 *
 * Corner badges are placed collision-free using multi-tier cartographic staggering.
 */
export const LiveCircuitMap = memo<LiveCircuitMapProps>(
  ({ circuit, lines, preview = false, showCorners = true, cornerTone }) => {
    const pathRef = useRef<SVGPathElement | null>(null);
    const [points, setPoints] = useState<TrackMapPoint[]>([]);

    const corners = useMemo(
      () =>
        getCircuitCorners({
          name: circuit.name,
          location: circuit.location,
          country: circuit.country,
          circuitKey: /^\d+$/.test(circuit.key) ? circuit.key : undefined,
        }),
      [circuit.name, circuit.location, circuit.country, circuit.key],
    );

    const viewBox = useMemo(() => padViewBox(circuit.viewBox || '0 0 500 500'), [circuit.viewBox]);

    useEffect(() => {
      const path = pathRef.current;
      if (
        !path ||
        typeof path.getTotalLength !== 'function' ||
        typeof path.getPointAtLength !== 'function'
      ) {
        setPoints([]);
        return;
      }

      let total = 0;
      try {
        total = path.getTotalLength();
      } catch {
        total = 0;
      }
      if (!Number.isFinite(total) || total <= 0) {
        setPoints([]);
        return;
      }

      const next: TrackMapPoint[] = [];
      lines.forEach((line, index) => {
        const rawProgress =
          typeof line.progress === 'number' && Number.isFinite(line.progress)
            ? line.progress
            : index === 0
              ? 0
              : index * 0.02;
        const progress = Math.max(0, Math.min(rawProgress, 0.98));
        const inPit = (line.status || '').toUpperCase() === 'PIT';
        try {
          const point = path.getPointAtLength(progress * total);
          next.push({
            driver: line.driver,
            team: line.team,
            x: point.x,
            y: point.y,
            color: getDriverColor(line.driver, line.team),
            status: line.status || 'TRACK',
            inPit,
          });
        } catch {
          // Ignore a malformed point; the remaining drivers still render.
        }
      });

      setPoints(next);
    }, [circuit.path, lines]);

    return (
      <svg
        viewBox={viewBox}
        className="w-full h-full p-2"
        role="img"
        aria-label={`${circuit.name} track map`}
        data-testid="circuit-track-map"
      >
        <path
          d={circuit.path}
          fill="none"
          stroke={preview ? '#0b1a22' : '#080808'}
          strokeWidth="18"
          strokeLinejoin="round"
          strokeLinecap="round"
        />
        <path
          d={circuit.path}
          fill="none"
          stroke={preview ? '#64748b' : '#3b3b3b'}
          strokeWidth="5"
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect={preview ? 'non-scaling-stroke' : undefined}
        />
        {preview && (
          <path
            d={circuit.path}
            fill="none"
            stroke="#22d3ee"
            strokeWidth="2.5"
            strokeLinejoin="round"
            strokeLinecap="round"
            strokeDasharray="12 18"
            opacity="0.95"
            vectorEffect="non-scaling-stroke"
            className="track-dash"
          />
        )}
        <path
          ref={pathRef}
          d={circuit.path}
          fill="none"
          stroke="transparent"
          strokeWidth="1"
        />
        {showCorners && corners.length > 0 && (
          <CircuitCornerMarkers
            corners={corners}
            path={circuit.path}
            viewBox={viewBox}
            trackWidth={18}
            tone={cornerTone ?? (preview ? 'preview' : 'live')}
          />
        )}
        {points.map((point) => (
          <g
            key={point.driver}
            style={{
              transform: `translate(${point.x}px, ${point.y}px)`,
              transition: 'transform 2s linear',
              opacity: point.inPit ? 0.75 : 1,
            }}
            data-testid={`driver-marker-${point.driver}`}
          >
            <circle
              r={point.inPit ? '5.5' : '6'}
              fill={point.color}
              stroke={point.inPit ? '#f59e0b' : '#000'}
              strokeWidth={point.inPit ? 2 : 1.5}
              strokeDasharray={point.inPit ? '3 2' : undefined}
              className="drop-shadow-lg"
            />
            <text
              y="-9"
              fontSize="9"
              fill={point.inPit ? '#fef08a' : '#fff'}
              textAnchor="middle"
              className="font-mono font-black"
              style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 2 }}
            >
              {point.driver}
              {point.inPit ? '·P' : ''}
            </text>
          </g>
        ))}
      </svg>
    );
  },
);

LiveCircuitMap.displayName = 'LiveCircuitMap';

export default LiveCircuitMap;
