import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Play,
  Pause,
  RotateCcw,
  Gauge,
  Zap,
  ChevronDown,
  Radio,
  Sliders,
} from 'lucide-react';
import { API_URL } from '../config';
import { Race, TelemetryDataPoint, TeamDriverInfo } from '../types/f1';
import { getCircuitGeometry, sampleCircuitPosition, CircuitGeometry } from '../data/circuitPaths';
import { getDriverColor, DRIVER_TEAM_COLORS_2026 } from '../data/teamData';
import { generateDemoTelemetry, GhostDriverSample } from '../utils/ghostRaceData';
import { resolveNextRace } from '../utils/nextRace';

const CURRENT_YEAR = new Date().getFullYear();

const PRESETS = [
  { a: 'VER', b: 'NOR', label: 'Verstappen vs Norris' },
  { a: 'LEC', b: 'HAM', label: 'Leclerc vs Hamilton' },
  { a: 'PIA', b: 'RUS', label: 'Piastri vs Russell' },
  { a: 'ALO', b: 'SAI', label: 'Alonso vs Sainz' },
];

const GhostRacePage: React.FC = () => {
  // Calendar data for round/circuit selector
  const { data: races = [] } = useQuery<Race[]>({
    queryKey: ['races', CURRENT_YEAR],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/races/${CURRENT_YEAR}`);
      if (!res.ok) throw new Error('Failed to load races');
      const data = await res.json();
      return Array.isArray(data) ? data : [];
    },
  });

  const nextRace = useMemo(() => resolveNextRace(races), [races]);
  // Default to round with existing telemetry or next race or 1
  const [selectedRound, setSelectedRound] = useState<number>(1);

  // Sync to nextRace round when loaded if round is 1
  useEffect(() => {
    if (nextRace && nextRace.round) {
      setSelectedRound(Number(nextRace.round));
    } else if (races.length > 0 && races[0].round) {
      setSelectedRound(Number(races[0].round));
    }
  }, [nextRace, races]);

  const activeRace = useMemo(
    () => races.find((r) => Number(r.round) === Number(selectedRound)) ?? null,
    [races, selectedRound],
  );

  // Drivers
  const [driverA, setDriverA] = useState<string>('VER');
  const [driverB, setDriverB] = useState<string>('NOR');

  // Available drivers for the round
  const { data: availableDrivers = [] } = useQuery<{ abbreviation: string; full_name: string; team_name: string }[]>({
    queryKey: ['telemetry-drivers', CURRENT_YEAR, selectedRound],
    queryFn: async () => {
      try {
        const res = await fetch(`${API_URL}/api/telemetry-drivers/${CURRENT_YEAR}/${selectedRound}`);
        if (!res.ok) return [];
        const data = await res.json();
        return Array.isArray(data) ? data : [];
      } catch {
        return [];
      }
    },
    staleTime: 60000,
  });

  // Circuit geometry
  const circuitGeom = useMemo<CircuitGeometry | null>(() => {
    return getCircuitGeometry({
      round: selectedRound,
      name: activeRace?.circuit ?? activeRace?.name,
      location: activeRace?.location,
      country: activeRace?.country,
    });
  }, [selectedRound, activeRace]);

  // Telemetry Query
  const {
    data: realTelemetryData,
  } = useQuery<{
    drivers: string[];
    driver_info: Record<string, TeamDriverInfo>;
    telemetry: TelemetryDataPoint[];
  } | null>({
    queryKey: ['ghost-telemetry', CURRENT_YEAR, selectedRound, driverA, driverB],
    queryFn: async () => {
      if (!driverA || !driverB || driverA === driverB) return null;
      const res = await fetch(
        `${API_URL}/api/telemetry/${CURRENT_YEAR}/${selectedRound}?drivers=${driverA},${driverB}`,
      );
      if (!res.ok) throw new Error('Telemetry not available');
      const data = await res.json();
      if (!data || !Array.isArray(data.telemetry) || data.telemetry.length === 0) {
        throw new Error('No telemetry points');
      }
      return data;
    },
    retry: 1,
  });

  // Synthetic fallback when API has no telemetry for this session
  const telemetryPoints: TelemetryDataPoint[] = useMemo(() => {
    if (realTelemetryData && realTelemetryData.telemetry.length > 10) {
      return realTelemetryData.telemetry;
    }
    // Fallback synthesis over circuit geometry or generic circle
    if (!circuitGeom) return [];
    const sampleA: GhostDriverSample = {
      code: driverA,
      name: driverA,
      team: DRIVER_TEAM_COLORS_2026[driverA]?.team || 'Team A',
      baseColor: getDriverColor(driverA),
    };
    const sampleB: GhostDriverSample = {
      code: driverB,
      name: driverB,
      team: DRIVER_TEAM_COLORS_2026[driverB]?.team || 'Team B',
      baseColor: getDriverColor(driverB),
    };
    return generateDemoTelemetry(circuitGeom, sampleA, sampleB, 350);
  }, [realTelemetryData, circuitGeom, driverA, driverB]);

  const isSimulated = !realTelemetryData || realTelemetryData.telemetry.length === 0;

  // Replay State
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [progress, setProgress] = useState<number>(0); // 0.0 to 1.0
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1); // 0.5x, 1x, 2x, 4x

  // Animation frame loop
  const lastTimeRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);

  const LAP_DURATION_MS = 25000; // Base 25 seconds for a complete lap replay at 1x

  useEffect(() => {
    if (!isPlaying) {
      lastTimeRef.current = null;
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      return;
    }

    const animate = (timestamp: number) => {
      if (lastTimeRef.current !== null) {
        const delta = timestamp - lastTimeRef.current;
        const progressIncrement = (delta / (LAP_DURATION_MS / playbackSpeed));
        setProgress((prev) => {
          const next = prev + progressIncrement;
          if (next >= 1) {
            return 0; // Loop lap
          }
          return next;
        });
      }
      lastTimeRef.current = timestamp;
      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, playbackSpeed]);

  // Current telemetry point interpolation
  const currentTelemetry = useMemo(() => {
    if (telemetryPoints.length === 0) return null;
    const maxIdx = telemetryPoints.length - 1;
    const targetIdx = Math.max(0, Math.min(maxIdx, Math.floor(progress * maxIdx)));
    return telemetryPoints[targetIdx] || null;
  }, [telemetryPoints, progress]);

  // Map coordinates & track viewbox
  const { viewBox, trackPathStr, carAPos, carBPos, trackDimensions } = useMemo(() => {
    if (!circuitGeom || circuitGeom.points.length === 0) {
      return {
        viewBox: '0 0 1000 600',
        trackPathStr: '',
        carAPos: { x: 500, y: 300 },
        carBPos: { x: 500, y: 300 },
        trackDimensions: { width: 1000, height: 600 },
      };
    }

    const pts = circuitGeom.points;
    const xs = pts.map((p) => p.x);
    const ys = pts.map((p) => p.y);

    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);

    const width = maxX - minX || 1;
    const height = maxY - minY || 1;
    const padding = Math.max(width, height) * 0.12;

    const vb = `${minX - padding} ${minY - padding} ${width + padding * 2} ${height + padding * 2}`;

    // SVG path string
    const path = pts.reduce((acc, pt, i) => `${acc} ${i === 0 ? 'M' : 'L'} ${pt.x} ${pt.y}`, '') + ' Z';

    // Sample car positions along track geometry
    // Introduce micro delta to visual position based on speed difference
    const speedA = Number(currentTelemetry?.[`speed_${driverA}`] ?? 250);
    const speedB = Number(currentTelemetry?.[`speed_${driverB}`] ?? 250);
    const deltaOffset = ((speedA - speedB) / 350) * 0.008;

    // Keep a visible gap between the two cars so both markers stay legible
    // (without it, both cars stack on the same point and one hides the other).
    const CAR_GAP = 0.012; // ~60m of track separation
    const normA = Math.max(0, Math.min(1, progress + CAR_GAP / 2));
    const normB = Math.max(0, Math.min(1, progress - CAR_GAP / 2 - deltaOffset));

    const posA = sampleCircuitPosition(circuitGeom, normA);
    const posB = sampleCircuitPosition(circuitGeom, normB);

    return {
      viewBox: vb,
      trackPathStr: path,
      carAPos: posA,
      carBPos: posB,
      trackDimensions: { width, height },
    };
  }, [circuitGeom, progress, currentTelemetry, driverA, driverB]);

  // Telemetry metrics
  const speedA = Number(currentTelemetry?.[`speed_${driverA}`] ?? 0);
  const speedB = Number(currentTelemetry?.[`speed_${driverB}`] ?? 0);
  const speedDelta = speedA - speedB;

  const throttleA = Number(currentTelemetry?.[`throttle_${driverA}`] ?? 0);
  const throttleB = Number(currentTelemetry?.[`throttle_${driverB}`] ?? 0);

  const brakeA = Number(currentTelemetry?.[`brake_${driverA}`] ?? 0);
  const brakeB = Number(currentTelemetry?.[`brake_${driverB}`] ?? 0);

  const gearA = Number(currentTelemetry?.[`gear_${driverA}`] ?? 1);
  const gearB = Number(currentTelemetry?.[`gear_${driverB}`] ?? 1);

  const drsA = Boolean(currentTelemetry?.[`drs_${driverA}`]);
  const drsB = Boolean(currentTelemetry?.[`drs_${driverB}`]);

  const colorA = getDriverColor(driverA);
  const colorB = getDriverColor(driverB);

  // Scrubber scrub handler
  const handleScrubberChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = parseFloat(e.target.value);
    setProgress(val);
  };

  const handlePreset = (pA: string, pB: string) => {
    setDriverA(pA);
    setDriverB(pB);
    setProgress(0);
    setIsPlaying(false);
  };

  const togglePlay = useCallback(() => {
    setIsPlaying((prev) => !prev);
  }, []);

  const resetReplay = useCallback(() => {
    setIsPlaying(false);
    setProgress(0);
  }, []);

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 bg-linear-to-b from-red-900/10 via-neutral-950/80 to-neutral-950 pointer-events-none" />

      <div className="relative max-w-7xl mx-auto px-4 sm:px-6 py-8">
        {/* --- Header ---------------------------------------------------- */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3">
              <Zap size={14} /> Telemetry Replay Engine
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white uppercase italic">
              Ghost <span className="text-red-500">Race</span>
            </h1>
            <p className="text-neutral-400 mt-2 text-sm max-w-xl">
              Synchronous head-to-head lap replay. Watch two drivers race each other over the exact circuit
              geometry with real-time speed, throttle, brake, and gear instrumentation.
            </p>
          </div>

          {/* Quick presets */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-[11px] font-black text-neutral-500 uppercase tracking-wider mr-1">
              Top Duels:
            </span>
            {PRESETS.map((p) => (
              <button
                key={p.label}
                type="button"
                onClick={() => handlePreset(p.a, p.b)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer ${
                  driverA === p.a && driverB === p.b
                    ? 'bg-red-600 text-white shadow-lg shadow-red-600/30'
                    : 'bg-neutral-900/80 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700'
                }`}
              >
                {p.a} vs {p.b}
              </button>
            ))}
          </div>
        </div>

        {/* --- Control Bar & Selectors ----------------------------------- */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6 bg-neutral-900/50 backdrop-blur-xl border border-white/5 rounded-2xl p-4">
          {/* Race Round Picker */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-1.5">
              Circuit / Grand Prix
            </label>
            <div className="relative">
              <select
                value={selectedRound}
                onChange={(e) => {
                  setSelectedRound(Number(e.target.value));
                  setProgress(0);
                  setIsPlaying(false);
                }}
                className="appearance-none w-full bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white cursor-pointer focus:outline-none focus:border-red-500/60"
              >
                {races.map((r) => (
                  <option key={r.round} value={r.round}>
                    R{String(r.round).padStart(2, '0')} · {r.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
              />
            </div>
          </div>

          {/* Driver A Picker */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-1.5">
              Driver 1 (Car A)
            </label>
            <div className="relative">
              <select
                value={driverA}
                onChange={(e) => {
                  setDriverA(e.target.value);
                  setProgress(0);
                }}
                className="appearance-none w-full bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white cursor-pointer focus:outline-none focus:border-red-500/60"
              >
                {availableDrivers.length > 0
                  ? availableDrivers.map((d) => (
                      <option key={d.abbreviation} value={d.abbreviation}>
                        {d.abbreviation} — {d.full_name}
                      </option>
                    ))
                  : Object.keys(DRIVER_TEAM_COLORS_2026).map((code) => (
                      <option key={code} value={code}>
                        {code} — {DRIVER_TEAM_COLORS_2026[code].team}
                      </option>
                    ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
              />
            </div>
          </div>

          {/* Driver B Picker */}
          <div>
            <label className="block text-[10px] font-black uppercase tracking-wider text-neutral-500 mb-1.5">
              Driver 2 (Car B)
            </label>
            <div className="relative">
              <select
                value={driverB}
                onChange={(e) => {
                  setDriverB(e.target.value);
                  setProgress(0);
                }}
                className="appearance-none w-full bg-neutral-950/80 border border-neutral-800 hover:border-neutral-700 rounded-xl px-4 py-2.5 text-xs font-bold text-white cursor-pointer focus:outline-none focus:border-red-500/60"
              >
                {availableDrivers.length > 0
                  ? availableDrivers.map((d) => (
                      <option key={d.abbreviation} value={d.abbreviation}>
                        {d.abbreviation} — {d.full_name}
                      </option>
                    ))
                  : Object.keys(DRIVER_TEAM_COLORS_2026).map((code) => (
                      <option key={code} value={code}>
                        {code} — {DRIVER_TEAM_COLORS_2026[code].team}
                      </option>
                    ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
              />
            </div>
          </div>
        </div>

        {/* Telemetry Status Banner */}
        <div className="flex items-center justify-between px-4 py-2.5 mb-6 rounded-xl border border-white/5 bg-neutral-900/30 text-xs">
          <div className="flex items-center gap-2">
            <Radio
              size={14}
              className={isSimulated ? 'text-amber-400 animate-pulse' : 'text-emerald-400 animate-pulse'}
            />
            <span className="font-bold text-white">
              {isSimulated ? 'Synthesized High-Fidelity Physics Duel' : 'FastF1 Official Session Telemetry'}
            </span>
            <span className="text-neutral-500 hidden sm:inline">
              · {circuitGeom?.name || activeRace?.circuit || 'Circuit'} ({telemetryPoints.length} points)
            </span>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-neutral-500">Speed:</span>
            {[0.5, 1, 2, 4].map((spd) => (
              <button
                key={spd}
                type="button"
                onClick={() => setPlaybackSpeed(spd)}
                className={`px-2 py-0.5 rounded text-[11px] font-mono font-bold cursor-pointer transition-colors ${
                  playbackSpeed === spd
                    ? 'bg-red-600 text-white'
                    : 'bg-neutral-800 text-neutral-400 hover:text-white'
                }`}
              >
                {spd}x
              </button>
            ))}
          </div>
        </div>

        {/* --- Main Arena: SVG Circuit + Twin HUDs ------------------------ */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 items-start mb-6">
          {/* Driver A Cockpit Card */}
          <div className="lg:col-span-1 bg-neutral-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            <div
              className="absolute top-0 left-0 right-0 h-1.5"
              style={{ backgroundColor: colorA }}
            />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20"
                  style={{ backgroundColor: colorA }}
                />
                <span className="text-xl font-black tracking-tight text-white font-mono">
                  {driverA}
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Ghost Car 1
              </span>
            </div>

            {/* Speed Gauge */}
            <div className="bg-neutral-950/80 rounded-xl p-4 border border-neutral-800/80 mb-4 text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 block mb-1">
                Speed
              </span>
              <div className="text-4xl font-black font-mono text-white tracking-tight">
                {speedA} <span className="text-xs font-bold text-neutral-500 uppercase">km/h</span>
              </div>
            </div>

            {/* Inputs: Throttle & Brake Bars */}
            <div className="space-y-3 mb-4">
              <div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-wider mb-1">
                  <span className="text-emerald-400">Throttle</span>
                  <span className="text-white font-mono">{throttleA}%</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-950 overflow-hidden border border-neutral-800">
                  <div
                    className="h-full bg-linear-to-r from-emerald-500 to-green-400 transition-all duration-75"
                    style={{ width: `${throttleA}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-wider mb-1">
                  <span className="text-red-400">Brake</span>
                  <span className="text-white font-mono">{brakeA}%</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-950 overflow-hidden border border-neutral-800">
                  <div
                    className="h-full bg-linear-to-r from-red-600 to-rose-400 transition-all duration-75"
                    style={{ width: `${brakeA}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Micro Badges: Gear & DRS */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-lg p-2 text-center">
                <span className="text-[9px] font-black uppercase text-neutral-500 block">Gear</span>
                <span className="text-lg font-black font-mono text-white">{gearA}</span>
              </div>
              <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-lg p-2 text-center">
                <span className="text-[9px] font-black uppercase text-neutral-500 block">DRS</span>
                <span
                  className={`text-xs font-black font-mono uppercase px-2 py-0.5 rounded ${
                    drsA ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-600'
                  }`}
                >
                  {drsA ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
            </div>
          </div>

          {/* Circuit Canvas (Centre, Span 2) */}
          <div className="lg:col-span-2 bg-neutral-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-4 shadow-2xl relative flex flex-col items-center">
            {/* Speed Delta Badge */}
            <div className="absolute top-4 left-4 z-10 flex items-center gap-2 bg-neutral-950/80 border border-neutral-800 backdrop-blur-md px-3 py-1.5 rounded-xl shadow-lg">
              <Gauge size={14} className="text-neutral-400" />
              <span className="text-[11px] font-bold text-neutral-400">Delta:</span>
              <span
                className={`text-xs font-black font-mono ${
                  speedDelta > 0
                    ? 'text-emerald-400'
                    : speedDelta < 0
                    ? 'text-rose-400'
                    : 'text-neutral-400'
                }`}
              >
                {speedDelta > 0 ? `+${speedDelta}` : speedDelta} km/h
              </span>
            </div>

            {/* Distance ticker */}
            <div className="absolute top-4 right-4 z-10 text-[11px] font-mono text-neutral-400 bg-neutral-950/80 border border-neutral-800 px-3 py-1.5 rounded-xl">
              Lap {Math.round(progress * 100)}% · {currentTelemetry?.distance ?? 0}m
            </div>

            {/* SVG Track View */}
            <div className="w-full aspect-4/3 flex items-center justify-center p-2">
              <svg
                viewBox={viewBox}
                className="w-full h-full max-h-[460px] overflow-visible"
              >
                {/* Ambient glow behind circuit */}
                <path
                  d={trackPathStr}
                  fill="none"
                  stroke="rgba(255,255,255,0.04)"
                  strokeWidth={trackDimensions.width * 0.04}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Track Base Asphalt Line */}
                <path
                  d={trackPathStr}
                  fill="none"
                  stroke="#1c1f26"
                  strokeWidth={Math.max(12, trackDimensions.width * 0.018)}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />

                {/* Inner Racing Kerb Guide */}
                <path
                  d={trackPathStr}
                  fill="none"
                  stroke="#ffffff"
                  strokeWidth={Math.max(1.5, trackDimensions.width * 0.002)}
                  strokeDasharray="4 8"
                  opacity={0.3}
                />

                {/* Ghost Car B (Secondary) */}
                <g transform={`translate(${carBPos.x}, ${carBPos.y})`}>
                  {/* Outer pulse */}
                  <circle
                    r={Math.max(14, trackDimensions.width * 0.024)}
                    fill={colorB}
                    opacity={0.25}
                    className="animate-pulse"
                  />
                  {/* Solid core */}
                  <circle
                    r={Math.max(7, trackDimensions.width * 0.012)}
                    fill={colorB}
                    stroke="#ffffff"
                    strokeWidth={Math.max(1.5, trackDimensions.width * 0.002)}
                  />
                  {/* Label */}
                  <text
                    y={-Math.max(12, trackDimensions.width * 0.02)}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={Math.max(10, trackDimensions.width * 0.016)}
                    fontWeight="900"
                    fontFamily="monospace"
                    className="pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                  >
                    {driverB}
                  </text>
                </g>

                {/* Ghost Car A (Primary) */}
                <g transform={`translate(${carAPos.x}, ${carAPos.y})`}>
                  {/* Outer pulse */}
                  <circle
                    r={Math.max(16, trackDimensions.width * 0.026)}
                    fill={colorA}
                    opacity={0.35}
                    className="animate-pulse"
                  />
                  {/* Solid core */}
                  <circle
                    r={Math.max(8, trackDimensions.width * 0.013)}
                    fill={colorA}
                    stroke="#ffffff"
                    strokeWidth={Math.max(1.5, trackDimensions.width * 0.002)}
                  />
                  {/* Label */}
                  <text
                    y={-Math.max(14, trackDimensions.width * 0.022)}
                    textAnchor="middle"
                    fill="#ffffff"
                    fontSize={Math.max(11, trackDimensions.width * 0.017)}
                    fontWeight="900"
                    fontFamily="monospace"
                    className="pointer-events-none drop-shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                  >
                    {driverA}
                  </text>
                </g>
              </svg>
            </div>
          </div>

          {/* Driver B Cockpit Card */}
          <div className="lg:col-span-1 bg-neutral-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl relative overflow-hidden">
            <div
              className="absolute top-0 left-0 right-0 h-1.5"
              style={{ backgroundColor: colorB }}
            />
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <span
                  className="w-3.5 h-3.5 rounded-full ring-2 ring-white/20"
                  style={{ backgroundColor: colorB }}
                />
                <span className="text-xl font-black tracking-tight text-white font-mono">
                  {driverB}
                </span>
              </div>
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-400">
                Ghost Car 2
              </span>
            </div>

            {/* Speed Gauge */}
            <div className="bg-neutral-950/80 rounded-xl p-4 border border-neutral-800/80 mb-4 text-center">
              <span className="text-[10px] font-black uppercase tracking-widest text-neutral-500 block mb-1">
                Speed
              </span>
              <div className="text-4xl font-black font-mono text-white tracking-tight">
                {speedB} <span className="text-xs font-bold text-neutral-500 uppercase">km/h</span>
              </div>
            </div>

            {/* Inputs: Throttle & Brake Bars */}
            <div className="space-y-3 mb-4">
              <div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-wider mb-1">
                  <span className="text-emerald-400">Throttle</span>
                  <span className="text-white font-mono">{throttleB}%</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-950 overflow-hidden border border-neutral-800">
                  <div
                    className="h-full bg-linear-to-r from-emerald-500 to-green-400 transition-all duration-75"
                    style={{ width: `${throttleB}%` }}
                  />
                </div>
              </div>

              <div>
                <div className="flex justify-between text-[10px] font-black uppercase tracking-wider mb-1">
                  <span className="text-red-400">Brake</span>
                  <span className="text-white font-mono">{brakeB}%</span>
                </div>
                <div className="h-2 rounded-full bg-neutral-950 overflow-hidden border border-neutral-800">
                  <div
                    className="h-full bg-linear-to-r from-red-600 to-rose-400 transition-all duration-75"
                    style={{ width: `${brakeB}%` }}
                  />
                </div>
              </div>
            </div>

            {/* Micro Badges: Gear & DRS */}
            <div className="grid grid-cols-2 gap-2">
              <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-lg p-2 text-center">
                <span className="text-[9px] font-black uppercase text-neutral-500 block">Gear</span>
                <span className="text-lg font-black font-mono text-white">{gearB}</span>
              </div>
              <div className="bg-neutral-950/80 border border-neutral-800/80 rounded-lg p-2 text-center">
                <span className="text-[9px] font-black uppercase text-neutral-500 block">DRS</span>
                <span
                  className={`text-xs font-black font-mono uppercase px-2 py-0.5 rounded ${
                    drsB ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'text-neutral-600'
                  }`}
                >
                  {drsB ? 'ACTIVE' : 'OFF'}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* --- Replay Scrubber & Playback Controls ----------------------- */}
        <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/5 rounded-2xl p-5 shadow-2xl">
          {/* Scrubber slider */}
          <div className="mb-4">
            <div className="flex justify-between items-center text-xs font-mono font-bold text-neutral-400 mb-2">
              <span>LAP START</span>
              <span className="text-white">SECTOR {progress < 0.33 ? '1' : progress < 0.66 ? '2' : '3'}</span>
              <span>CHECKERED FLAG</span>
            </div>
            <input
              type="range"
              min={0}
              max={1}
              step={0.001}
              value={progress}
              onChange={handleScrubberChange}
              className="w-full h-2.5 bg-neutral-950 rounded-lg appearance-none cursor-pointer accent-red-600 border border-neutral-800 focus:outline-none"
            />
          </div>

          {/* Playback Buttons */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={togglePlay}
                className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-bold text-sm bg-red-600 text-white hover:bg-red-500 shadow-lg shadow-red-600/30 transition-all cursor-pointer"
              >
                {isPlaying ? <Pause size={16} /> : <Play size={16} fill="currentColor" />}
                {isPlaying ? 'Pause Replay' : 'Play Ghost Lap'}
              </button>

              <button
                type="button"
                onClick={resetReplay}
                className="inline-flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl text-xs font-bold bg-neutral-950/80 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors cursor-pointer"
              >
                <RotateCcw size={14} /> Reset
              </button>
            </div>

            <div className="text-xs text-neutral-500 flex items-center gap-2">
              <Sliders size={14} />
              <span>Drag the scrubber slider anytime to inspect corner apexes</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default GhostRacePage;
