// src/TelemetryTab.jsx
import React, { useState, useEffect } from 'react';
import { API_URL } from '../../config';
import { 
  Activity, RefreshCw, AlertTriangle, Zap, GitCommitVertical, 
  Gauge, TrendingUp, Radio, Compass, Flag, Award, ChevronLeft, ChevronRight, Crosshair
} from 'lucide-react';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, 
  Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine 
} from 'recharts';
import html2canvas from 'html2canvas';
import { teamColors, teamLogos } from '../../data/teamData';

const adjustColor = (col, amt) => {
  if (!col) return '#ffffff';
  let color = col.replace(/^#/, '');
  if (color.length === 3) color = color[0]+color[0]+color[1]+color[1]+color[2]+color[2];
  let num = parseInt(color, 16);
  let r = (num >> 16) + amt;
  let b = ((num >> 8) & 0x00FF) + amt;
  let g = (num & 0x0000FF) + amt;
  r = Math.max(Math.min(255, r), 0);
  b = Math.max(Math.min(255, b), 0);
  g = Math.max(Math.min(255, g), 0);
  return '#' + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
};

const TrackDominationMap = ({ telemetry, drivers, driver_info, activeDistance }) => {
  if (!telemetry || !telemetry[0] || telemetry[0].x === undefined) return null;

  const xs = telemetry.map(d => d.x).filter(x => x !== undefined && !isNaN(x));
  const ys = telemetry.map(d => d.y).filter(y => y !== undefined && !isNaN(y));
  if (xs.length === 0) return null;

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  const padding = 1000;
  const viewBox = `${minX - padding} ${minY - padding} ${maxX - minX + padding*2} ${maxY - minY + padding*2}`;

  let activePoint = null;
  if (activeDistance !== null) {
    // find nearest distance
    activePoint = telemetry.find(d => d.distance === activeDistance) || telemetry.find(d => d.distance >= activeDistance);
  }

  // Pre-calculate driver styles (for teammates)
  const driverStyles = {};
  const teamCounts = {};
  drivers.forEach(drv => {
    const team = driver_info[drv]?.team;
    if (!teamCounts[team]) teamCounts[team] = 0;
    
    const index = teamCounts[team];
    teamCounts[team]++;
    
    let color = teamColors[team] || '#ffffff';
    if (index === 1) color = adjustColor(color, -60);
    else if (index === 2) color = adjustColor(color, 60);
    
    driverStyles[drv] = {
      color,
      strokeDasharray: undefined // No dashes on track map
    };
  });

  // Group points into continuous polylines based on dominant driver
  const polylines = [];
  let currentLine = null;
  
  telemetry.forEach((d) => {
    if (d.x === undefined || d.y === undefined || isNaN(d.x) || isNaN(d.y)) return;
    const dominant = d.dominant_driver;
    
    if (!currentLine || currentLine.driver !== dominant) {
      if (currentLine) {
        // To prevent gaps between segments, add this point to the previous line as well
        currentLine.points.push(`${d.x},${d.y}`);
        polylines.push(currentLine);
      }
      currentLine = {
        driver: dominant,
        points: [`${d.x},${d.y}`]
      };
    } else {
      currentLine.points.push(`${d.x},${d.y}`);
    }
  });
  if (currentLine) polylines.push(currentLine);

  const allPoints = telemetry
    .filter(d => d.x !== undefined && d.y !== undefined && !isNaN(d.x) && !isNaN(d.y))
    .map(d => `${d.x},${d.y}`)
    .join(' ');

  return (
    <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 shadow-2xl mb-8">
      <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
        <Compass size={20} className="text-red-500" /> Track Domination Map
      </h3>
      <div className="w-full h-[400px] bg-neutral-950 rounded-2xl p-4 flex items-center justify-center overflow-hidden">
        <svg viewBox={viewBox} className="w-full h-full" style={{ transform: 'scale(1, -1)' }}>
          {/* Background Track Line */}
          <polyline 
            points={allPoints}
            stroke="#2a2a2a"
            strokeWidth={500}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {polylines.map((line, i) => {
            const style = driverStyles[line.driver] || { color: '#ffffff' };
            return (
              <polyline 
                key={i}
                points={line.points.join(' ')}
                stroke={style.color}
                strokeWidth={500}
                strokeDasharray={style.strokeDasharray}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            );
          })}
          {activePoint && (
            <circle 
              cx={activePoint.x} 
              cy={activePoint.y} 
              r={300} 
              fill="#ffffff" 
              stroke="#000000"
              strokeWidth={100}
            />
          )}
        </svg>
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm font-bold">
        {drivers.map(drv => {
          const style = driverStyles[drv] || { color: '#ffffff' };
          return (
            <div key={drv} className="flex items-center gap-2">
              <svg width="24" height="12" viewBox="0 0 24 12">
                <line x1="0" y1="6" x2="24" y2="6" stroke={style.color} strokeWidth="4" />
              </svg>
              {drv}
            </div>
          );
        })}
      </div>
    </div>
  );
};

const LapRuler = ({ lap, setLap }) => {
  const currentLap = lap ? parseInt(lap, 10) : null;

  const handleLapClick = (l) => setLap(l.toString());
  const setFastest = () => setLap('');

  const getVisibleLaps = () => {
    if (!currentLap) return [1, 2, 3, 4, 5];
    let start = Math.max(1, currentLap - 2);
    return Array.from({ length: 5 }, (_, i) => start + i);
  };

  const visibleLaps = getVisibleLaps();

  return (
    <div className="bg-gradient-to-b from-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-4 flex flex-col items-center relative overflow-hidden shadow-2xl w-full md:w-72">
      <div className="absolute top-0 w-3/4 h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent"></div>
      
      <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-[0.2em] mb-4 flex items-center gap-2">
        <Crosshair size={12} className="text-red-500" /> Lap Selector
      </div>
      
      <div className="flex items-center justify-between w-full mb-5 px-2 h-16">
        <button 
          onClick={() => { if(currentLap > 1) setLap((currentLap - 1).toString()) }}
          className="text-neutral-600 hover:text-white transition-colors p-1"
        >
          <ChevronLeft size={24} />
        </button>
        
        <div className="flex-1 flex justify-center items-center gap-3">
          {!currentLap ? (
            <div className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-b from-white to-neutral-500 tracking-widest animate-pulse">
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
                    className={`flex flex-col items-center cursor-pointer transition-all duration-300 ${
                      isActive ? 'scale-125 mx-2' : 'opacity-40 hover:opacity-100 hover:scale-110'
                    }`}
                  >
                    <div className={`text-[10px] mb-1.5 font-mono ${isActive ? 'text-red-400 font-black' : 'text-neutral-400 font-bold'}`}>
                      {l}
                    </div>
                    <div className={`w-1 rounded-full transition-all ${isActive ? 'h-8 bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)]' : 'h-3 bg-neutral-600'}`}></div>
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
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${!currentLap ? 'bg-neutral-800 text-white shadow-md' : 'text-neutral-500 hover:text-white hover:bg-neutral-900'}`}
        >
          FASTEST
        </button>
        <button 
          onClick={() => { if(!currentLap) setLap('1') }}
          className={`flex-1 py-1.5 text-[10px] font-bold rounded-md transition-all ${currentLap ? 'bg-neutral-800 text-white shadow-md' : 'text-neutral-500 hover:text-white hover:bg-neutral-900'}`}
        >
          MANUAL
        </button>
      </div>
    </div>
  );
};



const TelemetryTab = ({ year, round }) => {
  const [selectedDrivers, setSelectedDrivers] = useState([]);
  const [availableDrivers, setAvailableDrivers] = useState([]);
  const [lap, setLap] = useState('');
  
  const [loading, setLoading] = useState(false);
  const [telemetryData, setTelemetryData] = useState(null);
  const [error, setError] = useState(null);
  const [warning, setWarning] = useState(null);

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

        <LapRuler lap={lap} setLap={setLap} />

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
              const driverStyles = {};
              const teamCounts = {};
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

              const CustomTooltip = ({ active, payload, label }) => {
                if (active && payload && payload.length) {
                  return (
                    <div className="bg-neutral-955/95 backdrop-blur-md border border-neutral-700 p-4 rounded-xl shadow-2xl min-w-[200px]">
                      <p className="text-neutral-400 text-xs font-bold mb-3 border-b border-neutral-800 pb-2">Distance: {label}m</p>
                      {payload.map((entry, index) => {
                        const drv = entry.name;
                        const style = driverStyles[drv] || { color: '#fff' };
                        return (
                          <div key={index} className="flex justify-between items-center mb-1 text-sm font-mono">
                            <span className="font-bold flex items-center gap-2">
                              <svg width="16" height="8" viewBox="0 0 16 8">
                                <line x1="0" y1="4" x2="16" y2="4" stroke={style.color} strokeWidth="3" strokeDasharray={style.strokeDasharray} />
                              </svg>
                              <span className="text-white">{drv}</span>
                            </span>
                            <span className="text-neutral-300 font-bold ml-4">
                              {Number(entry.value).toFixed(1)} {entry.dataKey.startsWith('speed') ? 'km/h' : entry.dataKey.startsWith('delta') ? 's' : '%'}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  );
                }
                return null;
              };

              const renderLineChart = (title, icon, dataKeys, domain) => (
                <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 shadow-2xl">
                  <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
                    {icon} {title}
                  </h3>
                  <div className="h-[300px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <LineChart 
                        data={telemetryData.telemetry} 
                        margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
                        onMouseMove={(chartState) => {
                          if (chartState && chartState.activeLabel !== undefined) {
                            setActiveDistance(chartState.activeLabel);
                          }
                        }}
                        onMouseLeave={() => setActiveDistance(null)}
                      >
                        <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
                        <XAxis dataKey="distance" stroke="#666" tick={{fill: '#888', fontSize: 11}} tickLine={false} axisLine={false} minTickGap={50} />
                        <YAxis domain={domain} stroke="#666" tick={{fill: '#888', fontSize: 11}} tickLine={false} axisLine={false} width={40} />
                        <RechartsTooltip content={<CustomTooltip />} />
                        <Legend verticalAlign="top" height={36} iconType="plainline" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
                        
                        {telemetryData.drivers.map(drv => {
                          const dataKey = dataKeys.replace('{drv}', drv);
                          if (dataKeys.startsWith('delta') && drv === telemetryData.drivers[0]) return null;
                          
                          const style = driverStyles[drv] || { color: '#fff' };
                          return (
                            <Line 
                              key={drv}
                              type="monotone" 
                              dataKey={dataKey} 
                              name={drv}
                              stroke={style.color}
                              strokeWidth={2}
                              strokeDasharray={style.strokeDasharray}
                              dot={false}
                              activeDot={{ r: 4, strokeWidth: 0 }}
                              isAnimationActive={false}
                            />
                          );
                        })}
                        {dataKeys.startsWith('delta') && <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />}
                      </LineChart>
                    </ResponsiveContainer>
                  </div>
                </div>
              );

              return (
                <div className="space-y-6">
                  {renderLineChart("Speed Profile", <Gauge className="text-blue-500"/>, "speed_{drv}", ['auto', 'auto'])}
                  {renderLineChart("Throttle Application", <Zap className="text-orange-500"/>, "throttle_{drv}", [0, 105])}
                  {telemetryData.drivers.length > 1 && renderLineChart(`Time Delta (to ${telemetryData.drivers[0]})`, <TrendingUp className="text-green-500"/>, "delta_{drv}", ['auto', 'auto'])}
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
