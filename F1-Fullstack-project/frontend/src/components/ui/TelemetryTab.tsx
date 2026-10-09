// src/TelemetryTab.jsx
import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { 
  Activity, RefreshCw, AlertTriangle, Zap, GitCommitVertical, 
  Gauge, TrendingUp, Radio, Compass, Flag, Award, ChevronLeft, ChevronRight, Crosshair
} from 'lucide-react';
import html2canvas from 'html2canvas';
import { teamColors, teamLogos } from '../../data/teamData';

import TrackDominationMap from './TrackDominationMap';
import SpeedChart from '../dashboard/SpeedChart';
import ThrottleChart from '../dashboard/ThrottleChart';
import TimeDeltaChart from '../dashboard/TimeDeltaChart';
import { TelemetryResponse } from '../../types/f1';

const TelemetryTab = ({ year, round }: { year: string | number; round: string | number }) => {
  const [selectedDrivers, setSelectedDrivers] = useState<string[]>([]);
  const [availableDrivers, setAvailableDrivers] = useState<Record<string, unknown>[]>([]);
  const [lap, setLap] = useState<string>('');
  
  const [loading, setLoading] = useState<boolean>(false);
  const [telemetryData, setTelemetryData] = useState<TelemetryResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);

  const defaultDrivers = [
    'VER', 'NOR', 'LEC', 'HAM', 'RUS', 'PIA', 'SAI', 'PER', 'ALO', 'STR',
    'GAS', 'OCO', 'ALB', 'TSU', 'HUL', 'BOT', 'ANT', 'BEA', 'COL', 'LAW'
  ];

  useEffect(() => {
    if (!round || !year) return;
    fetch(`${API_URL}/api/telemetry-drivers/${year}/${round}`)
      .then(res => res.json())
      .then(data => {
        if (Array.isArray(data) && data.length > 0) {
          setAvailableDrivers(data);
          setSelectedDrivers([]); // No drivers selected initially
        } else {
          setAvailableDrivers(defaultDrivers.map(d => ({ abbreviation: d, full_name: d, team_name: '' })));
        }
      })
      .catch(() => {
        setAvailableDrivers(defaultDrivers.map(d => ({ abbreviation: d, full_name: d, team_name: '' })));
      });
  }, [year, round]);

  const toggleDriver = (drv) => {
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
      
      let data;
      let rawText = '';
      try {
        rawText = await res.text();
        data = JSON.parse(rawText);
      } catch {
        // Fallback handled below
      }

      if (fetchId !== fetchIdRef.current) return;

      if (!res.ok) {
        throw new Error(data?.detail || data?.error || rawText || "Failed to fetch telemetry data.");
      }
      if (data?.error) throw new Error(data.error);
      
      setTelemetryData(data);
      if (data.unavailable_drivers?.length) {
        const warningParts = data.unavailable_drivers.map((drv) => {
          const reason = data.unavailable_reasons?.[drv] || 'No data available';
          return `${drv}: ${reason}`;
        });
        setWarning(warningParts.join(' | '));
      }
    } catch (err) {
      if (fetchId !== fetchIdRef.current) return;
      console.error("API Error:", err);
      setTelemetryData(null);
      setError(err.message === "Failed to fetch" ? "Network Error: Failed to connect to backend (check CORS or if backend is running)." : err.message);
    } finally {
      if (fetchId === fetchIdRef.current) {
        setLoading(false);
      }
    }
  };

  const [activeDistance, setActiveDistance] = useState(null);

  // Removed auto-fetch useEffect to prevent heavy requests on every click

  const handleExportPNG = async () => {
    const el = document.getElementById('telemetry-card');
    if (!el) return;
    try {
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

  return (
    <div className="p-6">
      <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-2">
            <Activity size={14} /> Telemetry Pro
          </div>
          <h1 className="text-3xl md:text-4xl font-black tracking-tight text-white flex items-center gap-3">
            Lap Telemetry <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Analysis</span>
          </h1>
          <p className="text-neutral-400 mt-2 text-sm">
            Synchronized throttle, braking, corner speed, and delta time comparison for up to 10 drivers.
          </p>
        </div>
      </div>

      <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 shadow-2xl mb-8 flex flex-col xl:flex-row gap-6 items-stretch">
        
        {/* Drivers Box */}
        <div className="flex-1 bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-4 relative overflow-hidden shadow-2xl flex flex-col">
          <div className="absolute top-0 w-3/4 left-0 h-1 bg-gradient-to-r from-transparent via-blue-600 to-transparent"></div>
          
          <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
            <Radio size={12} className="text-blue-500" /> Select Drivers (Max 10)
          </div>

          <div className="flex-1 flex flex-wrap gap-2 overflow-y-auto content-start">
            {availableDrivers.map(d => {
              const isSelected = selectedDrivers.includes(d.abbreviation);
              const isDisabled = !isSelected && selectedDrivers.length >= 10;
              const color = teamColors[d.team_name] || '#888888';
              return (
                <button
                  key={d.abbreviation}
                  onClick={() => toggleDriver(d.abbreviation)}
                  disabled={isDisabled}
                  className={`px-3 py-1.5 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                    isSelected 
                      ? 'bg-neutral-800 text-white border-neutral-500 shadow-md' 
                      : isDisabled
                        ? 'bg-transparent text-neutral-700 border-neutral-800/50 opacity-30 cursor-not-allowed'
                        : 'bg-transparent text-neutral-500 border-neutral-800 opacity-60 hover:opacity-100 hover:bg-neutral-900'
                  }`}
                >
                  <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: color }} />
                  {d.abbreviation}
                </button>
              );
            })}
          </div>
        </div>

        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold text-neutral-400 uppercase tracking-widest flex items-center gap-1.5"><Flag size={12}/> Lap Number</label>
          <input
            type="number"
            value={lap}
            onChange={(e) => setLap(e.target.value)}
            placeholder="e.g. 15"
            className="bg-neutral-900 border border-neutral-700 text-white rounded-xl px-4 py-3 focus:outline-none focus:border-red-500 font-mono text-lg transition-colors w-full h-[48px]"
          />
        </div>

        <div className="flex flex-col justify-end">
          <button 
            onClick={fetchTelemetry}
            disabled={loading || selectedDrivers.length === 0}
            className="w-full xl:w-auto bg-gradient-to-r from-red-600 to-red-700 hover:from-red-500 hover:to-red-600 text-white font-bold px-8 rounded-2xl transition-all shadow-lg shadow-red-600/30 flex items-center justify-center gap-2 disabled:opacity-50 text-sm h-[48px] xl:h-full xl:min-h-[140px]"
          >
            <div className="flex xl:flex-col items-center gap-2">
              {loading ? <RefreshCw className="animate-spin" size={24} /> : <Zap size={24} />}
              <span>{loading ? 'Analyzing...' : 'Run Analysis'}</span>
            </div>
          </button>
        </div>
      </section>

      {error && (
        <div className="bg-red-950/40 border border-red-500/50 text-red-400 p-5 rounded-2xl mb-8 flex items-center gap-3">
          <AlertTriangle size={24} className="flex-shrink-0" />
          <span className="font-semibold text-sm">{error}</span>
        </div>
      )}

      {warning && !error && (
        <div className="bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-2xl p-4 mb-6 flex items-center gap-3">
          <AlertTriangle size={20} className="flex-shrink-0" />
          <span className="font-semibold text-sm">{warning}</span>
        </div>
      )}

      {loading && !telemetryData && (
        <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-16 flex flex-col items-center justify-center min-h-[40vh] mb-8">
          <RefreshCw className="animate-spin text-red-500 mb-4" size={44} />
          <h3 className="text-xl font-bold animate-pulse text-white">Extracting Multi-Driver Telemetry...</h3>
          <p className="text-xs text-neutral-500 mt-2">Aligning GPS distance & channels for {selectedDrivers.length} drivers</p>
        </div>
      )}

      {telemetryData && (
        <div className={`space-y-8 transition-opacity duration-300 ${loading ? 'opacity-40 pointer-events-none blur-[2px]' : 'opacity-100'}`}>
          <div className="flex justify-between items-center">
            {loading && (
              <div className="flex items-center gap-2 text-red-500 font-bold bg-red-500/10 px-4 py-2 rounded-full animate-pulse">
                <RefreshCw className="animate-spin" size={16} /> Fetching {selectedDrivers.length} Drivers Telemetry...
              </div>
            )}
            <div className="flex-1 flex justify-end">
              <button 
                onClick={handleExportPNG}
                className="bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-bold py-2 px-4 rounded-xl transition-all shadow-md hover:shadow-lg border border-neutral-700 flex items-center gap-2"
              >
                Export Social Card (PNG)
              </button>
            </div>
          </div>

          <div id="telemetry-card" className="space-y-8 p-6 bg-neutral-950/90 rounded-3xl">

            
            {/* Track Domination Map */}
            <TrackDominationMap 
              telemetry={telemetryData.telemetry} 
              drivers={telemetryData.drivers} 
              driver_info={telemetryData.driver_info} 
              activeDistance={activeDistance}
            />

            {/* Stats Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {telemetryData.drivers.map(drv => {
                const info = telemetryData.driver_info[drv];
                if (!info) return null;
                const teamCol = teamColors[info.team] || '#fff';
                const logo = teamLogos[info.team];
                
                return (
                  <div key={drv} className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-5 shadow-xl relative overflow-hidden group" style={{ borderTopWidth: '4px', borderTopColor: teamCol }}>
                    <div className="absolute -right-4 -bottom-6 text-7xl font-black opacity-5 pointer-events-none font-mono" style={{ color: teamCol }}>
                      {drv}
                    </div>
                    <div className="flex justify-between items-start mb-4">
                      <div>
                        <h4 className="text-2xl font-black text-white">{drv}</h4>
                        <p className="text-xs text-neutral-400 font-bold">{info.name}</p>
                      </div>
                      {logo && <img src={logo} alt={info.team} className="h-6 object-contain drop-shadow-md" />}
                    </div>
                    
                    <div className="space-y-3 relative z-10">
                      <div className="bg-neutral-900/80 p-3 rounded-xl border border-neutral-800/50">
                        <div className="text-[10px] text-neutral-500 font-bold uppercase mb-1 flex items-center gap-1"><Flag size={12}/> Lap Time</div>
                        <div className="font-mono text-lg font-bold text-white">{info.lap_time || 'N/A'}</div>
                        <div className="text-[10px] font-bold mt-1" style={{color: info.compound === 'SOFT' ? '#FF3333' : info.compound === 'MEDIUM' ? '#EAEA00' : '#FFFFFF'}}>{info.compound} TYRE</div>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-2">
                        <div className="bg-neutral-900/80 p-2 rounded-xl border border-neutral-800/50">
                          <div className="text-[10px] text-neutral-500 font-bold uppercase mb-1">Top Speed</div>
                          <div className="font-mono text-sm font-bold text-white">{info.max_speed} <span className="text-[10px] text-neutral-500">km/h</span></div>
                        </div>
                        <div className="bg-neutral-900/80 p-2 rounded-xl border border-neutral-800/50">
                          <div className="text-[10px] text-neutral-500 font-bold uppercase mb-1">Avg Speed</div>
                          <div className="font-mono text-sm font-bold text-white">{info.avg_speed} <span className="text-[10px] text-neutral-500">km/h</span></div>
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
              telemetryData.drivers.forEach(drv => {
                const team = telemetryData.driver_info[drv]?.team;
                if (!teamCounts[team]) teamCounts[team] = 0;
                
                const index = teamCounts[team];
                teamCounts[team]++;
                
                let strokeDasharray = undefined;
                if (index === 1) strokeDasharray = "5 5";
                else if (index === 2) strokeDasharray = "3 3";
                
                let color = teamColors[team] || '#fff';
                if (index === 1) color = adjustColor(color, -60);
                else if (index === 2) color = adjustColor(color, 60);
                
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
                  />
                  <ThrottleChart 
                    data={telemetryData.telemetry}
                    drivers={telemetryData.drivers}
                    driverStyles={driverStyles}
                    setActiveDistance={setActiveDistance}
                  />
                  <TimeDeltaChart 
                    data={telemetryData.telemetry}
                    drivers={telemetryData.drivers}
                    driverStyles={driverStyles}
                    setActiveDistance={setActiveDistance}
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
