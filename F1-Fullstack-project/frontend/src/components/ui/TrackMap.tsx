import { useState, useMemo, useCallback } from 'react';
import { Flag, Thermometer, Compass } from 'lucide-react';
import { getTrackMap, getCountryCode } from '../../data/trackData';
import { getCircuitSpec } from '../../data/circuitSpecs';
import { CountryFlag } from './CountryFlag';
import { Track3D } from './Track3D';
import { getCircuitGeometry, sampleCircuitPosition } from '../../data/circuitPaths';
import { getCircuitCorners } from '../../data/circuitCorners';
import { CircuitCornerMarkers } from './CircuitCornerMarkers';

export type TrackMapMode = 'Tracking' | 'Sectors' | 'DRS' | 'Turns';

export interface TrackMapProps {
  raceInfo?: {
    location?: string;
    country?: string;
    name?: string;
    round?: number;
    circuitKey?: number;
    circuit_name?: string;
  } | null;
  laps?: number | null;
  weatherInfo?: Array<{ track_temp?: number; air_temp?: number; TrackTemp?: number; AirTemp?: number }> | null;
  className?: string;
  defaultMode?: TrackMapMode;
}

function calculateAverageSpeed(lengthStr: string, lapRecordStr?: string): string {
  if (!lapRecordStr || lapRecordStr === '—') return '320 km/h';
  const kmMatch = lengthStr.match(/([\d.]+)/);
  if (!kmMatch) return '320 km/h';
  const km = parseFloat(kmMatch[1]);
  const recordMatch = lapRecordStr.match(/(?:(\d+):)?([\d.]+)/);
  if (!recordMatch) return '320 km/h';
  const mins = recordMatch[1] ? parseFloat(recordMatch[1]) : 0;
  const secs = parseFloat(recordMatch[2]);
  const totalSecs = mins * 60 + secs;
  if (totalSecs <= 0) return '320 km/h';
  const avgKmh = Math.round(km / (totalSecs / 3600));
  return `${avgKmh} km/h`;
}

/**
 * Premium Circuit Layout Card modeled after the broadcast & console telemetry UI.
 *
 * Features:
 * - Country Flag + Circuit Name + Country Header
 * - Segmented Tab Switcher: [ Tracking | Sectors | DRS | Turns ]
 * - High-fidelity Vector Circuit Path with glowing outline
 * - Clean Turn Markers (apex anchor dots + compact badges, no long leader lines)
 * - Sector 1 / 2 / 3 segment highlighting
 * - DRS / Active Aero straight-line zones
 * - Telemetry Footer: Average Speed, Circuit Length, Lap Record
 */
export function TrackMap({
  raceInfo,
  laps,
  weatherInfo,
  className,
  defaultMode = 'Turns',
}: TrackMapProps) {
  const [activeMode, setActiveMode] = useState<TrackMapMode>(defaultMode);

  const country = raceInfo?.country;
  const circuitName = raceInfo?.name || raceInfo?.circuit_name || raceInfo?.location || 'Circuit';
  const countryCode = getCountryCode(raceInfo);
  const spec = getCircuitSpec(raceInfo?.name || raceInfo?.location || raceInfo?.country);

  const trackMapImg = getTrackMap(raceInfo);
  const geom = useMemo(() => getCircuitGeometry(raceInfo), [raceInfo]);
  const corners = useMemo(() => getCircuitCorners(raceInfo), [raceInfo]);

  const latestWeather = weatherInfo?.[weatherInfo.length - 1] || {};
  const trackTemp = latestWeather.track_temp ?? latestWeather.TrackTemp;
  const airTemp = latestWeather.air_temp ?? latestWeather.AirTemp;

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

    // Identified high-speed straight fractions based on standard calendar circuits
    // Default 2-3 straights (main straight + longest back straight)
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

  // Start/Finish & Pit straight coordinates
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

    // Bar cross length
    const barR = baseStrokeWidth * 0.9;
    const p1 = { x: sf.x - nx * barR, y: flipY(sf.y) - ny * barR };
    const p2 = { x: sf.x + nx * barR, y: flipY(sf.y) + ny * barR };

    return {
      sfLine: { x1: p1.x, y1: p1.y, x2: p2.x, y2: p2.y },
      anchor: { x: sf.x, y: flipY(sf.y) },
    };
  }, [geom, geomMetrics]);

  const avgSpeed = useMemo(
    () => calculateAverageSpeed(spec.length, spec.lapRecord),
    [spec.length, spec.lapRecord],
  );

  const MODES: TrackMapMode[] = ['Tracking', 'Sectors', 'DRS', 'Turns'];

  return (
    <section
      data-testid="circuit-layout-card"
      className={`relative mb-8 overflow-hidden rounded-2xl sm:rounded-3xl border border-neutral-800/80 bg-neutral-900/90 backdrop-blur-2xl p-5 sm:p-7 shadow-2xl transition-all ${className ?? ''}`}
    >
      {/* Background radial ambient glow */}
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_center,_var(--tw-gradient-stops))] from-neutral-800/20 via-neutral-950/40 to-neutral-950/80"
        aria-hidden="true"
      />

      {/* 1. Header Bar: Flag + Circuit Name + Country & Segmented Mode Pills */}
      <div className="relative z-10 flex flex-wrap items-center justify-between gap-4 mb-4">
        {/* Left: Country flag and circuit identity */}
        <div className="flex items-center gap-3">
          <div className="shrink-0 overflow-hidden rounded-md border border-white/10 shadow-md">
            <CountryFlag code={countryCode} alt={country ?? ''} className="w-9 sm:w-11 h-auto" />
          </div>
          <div>
            <span className="block text-xs font-semibold text-neutral-400 leading-tight">
              {spec.circuitName || circuitName}
            </span>
            <h2 className="text-xl sm:text-2xl font-black text-white tracking-tight leading-tight">
              {country || 'Circuit'}
            </h2>
          </div>
        </div>

        {/* Right: Segmented Pill Mode Switcher */}
        <div className="flex flex-wrap items-center gap-2">
          {geom && (
            <div
              role="tablist"
              aria-label="Circuit Map View Modes"
              className="inline-flex items-center p-1 rounded-full bg-neutral-950/80 border border-neutral-800/90 shadow-inner"
            >
              {MODES.map((mode) => {
                const isActive = activeMode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="tab"
                    aria-selected={isActive}
                    onClick={() => setActiveMode(mode)}
                    data-testid={`circuit-tab-${mode.toLowerCase()}`}
                    className={`px-3 sm:px-4 py-1 sm:py-1.5 rounded-full text-xs font-black tracking-wide transition-all duration-200 cursor-pointer ${
                      isActive
                        ? 'bg-neutral-800 text-white border border-neutral-700/80 shadow-[0_2px_8px_rgba(0,0,0,0.5)]'
                        : 'text-neutral-400 hover:text-neutral-200'
                    }`}
                  >
                    {mode}
                  </button>
                );
              })}
            </div>
          )}

          {/* Environmental weather / laps pills */}
          {laps != null && laps > 0 && (
            <span className="hidden md:inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-mono font-bold bg-red-950/40 text-red-400 border border-red-800/40">
              <Flag size={11} className="text-red-500" />
              <span>{laps} LAPS</span>
            </span>
          )}
          {(trackTemp != null || airTemp != null) && (
            <span className="hidden md:inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold bg-neutral-950/80 text-neutral-300 border border-neutral-800">
              <Thermometer size={12} className="text-amber-500" />
              {trackTemp != null && <span>Track {Math.round(trackTemp)}°C</span>}
              {trackTemp != null && airTemp != null && <span className="text-neutral-600">·</span>}
              {airTemp != null && <span>Air {Math.round(airTemp)}°C</span>}
            </span>
          )}
        </div>
      </div>

      {/* 2. Center Stage: Glowing Circuit Map */}
      <div
        data-testid="circuit-map-stage"
        className="relative my-2 w-full h-[320px] sm:h-[380px] md:h-[440px] flex items-center justify-center overflow-hidden rounded-xl bg-radial from-neutral-900/60 to-neutral-950/80 border border-neutral-800/40"
      >
        {geom && geomMetrics ? (
          <Track3D className="w-full h-full p-2" tone="cyan" tilt={6} interactive={false} flat>
            <svg
              viewBox={geomMetrics.viewBox}
              className="w-full h-full drop-shadow-2xl"
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
              {(activeMode === 'Turns' || activeMode === 'Tracking') && (
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
              {activeMode === 'Sectors' && sectorSegments && (
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
                    <circle cx={sectorSegments.s1Pin.x} cy={sectorSegments.s1Pin.y} r={geomMetrics.maxDim * 0.024} fill="#ec4899" stroke="#fff" strokeWidth={2} />
                    <text x={sectorSegments.s1Pin.x} y={sectorSegments.s1Pin.y} fill="#fff" fontSize={geomMetrics.maxDim * 0.018} fontWeight="900" textAnchor="middle" dominantBaseline="central">S1</text>
                  </g>
                  <g>
                    <circle cx={sectorSegments.s2Pin.x} cy={sectorSegments.s2Pin.y} r={geomMetrics.maxDim * 0.024} fill="#06b6d4" stroke="#fff" strokeWidth={2} />
                    <text x={sectorSegments.s2Pin.x} y={sectorSegments.s2Pin.y} fill="#fff" fontSize={geomMetrics.maxDim * 0.018} fontWeight="900" textAnchor="middle" dominantBaseline="central">S2</text>
                  </g>
                  <g>
                    <circle cx={sectorSegments.s3Pin.x} cy={sectorSegments.s3Pin.y} r={geomMetrics.maxDim * 0.024} fill="#eab308" stroke="#fff" strokeWidth={2} />
                    <text x={sectorSegments.s3Pin.x} y={sectorSegments.s3Pin.y} fill="#fff" fontSize={geomMetrics.maxDim * 0.018} fontWeight="900" textAnchor="middle" dominantBaseline="central">S3</text>
                  </g>
                </g>
              )}

              {/* MODE: DRS / Active Aero straight zones */}
              {activeMode === 'DRS' && (
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
              {activeMode === 'Turns' && corners.length > 0 && (
                <CircuitCornerMarkers
                  corners={corners}
                  trackPoints={trackPointsForCorners}
                  sample={sampleForCorners}
                  viewBox={geomMetrics.viewBox}
                  trackWidth={geomMetrics.baseStrokeWidth}
                  radius={geomMetrics.maxDim * 0.025}
                  tone="clean"
                  showLeaderLines={false}
                />
              )}

              {/* MODE: Tracking -> Speed Trap markers */}
              {activeMode === 'Tracking' && (
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
          </Track3D>
        ) : trackMapImg ? (
          <Track3D className="w-full h-full flex items-center justify-center p-4" tone="red">
            <img
              src={trackMapImg}
              alt={`Track map for ${circuitName}`}
              className="max-h-[260px] sm:max-h-[320px] w-auto max-w-full object-contain"
            />
          </Track3D>
        ) : (
          <div className="flex flex-col items-center justify-center text-center p-6">
            <Compass size={32} className="text-neutral-600 mb-2" />
            <span className="text-xs font-mono font-bold uppercase tracking-widest text-neutral-500">
              Circuit geometry unavailable
            </span>
          </div>
        )}
      </div>

      {/* 3. Bottom Stat Bar (Three columns, matching Image 1 layout) */}
      <div className="relative z-10 grid grid-cols-1 sm:grid-cols-3 gap-4 pt-5 mt-3 border-t border-neutral-800/80">
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
            Average Speed
          </span>
          <span className="font-mono font-black text-xl sm:text-2xl text-white tracking-tight mt-0.5 block">
            {avgSpeed}
          </span>
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
            Circuit Length
          </span>
          <span className="font-mono font-black text-xl sm:text-2xl text-white tracking-tight mt-0.5 block">
            {spec.length}
          </span>
        </div>
        <div>
          <span className="text-xs font-bold uppercase tracking-wider text-neutral-400 block">
            Lap Record
          </span>
          <span className="font-mono font-black text-xl sm:text-2xl text-white tracking-tight mt-0.5 block truncate">
            {spec.lapRecord ?? '—'}
          </span>
        </div>
      </div>
    </section>
  );
}

export default TrackMap;
