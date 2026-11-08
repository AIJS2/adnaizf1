import { useMemo, useCallback, useState } from 'react';
import { Compass } from 'lucide-react';
import { Track3D } from './Track3D';
import {
  CircuitLookup,
  getCircuitGeometry,
  sampleCircuitPosition,
} from '../../data/circuitPaths';
import { getCircuitCorners, CircuitCorner } from '../../data/circuitCorners';
import { getCircuitSpec } from '../../data/circuitSpecs';
import { getCornerDetail } from '../../data/cornerDetails';
import { CircuitCornerMarkers } from './CircuitCornerMarkers';
import { CornerDetailCard } from './CornerDetailCard';

export type CircuitVectorMode = 'Tracking' | 'Sectors' | 'DRS' | 'Turns';

export interface CircuitVectorViewProps {
  circuitLookup?: CircuitLookup | null;
  mode?: CircuitVectorMode;
  tone?: 'red' | 'cyan' | 'amber';
  fallbackImg?: string | null;
  className?: string;
  badgeRadiusScale?: number;
  interactiveCorners?: boolean;
  /** Show the corner's "Lore & History" fun fact in the spotlight card. */
  showCornerFunFact?: boolean;
}

/**
 * Renders an ultra-sharp, glowing vector circuit path with support for:
 * - Turns mode: Numbered corner badges with precision dark apex dots
 * - Sectors mode: S1 (pink), S2 (cyan), S3 (amber) color coding + pin badges
 * - DRS mode: Glowing green straight-line Active Aero / DRS zones
 * - Tracking mode: Clean circuit outline with Speed Trap pin
 * - Start/Finish chequered line bar
 * - Fallback to static bitmap if vector geometry is missing
 */
export function CircuitVectorView({
  circuitLookup,
  mode = 'Turns',
  tone = 'red',
  fallbackImg,
  className,
  badgeRadiusScale = 1,
  interactiveCorners = true,
  showCornerFunFact = true,
}: CircuitVectorViewProps) {
  const geom = useMemo(() => getCircuitGeometry(circuitLookup), [circuitLookup]);
  const corners = useMemo(() => getCircuitCorners(circuitLookup), [circuitLookup]);
  const spec = useMemo(
    () =>
      getCircuitSpec(
        circuitLookup?.name || circuitLookup?.location || circuitLookup?.country,
      ),
    [circuitLookup],
  );

  const circuitName =
    circuitLookup?.name ||
    circuitLookup?.location ||
    geom?.name ||
    'Circuit';

  // Interactive corner spotlight state
  const [selectedCorner, setSelectedCorner] = useState<CircuitCorner | null>(null);

  const cornerIndex = useMemo(() => {
    if (!selectedCorner) return -1;
    return corners.findIndex(
      (c) =>
        c.number === selectedCorner.number &&
        (c.letter ?? '') === (selectedCorner.letter ?? ''),
    );
  }, [corners, selectedCorner]);

  const handlePrevCorner = useCallback(() => {
    if (corners.length === 0 || cornerIndex === -1) return;
    const prevIdx = (cornerIndex - 1 + corners.length) % corners.length;
    setSelectedCorner(corners[prevIdx]);
  }, [corners, cornerIndex]);

  const handleNextCorner = useCallback(() => {
    if (corners.length === 0 || cornerIndex === -1) return;
    const nextIdx = (cornerIndex + 1) % corners.length;
    setSelectedCorner(corners[nextIdx]);
  }, [corners, cornerIndex]);

  const activeCornerDetail = useMemo(() => {
    if (!selectedCorner) return null;
    return getCornerDetail(circuitLookup, selectedCorner.number, selectedCorner.letter);
  }, [circuitLookup, selectedCorner]);

  // Compute ViewBox and geometry metrics
  const geomMetrics = useMemo(() => {
    if (!geom || geom.points.length === 0) return null;
    const refXs = geom.points.map((p) => p.x);
    const refYs = geom.points.map((p) => p.y);
    const minX = Math.min(...refXs);
    const maxX = Math.max(...refXs);
    const minY = Math.min(...refYs);
    const maxY = Math.max(...refYs);
    const width = maxX - minX;
    const height = maxY - minY;
    const maxDim = Math.max(width, height, 1);
    const padding = maxDim * 0.12;
    const viewBox = `${minX - padding} ${minY - padding} ${width + padding * 2} ${height + padding * 2}`;
    const flipY = (y: number) => maxY + minY - y;
    const baseStrokeWidth = Math.max(14, maxDim * 0.018);

    return {
      minX,
      maxX,
      minY,
      maxY,
      width,
      height,
      maxDim,
      viewBox,
      flipY,
      baseStrokeWidth,
    };
  }, [geom]);

  const trackPointsForCorners = useMemo(() => {
    if (!geom || !geomMetrics) return [];
    return geom.points.map((p) => ({ x: p.x, y: geomMetrics.flipY(p.y) }));
  }, [geom, geomMetrics]);

  const sampleForCorners = useCallback(
    (d: number) => {
      if (!geom || !geomMetrics) return { x: 0, y: 0 };
      const pt = sampleCircuitPosition(geom, d);
      return { x: pt.x, y: geomMetrics.flipY(pt.y) };
    },
    [geom, geomMetrics],
  );

  // Sector polylines for Sectors mode
  const sectorSegments = useMemo(() => {
    if (!geom || !geomMetrics) return null;
    const { flipY } = geomMetrics;
    const pts = geom.points;

    const s1Pts = pts.filter((p) => p.d <= 0.34);
    const s2Pts = pts.filter((p) => p.d >= 0.33 && p.d <= 0.68);
    const s3Pts = pts.filter((p) => p.d >= 0.66);

    const s1Pin = sampleCircuitPosition(geom, 0.16);
    const s2Pin = sampleCircuitPosition(geom, 0.5);
    const s3Pin = sampleCircuitPosition(geom, 0.83);

    return {
      s1: s1Pts.map((p) => `${p.x},${flipY(p.y)}`).join(' '),
      s2: s2Pts.map((p) => `${p.x},${flipY(p.y)}`).join(' '),
      s3: s3Pts.map((p) => `${p.x},${flipY(p.y)}`).join(' '),
      s1Pin: { x: s1Pin.x, y: flipY(s1Pin.y) },
      s2Pin: { x: s2Pin.x, y: flipY(s2Pin.y) },
      s3Pin: { x: s3Pin.x, y: flipY(s3Pin.y) },
    };
  }, [geom, geomMetrics]);

  // DRS straight zones for DRS mode
  const drsZones = useMemo(() => {
    if (!geom || !geomMetrics) return [];
    const { flipY } = geomMetrics;

    const zonesDef = [
      { start: 0.95, end: 0.05, label: 'DRS 1' },
      { start: 0.15, end: 0.28, label: 'DRS 2' },
      { start: 0.55, end: 0.68, label: 'DRS 3' },
    ].slice(0, spec.drsZones ?? spec.activeAeroZones ?? 3);

    return zonesDef.map((z) => {
      const pts = geom.points.filter((p) => {
        if (z.start > z.end) return p.d >= z.start || p.d <= z.end;
        return p.d >= z.start && p.d <= z.end;
      });
      const midD = z.start > z.end ? ((z.start + z.end + 1) / 2) % 1 : (z.start + z.end) / 2;
      const midPt = sampleCircuitPosition(geom, midD);
      return {
        polyline: pts.map((p) => `${p.x},${flipY(p.y)}`).join(' '),
        label: z.label,
        midPoint: { x: midPt.x, y: flipY(midPt.y) },
      };
    });
  }, [geom, geomMetrics, spec.activeAeroZones, spec.drsZones]);

  // Start/Finish bar coordinates
  const startFinishData = useMemo(() => {
    if (!geom || !geomMetrics) return null;
    const { flipY, baseStrokeWidth } = geomMetrics;
    const sf = sampleCircuitPosition(geom, 0.002);
    const before = sampleCircuitPosition(geom, 0.998);
    const after = sampleCircuitPosition(geom, 0.006);

    let tx = after.x - before.x;
    let ty = flipY(after.y) - flipY(before.y);
    const len = Math.hypot(tx, ty) || 1;
    tx /= len;
    ty /= len;
    const nx = -ty;
    const ny = tx;

    const barR = baseStrokeWidth * 0.9;
    const p1 = { x: sf.x - nx * barR, y: flipY(sf.y) - ny * barR };
    const p2 = { x: sf.x + nx * barR, y: flipY(sf.y) + ny * barR };

    return {
      sfLine: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
      anchor: { x: sf.x, y: flipY(sf.y) },
    };
  }, [geom, geomMetrics]);

  if (geom && geomMetrics) {
    return (
      <Track3D
        className={`w-full h-full flex items-center justify-center p-2 ${className ?? ''}`}
        tone={tone}
        tilt={tone === 'cyan' ? 6 : 4}
        interactive={false}
        flat
      >
        <svg
          viewBox={geomMetrics.viewBox}
          className="w-full h-full max-h-full drop-shadow-2xl"
          role="img"
          aria-label={`${circuitName} track layout`}
        >
          {/* Outer halo blur */}
          <polyline
            points={geom.points.map((p) => `${p.x},${geomMetrics.flipY(p.y)}`).join(' ')}
            fill="none"
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth={geomMetrics.baseStrokeWidth * 1.8}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* Base dark track ribbon */}
          <polyline
            points={geom.points.map((p) => `${p.x},${geomMetrics.flipY(p.y)}`).join(' ')}
            fill="none"
            stroke="#121214"
            strokeWidth={geomMetrics.baseStrokeWidth * 1.3}
            strokeLinecap="round"
            strokeLinejoin="round"
          />

          {/* MODE: Turns or Tracking -> White glowing circuit line */}
          {(mode === 'Turns' || mode === 'Tracking') && (
            <polyline
              points={geom.points.map((p) => `${p.x},${geomMetrics.flipY(p.y)}`).join(' ')}
              fill="none"
              stroke="#ffffff"
              strokeWidth={geomMetrics.baseStrokeWidth * 0.65}
              strokeLinecap="round"
              strokeLinejoin="round"
              className="drop-shadow-[0_0_10px_rgba(255,255,255,0.7)]"
            />
          )}

          {/* MODE: Sectors -> Segmented S1 (Pink), S2 (Cyan), S3 (Amber) */}
          {mode === 'Sectors' && sectorSegments && (
            <g data-testid="sector-segments">
              {/* Sector 1 */}
              <polyline
                points={sectorSegments.s1}
                fill="none"
                stroke="#ec4899"
                strokeWidth={geomMetrics.baseStrokeWidth * 0.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_0_12px_rgba(236,72,153,0.8)]"
              />
              {/* Sector 2 */}
              <polyline
                points={sectorSegments.s2}
                fill="none"
                stroke="#06b6d4"
                strokeWidth={geomMetrics.baseStrokeWidth * 0.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_0_12px_rgba(6,182,212,0.8)]"
              />
              {/* Sector 3 */}
              <polyline
                points={sectorSegments.s3}
                fill="none"
                stroke="#eab308"
                strokeWidth={geomMetrics.baseStrokeWidth * 0.75}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="drop-shadow-[0_0_12px_rgba(234,179,8,0.8)]"
              />

              {/* Sector Badges */}
              <g>
                <circle
                  cx={sectorSegments.s1Pin.x}
                  cy={sectorSegments.s1Pin.y}
                  r={geomMetrics.maxDim * 0.024}
                  fill="#ec4899"
                  stroke="#fff"
                  strokeWidth={2}
                />
                <text
                  x={sectorSegments.s1Pin.x}
                  y={sectorSegments.s1Pin.y}
                  fill="#fff"
                  fontSize={geomMetrics.maxDim * 0.018}
                  fontWeight="900"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  S1
                </text>
              </g>
              <g>
                <circle
                  cx={sectorSegments.s2Pin.x}
                  cy={sectorSegments.s2Pin.y}
                  r={geomMetrics.maxDim * 0.024}
                  fill="#06b6d4"
                  stroke="#fff"
                  strokeWidth={2}
                />
                <text
                  x={sectorSegments.s2Pin.x}
                  y={sectorSegments.s2Pin.y}
                  fill="#fff"
                  fontSize={geomMetrics.maxDim * 0.018}
                  fontWeight="900"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  S2
                </text>
              </g>
              <g>
                <circle
                  cx={sectorSegments.s3Pin.x}
                  cy={sectorSegments.s3Pin.y}
                  r={geomMetrics.maxDim * 0.024}
                  fill="#eab308"
                  stroke="#fff"
                  strokeWidth={2}
                />
                <text
                  x={sectorSegments.s3Pin.x}
                  y={sectorSegments.s3Pin.y}
                  fill="#fff"
                  fontSize={geomMetrics.maxDim * 0.018}
                  fontWeight="900"
                  textAnchor="middle"
                  dominantBaseline="central"
                >
                  S3
                </text>
              </g>
            </g>
          )}

          {/* MODE: DRS / Active Aero straight zones */}
          {mode === 'DRS' && (
            <g data-testid="drs-zones">
              {/* Dim core track */}
              <polyline
                points={geom.points.map((p) => `${p.x},${geomMetrics.flipY(p.y)}`).join(' ')}
                fill="none"
                stroke="#3f3f46"
                strokeWidth={geomMetrics.baseStrokeWidth * 0.6}
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              {/* Glowing DRS straights */}
              {drsZones.map((z, idx) => (
                <g key={idx}>
                  <polyline
                    points={z.polyline}
                    fill="none"
                    stroke="#10b981"
                    strokeWidth={geomMetrics.baseStrokeWidth * 0.85}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    className="drop-shadow-[0_0_14px_rgba(16,185,129,0.9)]"
                  />
                  <rect
                    x={z.midPoint.x - geomMetrics.maxDim * 0.045}
                    y={z.midPoint.y - geomMetrics.maxDim * 0.022}
                    width={geomMetrics.maxDim * 0.09}
                    height={geomMetrics.maxDim * 0.044}
                    rx={geomMetrics.maxDim * 0.022}
                    fill="#064e3b"
                    stroke="#10b981"
                    strokeWidth={1.5}
                  />
                  <text
                    x={z.midPoint.x}
                    y={z.midPoint.y}
                    fill="#ecfdf5"
                    fontSize={geomMetrics.maxDim * 0.016}
                    fontWeight="900"
                    textAnchor="middle"
                    dominantBaseline="central"
                    className="font-mono"
                  >
                    {z.label}
                  </text>
                </g>
              ))}
            </g>
          )}

          {/* Start / Finish Line (Chequered bar) */}
          {startFinishData && (
            <g data-testid="start-finish-bar">
              <line
                x1={startFinishData.sfLine.x1}
                y1={startFinishData.sfLine.y1}
                x2={startFinishData.sfLine.x2}
                y2={startFinishData.sfLine.y2}
                stroke="#ffffff"
                strokeWidth={Math.max(2.5, geomMetrics.baseStrokeWidth * 0.22)}
                strokeDasharray="4 4"
                strokeLinecap="square"
              />
            </g>
          )}

          {/* MODE: Turns -> Clean turn badges (apex dots + compact badges, zero long lines) */}
          {mode === 'Turns' && corners.length > 0 && (
            <CircuitCornerMarkers
              corners={corners}
              trackPoints={trackPointsForCorners}
              sample={sampleForCorners}
              viewBox={geomMetrics.viewBox}
              trackWidth={geomMetrics.baseStrokeWidth}
              radius={geomMetrics.maxDim * 0.025 * badgeRadiusScale}
              tone="clean"
              showLeaderLines={false}
              selectedCorner={interactiveCorners ? selectedCorner : undefined}
              onCornerClick={interactiveCorners ? (corner) => setSelectedCorner(corner) : undefined}
            />
          )}

          {/* MODE: Tracking -> Speed Trap markers */}
          {mode === 'Tracking' && (
            <g data-testid="speed-trap-markers">
              {(() => {
                const st = sampleCircuitPosition(geom, 0.98);
                return (
                  <g>
                    <circle
                      cx={st.x}
                      cy={geomMetrics.flipY(st.y)}
                      r={geomMetrics.maxDim * 0.018}
                      fill="#ef4444"
                      stroke="#ffffff"
                      strokeWidth={1.5}
                    />
                    <text
                      x={st.x}
                      y={geomMetrics.flipY(st.y) - geomMetrics.maxDim * 0.028}
                      fill="#f87171"
                      fontSize={geomMetrics.maxDim * 0.015}
                      fontWeight="bold"
                      textAnchor="middle"
                      className="font-mono"
                    >
                      SPEED TRAP
                    </text>
                  </g>
                );
              })()}
            </g>
          )}
        </svg>

        {/* Turns Mode helper hint pill */}
        {mode === 'Turns' && interactiveCorners && showCornerFunFact && !selectedCorner && corners.length > 0 && (
          <div
            data-testid="corner-click-hint"
            className="absolute top-3 left-3 z-20 pointer-events-none hidden sm:flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-neutral-950/80 border border-neutral-800/80 text-[11px] text-neutral-400 font-medium backdrop-blur-xs shadow-md"
          >
            <span className="text-amber-400">💡</span> Click any turn for iconic lore & telemetry
          </div>
        )}

        {/* Interactive Corner Spotlight Card */}
        {mode === 'Turns' && interactiveCorners && selectedCorner && activeCornerDetail && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm z-30 pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
            <CornerDetailCard
              detail={activeCornerDetail}
              circuitName={circuitName}
              showFunFact={showCornerFunFact}
              onClose={() => setSelectedCorner(null)}
              onPrev={corners.length > 1 ? handlePrevCorner : undefined}
              onNext={corners.length > 1 ? handleNextCorner : undefined}
            />
          </div>
        )}
      </Track3D>
    );
  }

  if (fallbackImg) {
    return (
      <Track3D
        className={`w-full h-full flex items-center justify-center p-4 ${className ?? ''}`}
        tone={tone}
      >
        <div
          className={`absolute inset-0 blur-2xl rounded-full pointer-events-none ${
            tone === 'cyan' ? 'bg-cyan-500/10' : 'bg-red-600/5'
          }`}
          aria-hidden="true"
        />
        <img
          src={fallbackImg}
          alt={`Track map for ${circuitName}`}
          className="max-h-[170px] sm:max-h-[195px] w-auto max-w-full object-contain invert transition-transform duration-500 hover:scale-105"
        />
      </Track3D>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center text-center p-6 ${className ?? ''}`}
    >
      <Compass size={32} className="text-neutral-600 mb-2" />
      <span className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-500">
        Circuit geometry unavailable
      </span>
    </div>
  );
}
export default CircuitVectorView;
