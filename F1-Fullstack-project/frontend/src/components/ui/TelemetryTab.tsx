// src/TelemetryTab
import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { 
  Activity, RefreshCw, AlertTriangle, Zap, 
  Radio, Flag, ChevronLeft, ChevronRight, Crosshair
} from 'lucide-react';
import { teamColors, teamLogos, DRIVER_TEAM_COLORS_2026, getTeamColor, getDriverColor } from '../../data/teamData';

import TrackDominationMap from './TrackDominationMap';
import SpeedChart from '../dashboard/SpeedChart';
import ThrottleChart from '../dashboard/ThrottleChart';
import TimeDeltaChart from '../dashboard/TimeDeltaChart';
import { TelemetryResponse } from '../../types/f1';

/** One entry of the `/api/telemetry-drivers/{year}/{round}` response. */
interface TelemetryDriverOption {
  abbreviation: string;
  full_name?: string;
  team_name?: string;
  /** Official race status from FastF1 results ("Lapped", "Did not start", ...). */
  status?: string;
}

/** Drivers classified as non-starters can never have lap telemetry. */
const isDidNotStart = (status?: string): boolean =>
  typeof status === 'string' && status.toLowerCase().includes('did not start');

/** Generate visually distinct colors for teammates using HSL color space rotation */
const generateTeammateColors = (baseColor: string, teamSize: number): string[] => {
  // Convert hex to RGB
  const hex = baseColor.replace(/^#/, '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Convert RGB to HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  const colors: string[] = [];

  for (let i = 0; i < teamSize; i++) {
    let newH = h;
    let newS = s;
    let newL = l;

    if (i === 0) {
      // First driver: base color
      colors.push(baseColor);
    } else if (i === 1) {
      // Second driver: darker and slightly shifted hue
      newL = Math.max(0.2, l - 0.25);
      newH = (h + 0.05) % 1;
      colors.push(hslToHex(newH, newS, newL));
    } else if (i === 2) {
      // Third driver: lighter and shifted hue opposite direction
      newL = Math.min(0.8, l + 0.15);
      newS = Math.min(1, s + 0.2);
      newH = (h - 0.05 + 1) % 1;
      colors.push(hslToHex(newH, newS, newL));
    }
  }

  return colors;
};

/** Convert HSL to Hex */
const hslToHex = (h: number, s: number, l: number): string => {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const LapRuler = ({ lap, setLap }: { lap: string; setLap: (lap: string) => void }) => {
  const currentLap = lap ? parseInt(lap, 10) : null;

  const handleLapClick = (l: number) => setLap(l.toString());
  const setFastest = () => setLap('');

  const getVisibleLaps = () => {
    if (!currentLap) return [1, 2, 3, 4, 5];
    const start = Math.max(1, currentLap - 2);
    return Array.from({ length: 5 }, (_, i) => start + i);
  };

  const visibleLaps = getVisibleLaps();

  return (
    <div className="bg-linear-to-b from-neutral-900 to-neutral-950 border border-neutral-800 rounded-lg p-4 flex flex-col items-center relative overflow-hidden shadow-2xl w-full md:w-72 shrink-0">
      <div className="absolute top-0 w-3/4 h-1 bg-linear-to-r from-transparent via-red-600 to-transparent"></div>
      
      <div className="text-[11px] text-neutral-500 font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        <Crosshair size={12} className="text-red-500" /> Lap Selector
      </div>
      
      <div className="flex items-center justify-between w-full mb-5 px-2 h-16">
        <button 
          onClick={() => { if(currentLap && currentLap > 1) setLap((currentLap - 1).toString()) }}
          className="text-neutral-600 hover:text-white transition-colors p-1"
        >
          <ChevronLeft size={24} />
        </button>
        
        <div className="flex-1 flex justify-center items-center gap-3">
          {!currentLap ? (
            <div className="text-2xl font-black tracking-widest text-chalk">
              FASTEST
            </div>
          ) : (
            <div className="flex items-end gap-3">
              {visibleLaps.map(l => {
                const isActive = l === currentLap;
                return (
                  <div 
                    key={l}
                    onClick={() => handleLapClick(l)}
                    className={`flex flex-col items-center cursor-pointer transition-ui duration-300 ${
                      isActive ? 'scale-125 mx-2' : 'opacity-40 hover:opacity-100'
                    }`}
                  >
                    <div className={`text-[11px] mb-1.5 font-mono ${isActive ? 'text-red-400 font-black' : 'text-neutral-400 font-bold'}`}>
                      {l}
                    </div>
                    <div className={`w-1 rounded-full transition-[height,background-color,box-shadow] ${isActive ? 'h-8 bg-red-500 ' : 'h-3 bg-neutral-600'}`}></div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        <button 
          onClick={() => {
             const next = currentLap ? currentLap + 1 : 1;
             setLap(next.toString());
          }}
          className="text-neutral-600 hover:text-white transition-colors p-1"
        >
          <ChevronRight size={24} />
        </button>
      </div>

      <div className="flex bg-neutral-950 border border-neutral-800 rounded-lg overflow-hidden p-1 w-full max-w-[200px]">
        <button 
          onClick={setFastest}
          className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-ui ${!currentLap ? 'bg-neutral-800 text-white shadow-md' : 'text-neutral-500 hover:text-white hover:bg-neutral-900'}`}
        >
          FASTEST
        </button>
        <button 
          onClick={() => { if(!currentLap) setLap('1') }}
          className={`flex-1 py-1.5 text-[11px] font-bold rounded-md transition-ui ${currentLap ? 'bg-neutral-800 text-white shadow-md' : 'text-neutral-500 hover:text-white hover:bg-neutral-900'}`}
        >
          MANUAL
        </button>
      </div>
    </div>
  );
};

interface TelemetryTabProps {
  year: string | number;
  round: string | number;
  raceInfo?: {
    location?: string;
    country?: string;
    name?: string;
  } | null;
}

const TelemetryTab = ({ year, round, raceInfo }: TelemetryTabProps) => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<TelemetryDriverOption[]>([]);
  const [lap, setLap] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [telemetryData, setTelemetryData] = useState<TelemetryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<{ driver: string; reason: string }[] | null>(null);

  const defaultDrivers = [
    'VER', 'HAD', 'NOR', 'PIA', 'LEC', 'HAM', 'RUS', 'ANT', 'ALO', 'STR',
    'ALB', 'SAI', 'GAS', 'COL', 'LAW', 'LIN', 'HUL', 'BOR', 'OCO', 'BEA',
    'PER', 'BOT'
  ];

  useEffect(() => {
    if (!round || !year) return;
    let isMounted = true;
    const controller = new AbortController();
    fetch(`${API_URL}/api/telemetry-drivers/${year}/${round}`, { signal: controller.signal })
      .then(res => res.json())
      .then(data => {
        if (!isMounted) return;
        if (Array.isArray(data) && data.length > 0) {
          setAvailableDrivers(data);
          setSelectedDrivers([]); // No drivers selected initially
        } else {
          setAvailableDrivers(defaultDrivers.map(d => ({ abbreviation: d, full_name: d, team_name: '' })));
        }
      })
      .catch((err) => {
        if (!isMounted || err?.name === 'AbortError') return;
        setAvailableDrivers(defaultDrivers.map(d => ({ abbreviation: d, full_name: d, team_name: '' })));
      });
    return () => {
      isMounted = false;
      controller.abort();
    };
  }, [year, round]);

  const toggleDriver = (drv: string) => {
    if (selectedDrivers.includes(drv)) {
      setSelectedDrivers(selectedDrivers.filter(d => d !== drv));
    } else {
      if (selectedDrivers.length >= 10) {
        alert("Maximum 10 drivers can be compared at once.");
        return;
      }
      setSelectedDrivers([...selectedDrivers, drv]);
    }
  };

  const fetchIdRef = React.useRef(0);

  const fetchTelemetry = async () => {
    if (!round || !year || selectedDrivers.length === 0) return;
    const fetchId = ++fetchIdRef.current;
    
    setLoading(true);
    setError(null);
    setWarning(null);
    try {
      const lapQuery = lap ? `&lap=${lap}` : '';
      const url = `${API_URL}/api/telemetry/${year}/${round}?drivers=${selectedDrivers.join(',')}${lapQuery}`;
      const res = await fetch(url);
      
      let data: TelemetryResponse | undefined;
      let rawText = '';
      try {
        rawText = await res.text();
        data = JSON.parse(rawText) as TelemetryResponse;
      } catch {
        throw new Error(`Invalid JSON response from backend: ${rawText.slice(0, 200)}`);
      }

      if (fetchId !== fetchIdRef.current) return;

      if (!res.ok) {
        throw new Error(data?.detail || data?.error || rawText || "Failed to fetch telemetry data.");
      }
      if (data?.error) throw new Error(data.error);

      // The endpoint answers with several partial shapes: a payload with no
      // `drivers`/`driver_info`/`telemetry` keys at all (just the unavailable
      // reasons), the "no drivers selected" envelope, and the full one. Keep
      // only the fields the render code actually reads, defaulted, so no
      // render path can trip over a missing key.
      const normalized = {
        ...data,
        drivers: Array.isArray(data?.drivers) ? data.drivers : [],
        driver_info: data?.driver_info ?? {},
        telemetry: Array.isArray(data?.telemetry) ? data.telemetry : [],
        unavailable_drivers: Array.isArray(data?.unavailable_drivers) ? data.unavailable_drivers : [],
        unavailable_reasons: data?.unavailable_reasons ?? {},
      } as TelemetryResponse & Required<Pick<TelemetryResponse, 'drivers' | 'driver_info' | 'telemetry' | 'unavailable_drivers' | 'unavailable_reasons'>>;
      setTelemetryData(normalized);
      if (normalized.unavailable_drivers.length) {
        setWarning(
          normalized.unavailable_drivers.map((drv: string) => ({
            driver: drv,
            reason: normalized.unavailable_reasons[drv] || 'No data available',
          })),
        );
      }
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      console.error("API Error:", err);
      setTelemetryData(null);
      setError(err instanceof Error && err.message === "Failed to fetch" ? "Network Error: Failed to connect to backend (check CORS or if backend is running)." : err instanceof Error ? err.message : String(err));
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  };

  const [activeDistance, setActiveDistance] = useState<number | null>(null);

  // Removed auto-fetch useEffect to prevent heavy requests on every click

  const handleExportPNG = async () => {
    const el = document.getElementById('telemetry-card');
    if (!el) return;
    try {
      const html2canvas = (await import('html2canvas')).default;
      const canvas = await html2canvas(el, { backgroundColor: '#0a0a0a', scale: 2 });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `Telemetry_Multidriver.png`;
      link.click();
    } catch (err) {
      console.error('Export failed', err);
    }
  };

  const statusByDriver = new Map(availableDrivers.map(d => [d.abbreviation, d.status]));
  const selectedWithoutData = selectedDrivers.filter(d => isDidNotStart(statusByDriver.get(d)));
  const emptyStateMessage =
    telemetryData && typeof telemetryData.message === 'string' && telemetryData.message
      ? telemetryData.message
      : null;

  // When every requested driver failed for the same reason, that reason is a
  // property of the session (e.g. "F1's archive has no lap data for this
  // race"), not of each driver. Repeating it per driver buries the answer.
  const unavailableDrivers = telemetryData?.unavailable_drivers ?? [];
  const unavailableReasonList = unavailableDrivers.map(
    (drv) => telemetryData?.unavailable_reasons?.[drv] || 'No data available'
  );
  const sharedUnavailableReason =
    unavailableReasonList.length > 0 && new Set(unavailableReasonList).size === 1
      ? unavailableReasonList[0]
      : null;

  return (
    <div className="p-6">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-2">
            <Activity size={14} /> Telemetry Pro
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
            Lap Telemetry <span className=" text-chalk">Analysis</span>
          </h1>
          <p className="text-neutral-400 mt-2 text-sm">
            Synchronized throttle, braking, corner speed, and delta time comparison for up to 10 drivers.
          </p>
        </div>
      </div>

      <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-lg p-6 shadow-2xl mb-8 flex flex-col xl:flex-row gap-6 items-stretch">
        
        {/* Drivers Box */}
        <div className="flex-1 min-w-0 bg-linear-to-b from-neutral-900 to-neutral-950 border border-neutral-800 rounded-lg p-4 relative overflow-hidden shadow-2xl flex flex-col">
          <div className="absolute top-0 w-3/4 left-0 h-1 bg-linear-to-r from-transparent via-blue-600 to-transparent"></div>
          
          <div className="text-[11px] text-neutral-500 font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <Radio size={12} className="text-blue-500" /> Select Drivers (Max 10)
          </div>

          <div className="flex-1 flex flex-wrap gap-2 overflow-y-auto content-start">
            {availableDrivers.map(d => {
              const isSelected = selectedDrivers.includes(d.abbreviation);
              const isDisabled = !isSelected && selectedDrivers.length >= 10;
              const color = getDriverColor(d.abbreviation, d.team_name);
              return (
                <button
                  key={d.abbreviation}
                  onClick={() => toggleDriver(d.abbreviation)}
                  disabled={isDisabled}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-ui flex items-center gap-1.5 border ${
                    isSelected 
                      ? 'bg-neutral-800 text-white border-neutral-500 shadow-md' 
                      : isDisabled
                        ? 'bg-transparent text-neutral-700 border-neutral-800/50 opacity-30 cursor-not-allowed'
                        : 'bg-transparent text-neutral-500 border-neutral-800 opacity-60 hover:opacity-100 hover:bg-neutral-900'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {d.abbreviation}
                  {isDidNotStart(d.status) && (
                    <span
                      className="ml-0.5 px-1 py-px rounded-sm text-[11px] leading-none font-black bg-amber-500/20 text-amber-400 border border-amber-500/40"
                      title="Did not start - no telemetry available for this driver"
                    >
                      DNS
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* Selection hint: warn when a selected driver has no telemetry (DNS).
              Kept inside the drivers card — as a direct child of the
              xl:flex-row section it became an auto-width column that squeezed
              the driver grid into a sliver. */}
          {selectedDrivers.length > 0 && !telemetryData && (
            <div className="mt-3 p-2 rounded-lg bg-amber-950/30 border border-amber-500/30 flex items-start gap-2 text-xs font-bold text-amber-400">
              <AlertTriangle size={14} className="shrink-0 mt-0.5" />
              <div className="space-y-0.5">
                <span className="block">{selectedDrivers.length} driver dipilih — klik <b>Run Analysis</b> untuk memuat telemetry.</span>
                {selectedWithoutData.length > 0 && (
                  <span className="block text-amber-300/90">
                    Tanpa data: {selectedWithoutData.join(', ')} — did not start (tidak ada lap telemetry).
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <LapRuler lap={lap} setLap={setLap} />

        <div className="flex flex-col justify-end shrink-0">
          <button 
            onClick={fetchTelemetry}
            disabled={loading || selectedDrivers.length === 0}
            className="w-full xl:w-auto bg-linear-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold px-8 rounded-lg transition-ui shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 disabled:opacity-50 text-sm h-[48px] xl:h-full xl:min-h-[140px]"
          >
            <div className="flex xl:flex-col items-center gap-2">
              {loading ? <RefreshCw className="animate-spin" size={24} /> : <Zap size={24} />}
              <span>{loading ? 'Analyzing…' : 'Run Analysis'}</span>
            </div>
          </button>
        </div>
      </section>

      {error && (
        <div className="bg-red-950/40 border border-red-500/50 text-red-400 p-5 rounded-lg mb-8 flex items-center gap-3">
          <AlertTriangle size={24} className="shrink-0" />
          <span className="font-semibold text-sm">{error}</span>
        </div>
      )}

      {warning && warning.length > 0 && !error && telemetryData && telemetryData.drivers.length > 0 && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-lg p-4 mb-6 flex items-start gap-3">
          <AlertTriangle size={20} className="shrink-0 mt-0.5" />
          <div className="text-sm">
            <p className="font-bold">Tanpa data telemetry:</p>
            <ul className="mt-1 space-y-0.5 font-medium">
              {warning.map(w => (
                <li key={w.driver}>{w.driver}: {w.reason}</li>
              ))}
            </ul>
          </div>
        </div>
      )}

      {loading && !telemetryData && (
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-lg p-16 flex flex-col items-center justify-center min-h-[40vh] mb-8">
          <RefreshCw className="animate-spin text-red-500 mb-4" size={44} />
          <h3 className="text-xl font-bold text-white">Extracting Multi-Driver Telemetry…</h3>
          <p className="text-xs text-neutral-500 mt-2">Aligning GPS distance & channels for {selectedDrivers.length} drivers</p>
        </div>
      )}

      {/* A payload with no selected drivers still carries a `message`; show it
          instead of rendering an empty card with nothing to read. When instead
          every requested driver failed, list each one with its own reason. */}
      {telemetryData && telemetryData.drivers.length === 0 && (
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-lg p-10 mb-8 text-center">
          <Radio className="mx-auto text-neutral-600 mb-3" size={32} />
          <p className="text-sm font-semibold text-neutral-300">
            {emptyStateMessage ??
              sharedUnavailableReason ??
              (telemetryData.unavailable_drivers?.length
                ? 'Tidak ada data telemetry untuk driver berikut:'
                : 'Tidak ada data telemetry tersedia untuk ronde yang dipilih.')}
          </p>
          {sharedUnavailableReason && unavailableDrivers.length > 0 && (
            <p className="mt-2 text-xs font-medium text-neutral-500">
              Driver: {unavailableDrivers.join(', ')}
            </p>
          )}
          {!emptyStateMessage && !sharedUnavailableReason && telemetryData.unavailable_drivers && telemetryData.unavailable_drivers.length > 0 && (
            <ul className="mt-3 space-y-1 text-xs font-medium text-amber-300/90">
              {telemetryData.unavailable_drivers.map((drv: string) => (
                <li key={drv}>
                  {drv}: {telemetryData.unavailable_reasons?.[drv] || 'No data available'}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {telemetryData && telemetryData.drivers.length > 0 && (
        <div className={`space-y-8 transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none blur-[2px]' : 'opacity-100'}`}>
          <div className="flex justify-between items-center">
            {loading && (
              <div className="flex items-center gap-2 text-red-500 font-bold bg-red-500/10 px-4 py-2 rounded-full motion-safe:animate-pulse">
                <RefreshCw className="animate-spin" size={16} /> Fetching {selectedDrivers.length} Drivers Telemetry…
              </div>
            )}
            <div className="flex-1 flex justify-end">
              <button 
                onClick={handleExportPNG}
                className="bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-bold py-2 px-4 rounded-md transition-ui shadow-md hover:shadow-lg border border-neutral-700 flex items-center gap-2"
              >
                Export Social Card (PNG)
              </button>
            </div>
          </div>

          <div id="telemetry-card" className="space-y-8 p-6 bg-neutral-950/90 rounded-lg">

            
            {/* Track Domination Map */}
            <TrackDominationMap 
              telemetry={telemetryData.telemetry} 
              drivers={telemetryData.drivers} 
              driver_info={telemetryData.driver_info} 
              activeDistance={activeDistance}
              circuitInfo={{
                round,
                country: raceInfo?.country,
                location: raceInfo?.location,
                name: raceInfo?.name,
              }}
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {telemetryData.drivers.map(drv => {
                const info = telemetryData.driver_info[drv];
                if (!info) return null;
                const teamCol = teamColors[info.team] || '#fff';
                const logo = teamLogos[info.team];
                
                return (
                  <div key={drv} className="bg-linear-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-lg p-5 shadow-xl relative overflow-hidden group" style={{ borderTopWidth: '4px', borderTopColor: teamCol }}>
                    <div className="absolute -right-4 -bottom-6 text-7xl font-black opacity-5 pointer-events-none font-mono" style={{ color: teamCol }}>
                      {drv}
                    </div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-2xl font-black text-white">{drv}</h4>
                        <p className="text-xs text-neutral-400 font-bold">{info.name}</p>
                      </div>
                      {logo && (
                        <img
                          src={logo}
                          alt={info.team}
                          className={`h-6 object-contain drop-shadow-md ${/audi/i.test(info.team || '') ? 'brightness-0 invert' : ''}`}
                        />
                      )}
                    </div>
                    
                    <div className="space-y-3 relative z-10">
                      <div className="bg-neutral-900/80 p-3 rounded-md border border-neutral-800/50">
                        <div className="text-[11px] text-neutral-500 font-bold uppercase mb-1 flex items-center gap-1"><Flag size={12}/> Lap Time</div>
                        <div className="font-mono text-lg font-bold text-white tabular-nums">{info.lap_time || 'N/A'}</div>
                        <div className="text-[11px] font-bold mt-1 uppercase" style={{color: info.compound === 'SOFT' ? '#FF3333' : info.compound === 'MEDIUM' ? '#EAEA00' : info.compound === 'HARD' ? '#FFFFFF' : info.compound === 'INTERMEDIATE' ? '#22C55E' : info.compound === 'WET' ? '#3B82F6' : '#888888'}}>
                          {info.compound} TYRE
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-neutral-900/80 p-2 rounded-md border border-neutral-800/50">
                          <div className="text-[11px] text-neutral-500 font-bold uppercase mb-1">Top Speed</div>
                          <div className="font-mono text-sm font-bold text-white tabular-nums">{info.max_speed} <span className="text-[11px] text-neutral-500">km/h</span></div>
                        </div>
                        <div className="bg-neutral-900/80 p-2 rounded-md border border-neutral-800/50">
                          <div className="text-[11px] text-neutral-500 font-bold uppercase mb-1">Avg Speed</div>
                          <div className="font-mono text-sm font-bold text-white tabular-nums">{info.avg_speed} <span className="text-[11px] text-neutral-500">km/h</span></div>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Custom Tooltip */}
            {(() => {
              const driverStyles: Record<string, { color: string; strokeDasharray?: string }> = {};
              const teamCounts: Record<string, number> = {};
              const teamDrivers: Record<string, string[]> = {};

              // First pass: group drivers by team
              telemetryData.drivers.forEach(drv => {
                const team = telemetryData.driver_info[drv]?.team || '';
                if (!teamDrivers[team]) {
                  teamDrivers[team] = [];
                }
                teamDrivers[team].push(drv);
              });

              // Second pass: assign colors with smart differentiation
              telemetryData.drivers.forEach(drv => {
                const team = telemetryData.driver_info[drv]?.team || '';
                if (!teamCounts[team]) teamCounts[team] = 0;

                const index = teamCounts[team];
                const teamSize = teamDrivers[team]?.length || 1;
                teamCounts[team]++;

                const drvConfig = DRIVER_TEAM_COLORS_2026[drv];
                let color = drvConfig?.primary ?? getTeamColor(team);
                let strokeDasharray: string | undefined = undefined;

                if (teamSize > 1) {
                  if (drvConfig?.isTeammate2 || index > 0) {
                    color = drvConfig?.secondary ?? generateTeammateColors(color, teamSize)[index] ?? color;
                    strokeDasharray = index === 1 ? "5 5" : "3 3";
                  }
                }

                driverStyles[drv] = {
                  color,
                  strokeDasharray
                };
              });

              return (
                <div className="space-y-6">
                  <SpeedChart
                    data={telemetryData.telemetry}
                    drivers={telemetryData.drivers}
                    driverStyles={driverStyles}
                    setActiveDistance={setActiveDistance}
                    activeDistance={activeDistance}
                  />
                  <ThrottleChart
                    data={telemetryData.telemetry}
                    drivers={telemetryData.drivers}
                    driverStyles={driverStyles}
                    setActiveDistance={setActiveDistance}
                    activeDistance={activeDistance}
                  />
                  <TimeDeltaChart
                    data={telemetryData.telemetry}
                    drivers={telemetryData.drivers}
                    driverStyles={driverStyles}
                    setActiveDistance={setActiveDistance}
                    activeDistance={activeDistance}
                  />
                </div>
              );
            })()}

          </div>
        </div>
      )}
    </div>
  );
};

export default TelemetryTab;
