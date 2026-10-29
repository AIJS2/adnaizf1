import { useState, useMemo } from 'react';
import { Flag, Thermometer } from 'lucide-react';
import { getTrackMap, getCountryCode } from '../../data/trackData';
import { getCircuitSpec } from '../../data/circuitSpecs';
import { CountryFlag } from './CountryFlag';
import { getCircuitGeometry } from '../../data/circuitPaths';
import { CircuitVectorView, CircuitVectorMode } from './CircuitVectorView';

export type TrackMapMode = CircuitVectorMode;

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

  const latestWeather = weatherInfo?.[weatherInfo.length - 1] || {};
  const trackTemp = latestWeather.track_temp ?? latestWeather.TrackTemp;
  const airTemp = latestWeather.air_temp ?? latestWeather.AirTemp;

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
        <CircuitVectorView
          circuitLookup={raceInfo}
          mode={activeMode}
          tone="cyan"
          fallbackImg={trackMapImg}
        />
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
