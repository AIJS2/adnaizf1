import { memo, useEffect, useMemo, useRef, useState } from 'react';
import { getDriverColor } from '../../data/teamData';
import { getCircuitCorners } from '../../data/circuitCorners';
import { getCircuitGeometry, type CircuitGeometry } from '../../data/circuitPaths';
import type { LiveTimingCircuit, LiveTimingLine } from '../../types/f1';
import { CircuitCornerMarkers } from './CircuitCornerMarkers';

export interface LiveCircuitMapProps {
  circuit: LiveTimingCircuit;
  lines: LiveTimingLine[];
  /** Renders a calmer, dashed "next round" treatment when no session is live. */
  preview?: boolean;
  /** Draw the numbered corner badges. Defaults to false during live timing to keep tracking clean. */
  showCorners?: boolean;
  /** Colour treatment for the corner badges. */
  cornerTone?: 'live' | 'preview' | 'overlay';
  /** Optional aerial satellite tile layer (Esri World Imagery) behind the top-down circuit. */
  satellite?: boolean;
}

interface TrackMapPoint {
  driver: string;
  team: string;
  x: number;
  y: number;
  color: string;
  status: string;
  inPit: boolean;
  isLeader: boolean;
  labelOffsetY: number;
}

interface StartFinishMarker {
  x: number;
  y: number;
  nx: number;
  ny: number;
}

const CIRCUIT_GEO_COORDS: Record<string, { lat: number; lon: number; zoom?: number }> = {
  sakhir: { lat: 26.0325, lon: 50.5106, zoom: 15 },
  bahrain: { lat: 26.0325, lon: 50.5106, zoom: 15 },
  jeddah: { lat: 21.6319, lon: 39.1044, zoom: 15 },
  melbourne: { lat: -37.8497, lon: 144.968, zoom: 15 },
  'albert park': { lat: -37.8497, lon: 144.968, zoom: 15 },
  suzuka: { lat: 34.8431, lon: 136.541, zoom: 15 },
  shanghai: { lat: 31.3389, lon: 121.22, zoom: 15 },
  miami: { lat: 25.9581, lon: -80.2389, zoom: 15 },
  imola: { lat: 44.3439, lon: 11.7167, zoom: 15 },
  monaco: { lat: 43.7347, lon: 7.4206, zoom: 16 },
  'monte carlo': { lat: 43.7347, lon: 7.4206, zoom: 16 },
  montreal: { lat: 45.5, lon: -73.5228, zoom: 15 },
  barcelona: { lat: 41.57, lon: 2.2611, zoom: 15 },
  catalunya: { lat: 41.57, lon: 2.2611, zoom: 15 },
  spielberg: { lat: 47.2197, lon: 14.7647, zoom: 15 },
  silverstone: { lat: 52.0786, lon: -1.0169, zoom: 15 },
  budapest: { lat: 47.5789, lon: 19.2486, zoom: 15 },
  hungaroring: { lat: 47.5789, lon: 19.2486, zoom: 15 },
  spa: { lat: 50.4372, lon: 5.9714, zoom: 14 },
  'spa-francorchamps': { lat: 50.4372, lon: 5.9714, zoom: 14 },
  zandvoort: { lat: 52.3888, lon: 4.5409, zoom: 15 },
  monza: { lat: 45.6156, lon: 9.2811, zoom: 15 },
  baku: { lat: 40.3725, lon: 49.8533, zoom: 15 },
  singapore: { lat: 1.2914, lon: 103.864, zoom: 15 },
  'marina bay': { lat: 1.2914, lon: 103.864, zoom: 15 },
  austin: { lat: 30.1328, lon: -97.6411, zoom: 15 },
  'mexico city': { lat: 19.4042, lon: -99.0907, zoom: 15 },
  'sao paulo': { lat: -23.7011, lon: -46.6977, zoom: 15 },
  interlagos: { lat: -23.7011, lon: -46.6977, zoom: 15 },
  'las vegas': { lat: 36.1147, lon: -115.173, zoom: 15 },
  lusail: { lat: 25.49, lon: 51.4542, zoom: 15 },
  'yas marina': { lat: 24.4672, lon: 54.6031, zoom: 15 },
  'abu dhabi': { lat: 24.4672, lon: 54.6031, zoom: 15 },
};

function resolveSatelliteTiles(
  circuit: LiveTimingCircuit,
  bounds: { x: number; y: number; width: number; height: number },
): Array<{ key: string; url: string; x: number; y: number; size: number }> {
  const hay = `${circuit.key || ''} ${circuit.location || ''} ${circuit.name || ''} ${circuit.country || ''}`
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '');
  let geo: { lat: number; lon: number; zoom?: number } | undefined;
  for (const [k, v] of Object.entries(CIRCUIT_GEO_COORDS)) {
    if (hay.includes(k)) {
      geo = v;
      break;
    }
  }
  if (!geo) return [];

  const z = geo.zoom ?? 15;
  const n = 2 ** z;
  const exactX = ((geo.lon + 180) / 360) * n;
  const latRad = (geo.lat * Math.PI) / 180;
  const exactY = ((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2) * n;

  const centerTileX = Math.floor(exactX);
  const centerTileY = Math.floor(exactY);
  const fracX = exactX - centerTileX;
  const fracY = exactY - centerTileY;

  const cx = bounds.x + bounds.width / 2;
  const cy = bounds.y + bounds.height / 2;
  const tileSize = Math.max(bounds.width, bounds.height) * 0.48;

  const tiles: Array<{ key: string; url: string; x: number; y: number; size: number }> = [];
  for (let dy = -1; dy <= 1; dy++) {
    for (let dx = -1; dx <= 1; dx++) {
      const tx = centerTileX + dx;
      const ty = centerTileY + dy;
      const x = cx + (dx - fracX) * tileSize;
      const y = cy + (dy - fracY) * tileSize;
      tiles.push({
        key: `${z}-${tx}-${ty}`,
        url: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/${z}/${ty}/${tx}`,
        x,
        y,
        size: tileSize + 0.8,
      });
    }
  }
  return tiles;
}

function buildCanonical500Path(geom: CircuitGeometry): string {
  const xs = geom.points.map((p) => p.x);
  const ys = geom.points.map((p) => p.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  const width = Math.max(maxX - minX, 1);
  const height = Math.max(maxY - minY, 1);
  const span = Math.max(width, height);
  const scale = 450 / span;
  const offsetX = 25 + ((span - width) * scale) / 2;
  const offsetY = 25 + ((span - height) * scale) / 2;
  return (
    geom.points
      .map(
        (p, idx) =>
          `${idx === 0 ? 'M' : 'L'} ${(offsetX + (p.x - minX) * scale).toFixed(1)} ${(
            offsetY + (p.y - minY) * scale
          ).toFixed(1)}`,
      )
      .join(' ') + ' Z'
  );
}

function parseViewBoxBounds(value: string): { x: number; y: number; width: number; height: number } {
  const parts = (value || '').split(/[\s,]+/).map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isFinite(part))) {
    return { x: -40, y: -40, width: 580, height: 580 };
  }
  const [x, y, width, height] = parts;
  if (width <= 0 || height <= 0) return { x: -40, y: -40, width: 580, height: 580 };
  return { x, y, width, height };
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

function isDriverRetired(line: LiveTimingLine): boolean {
  if (line.retired === true) return true;
  const status = (line.status || '').toUpperCase();
  const gap = (line.gap || '').toUpperCase().trim();
  const lap = (line.lastLap || '').toUpperCase().trim();
  const outTokens = new Set(['OUT', 'RET', 'STOP', 'DNF', 'DNS', 'DSQ']);
  if (status === 'OUT' && (outTokens.has(gap) || outTokens.has(lap))) {
    return true;
  }
  return false;
}

/**
 * Draws the top-down circuit outline synchronized to canonical F1 Start/Finish
 * geometry and places every running car on it with SVGPathElement.getPointAtLength().
 * The leader sits at the start/finish point (d = 0); remaining cars are placed
 * by live telemetry projection or gap/interval progression.
 */
export const LiveCircuitMap = memo<LiveCircuitMapProps>(
  ({ circuit, lines, preview = false, showCorners = false, cornerTone, satellite = false }) => {
    const pathRef = useRef<SVGPathElement | null>(null);
    const [points, setPoints] = useState<TrackMapPoint[]>([]);
    const [startFinish, setStartFinish] = useState<StartFinishMarker | null>(null);

    const effectivePath = useMemo(() => {
      const rawPath = (circuit.path || '').trim();
      // Legacy julesr02 paths in circuit_paths.json start with M<digit> (no space)
      // and have point 0 shifted away from Start/Finish. Replace with canonical 0..500 path.
      if (/^M-?\d/.test(rawPath)) {
        const canonicalGeom = getCircuitGeometry({
          name: circuit.name,
          location: circuit.location,
          country: circuit.country,
          circuitKey: /^\d+$/.test(circuit.key) ? circuit.key : undefined,
        });
        if (canonicalGeom && canonicalGeom.points.length > 10) {
          return buildCanonical500Path(canonicalGeom);
        }
      }
      return circuit.path;
    }, [circuit.path, circuit.name, circuit.location, circuit.country, circuit.key]);

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
    const vbBounds = useMemo(() => parseViewBoxBounds(viewBox), [viewBox]);
    const scaleFactor = useMemo(() => Math.max(vbBounds.width, vbBounds.height) / 580, [vbBounds]);

    const satelliteTiles = useMemo(
      () => (satellite ? resolveSatelliteTiles(circuit, vbBounds) : []),
      [satellite, circuit, vbBounds],
    );

    useEffect(() => {
      const path = pathRef.current;
      if (
        !path ||
        typeof path.getTotalLength !== 'function' ||
        typeof path.getPointAtLength !== 'function'
      ) {
        setPoints([]);
        setStartFinish(null);
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
        setStartFinish(null);
        return;
      }

      try {
        const p0 = path.getPointAtLength(0);
        const p1 = path.getPointAtLength(Math.min(8, total * 0.015));
        const dx = p1.x - p0.x;
        const dy = p1.y - p0.y;
        const len = Math.hypot(dx, dy) || 1;
        setStartFinish({
          x: p0.x,
          y: p0.y,
          nx: -dy / len,
          ny: dx / len,
        });
      } catch {
        setStartFinish(null);
      }

      const activeLines = lines.filter((line) => !isDriverRetired(line));
      const sourceLines = activeLines.length > 0 ? activeLines : lines;

      const next: TrackMapPoint[] = [];
      sourceLines.forEach((line, index) => {
        const rawProgress =
          typeof line.progress === 'number' && Number.isFinite(line.progress)
            ? line.progress
            : index === 0
              ? 0
              : index * 0.02;
        const progress = Math.max(0, Math.min(rawProgress, 0.985));
        const inPit = (line.status || '').toUpperCase() === 'PIT';
        try {
          const point = path.getPointAtLength(progress * total);
          // Prevent complete label overlap when cars are nose-to-tail in DRS range
          const nearbyCount = next.filter(
            (prev) => Math.hypot(prev.x - point.x, prev.y - point.y) < 16 * scaleFactor,
          ).length;
          const labelOffsetY = nearbyCount % 2 === 1 ? 15 * scaleFactor : -9 * scaleFactor;

          next.push({
            driver: line.driver,
            team: line.team,
            x: point.x,
            y: point.y,
            color: getDriverColor(line.driver, line.team),
            status: line.status || 'TRACK',
            inPit,
            isLeader: index === 0 || String(line.position) === '1',
            labelOffsetY,
          });
        } catch {
          // Ignore a malformed point; the remaining drivers still render.
        }
      });

      setPoints(next);
    }, [effectivePath, lines, scaleFactor]);

    // Render leader last so P1 is always on top of the SVG z-order
    const orderedPoints = useMemo(() => [...points].reverse(), [points]);

    return (
      <svg
        viewBox={viewBox}
        className="w-full h-full p-2 select-none"
        role="img"
        aria-label={`${circuit.name} track map`}
        data-testid="circuit-track-map"
      >
        {/* Top-down aerial satellite tiles or subtle telemetry radar grid */}
        {satellite && satelliteTiles.length > 0 ? (
          <g opacity="0.44" pointerEvents="none">
            {satelliteTiles.map((tile) => (
              <image
                key={tile.key}
                href={tile.url}
                x={tile.x}
                y={tile.y}
                width={tile.size}
                height={tile.size}
                preserveAspectRatio="none"
              />
            ))}
            <rect
              x={vbBounds.x}
              y={vbBounds.y}
              width={vbBounds.width}
              height={vbBounds.height}
              fill="rgba(5, 8, 15, 0.42)"
            />
          </g>
        ) : (
          <g opacity="0.35" pointerEvents="none">
            {[0.2, 0.4, 0.6, 0.8].map((frac) => (
              <g key={frac}>
                <line
                  x1={vbBounds.x + vbBounds.width * frac}
                  y1={vbBounds.y}
                  x2={vbBounds.x + vbBounds.width * frac}
                  y2={vbBounds.y + vbBounds.height}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1 * scaleFactor}
                  strokeDasharray={`${4 * scaleFactor} ${6 * scaleFactor}`}
                />
                <line
                  x1={vbBounds.x}
                  y1={vbBounds.y + vbBounds.height * frac}
                  x2={vbBounds.x + vbBounds.width}
                  y2={vbBounds.y + vbBounds.height * frac}
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={1 * scaleFactor}
                  strokeDasharray={`${4 * scaleFactor} ${6 * scaleFactor}`}
                />
              </g>
            ))}
          </g>
        )}

        {/* Layer 1: Outer track runoff shadow */}
        <path
          d={effectivePath}
          fill="none"
          stroke="rgba(0, 0, 0, 0.78)"
          strokeWidth={24 * scaleFactor}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Layer 2: Track kerb / border casing */}
        <path
          d={effectivePath}
          fill="none"
          stroke={preview ? 'rgba(34, 211, 238, 0.35)' : 'rgba(255, 255, 255, 0.24)'}
          strokeWidth={18 * scaleFactor}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Layer 3: Tarmac / asphalt ribbon */}
        <path
          d={effectivePath}
          fill="none"
          stroke={preview ? '#0b1a22' : '#14171f'}
          strokeWidth={13 * scaleFactor}
          strokeLinejoin="round"
          strokeLinecap="round"
        />

        {/* Layer 4: Centerline racing groove */}
        <path
          d={effectivePath}
          fill="none"
          stroke={preview ? '#64748b' : '#3b4252'}
          strokeWidth={3.5 * scaleFactor}
          strokeLinejoin="round"
          strokeLinecap="round"
          vectorEffect={preview ? 'non-scaling-stroke' : undefined}
        />

        {preview && (
          <path
            d={effectivePath}
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

        {/* Hidden geometry sampler path */}
        <path
          ref={pathRef}
          d={effectivePath}
          fill="none"
          stroke="transparent"
          strokeWidth="1"
        />

        {/* Start / Finish line perpendicular to track tangent at d = 0 */}
        {startFinish && (
          <g pointerEvents="none" aria-label="Start Finish Line">
            <line
              x1={startFinish.x - startFinish.nx * 11 * scaleFactor}
              y1={startFinish.y - startFinish.ny * 11 * scaleFactor}
              x2={startFinish.x + startFinish.nx * 11 * scaleFactor}
              y2={startFinish.y + startFinish.ny * 11 * scaleFactor}
              stroke="#ef4444"
              strokeWidth={3.2 * scaleFactor}
              strokeLinecap="round"
            />
            <line
              x1={startFinish.x - startFinish.nx * 11 * scaleFactor}
              y1={startFinish.y - startFinish.ny * 11 * scaleFactor}
              x2={startFinish.x + startFinish.nx * 11 * scaleFactor}
              y2={startFinish.y + startFinish.ny * 11 * scaleFactor}
              stroke="#ffffff"
              strokeWidth={2 * scaleFactor}
              strokeDasharray={`${2.5 * scaleFactor} ${2.5 * scaleFactor}`}
            />
          </g>
        )}

        {showCorners && corners.length > 0 && (
          <CircuitCornerMarkers
            corners={corners}
            path={effectivePath}
            viewBox={viewBox}
            trackWidth={18 * scaleFactor}
            tone={cornerTone ?? (preview ? 'preview' : 'live')}
          />
        )}

        {orderedPoints.map((point) => (
          <g
            key={point.driver}
            style={{
              transform: `translate(${point.x}px, ${point.y}px)`,
              transition: 'transform 1.4s linear',
              opacity: point.inPit ? 0.75 : 1,
            }}
            data-testid={`driver-marker-${point.driver}`}
          >
            {/* Team-colored telemetry radar pulse halo */}
            <circle
              r={(point.isLeader ? 10 : 8) * scaleFactor}
              fill={point.color}
              opacity={point.inPit ? 0.14 : point.isLeader ? 0.34 : 0.22}
            />
            {/* Car position dot */}
            <circle
              r={(point.inPit ? 5.2 : point.isLeader ? 6.5 : 5.8) * scaleFactor}
              fill={point.color}
              stroke={point.inPit ? '#f59e0b' : '#ffffff'}
              strokeWidth={(point.inPit ? 2 : 1.6) * scaleFactor}
              strokeDasharray={point.inPit ? '3 2' : undefined}
              className="drop-shadow-lg"
            />
            {/* Top-down pill callout */}
            <rect
              x={-15 * scaleFactor}
              y={point.labelOffsetY - 8.5 * scaleFactor}
              width={30 * scaleFactor}
              height={11 * scaleFactor}
              rx={3 * scaleFactor}
              fill="rgba(8, 10, 15, 0.88)"
              stroke={point.inPit ? 'rgba(245, 158, 11, 0.65)' : point.color}
              strokeWidth={0.9 * scaleFactor}
            />
            <text
              y={point.labelOffsetY}
              fontSize={8.5 * scaleFactor}
              fill={point.inPit ? '#fef08a' : '#ffffff'}
              textAnchor="middle"
              className="font-mono font-black"
              style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 1.5 * scaleFactor }}
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
