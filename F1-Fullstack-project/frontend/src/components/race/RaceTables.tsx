import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, Clock, Flag, AlertTriangle, Target, Zap, Activity, Navigation, Thermometer, Droplets, CloudRain, Gauge, Timer } from 'lucide-react';
import { teamColors, teamLogos } from '../../data/teamData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

// =======================================================================

const PracticeResultTable = ({ data }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="text-left text-neutral-400 text-xs uppercase">
        <tr className="bg-neutral-800/50">
          <th className="p-3 w-8 text-center font-semibold">POS.</th>
          <th className="p-3 w-8 text-center font-semibold">NO.</th>
          <th className="p-3 font-semibold">Driver</th>
          <th className="p-3 font-semibold hidden md:table-cell">Team</th>
          <th className="p-3 font-semibold text-right">Time</th>
          <th className="p-3 font-semibold text-right">Laps</th>
        </tr>
      </thead>
      <tbody>
        {data.map(d => (
          <tr key={d.position} className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/40 transition-colors">
            <td className="p-3 font-bold text-center text-base">{d.position}</td>
            <td className="p-3 font-bold text-center text-base" style={{ color: teamColors[d.team_name] || '#FFFFFF' }}>{d.driver_number}</td>
            <td className="p-3 font-bold text-white whitespace-nowrap">
              <Link to={`/driver/${d.full_name.toLowerCase().replace(/\s+/g, '_')}`} className="hover:text-red-400 transition-colors">
                {d.full_name}
              </Link>
            </td>
            <td className="p-3 text-neutral-300 whitespace-nowrap hidden md:table-cell">
              <Link to={`/team/${d.team_name.toLowerCase().replace(/\s+/g, '_')}`} className="flex items-center gap-2 hover:text-white transition-colors">
                {teamLogos[d.team_name] && <img src={teamLogos[d.team_name]} alt={d.team_name} className="h-4 w-auto" />}
                <span>{d.team_name}</span>
              </Link>
            </td>
            <td className="p-3 text-right font-mono text-xs font-bold text-white">{d.time}</td>
            <td className="p-3 text-right">{d.laps}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const QualifyingResultTable = ({ data }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="text-left text-neutral-400 text-xs uppercase">
        <tr className="bg-neutral-800/50">
          <th className="p-3 w-8 text-center font-semibold">POS.</th>
          <th className="p-3 w-8 text-center font-semibold">NO.</th>
          <th className="p-3 font-semibold">Driver</th>
          <th className="p-3 font-semibold hidden md:table-cell">Team</th>
          <th className="p-3 font-semibold text-right">Time</th>
          <th className="p-3 font-semibold text-right">Q1</th>
          <th className="p-3 font-semibold text-right">Q2</th>
          <th className="p-3 font-semibold text-right">Q3</th>
          <th className="p-3 font-semibold text-right">Laps</th>
        </tr>
      </thead>
      <tbody>
        {data.map(d => (
          <tr key={d.position} className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/40 transition-colors">
            <td className="p-3 font-bold text-center text-base">{d.position}</td>
            <td className="p-3 font-bold text-center text-base" style={{ color: teamColors[d.team_name] || '#FFFFFF' }}>{d.driver_number}</td>
            <td className="p-3 font-bold text-white whitespace-nowrap">
              <Link to={`/driver/${d.full_name.toLowerCase().replace(/\s+/g, '_')}`} className="hover:text-red-400 transition-colors">
                {d.full_name}
              </Link>
            </td>
            <td className="p-3 text-neutral-300 whitespace-nowrap hidden md:table-cell">
              <Link to={`/team/${d.team_name.toLowerCase().replace(/\s+/g, '_')}`} className="flex items-center gap-2 hover:text-white transition-colors">
                {teamLogos[d.team_name] && <img src={teamLogos[d.team_name]} alt={d.team_name} className="h-4 w-auto" />}
                <span>{d.team_name}</span>
              </Link>
            </td>
            <td className="p-3 text-right font-mono text-xs font-bold text-white">{d.time}</td>
            <td className="p-3 text-right font-mono text-xs text-neutral-300">{d.q1}</td>
            <td className="p-3 text-right font-mono text-xs text-neutral-300">{d.q2}</td>
            <td className="p-3 text-right font-mono text-xs text-neutral-300">{d.q3}</td>
            <td className="p-3 text-right">{d.laps}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

// SprintQualifying pakai layout yang sama dengan Qualifying
const SprintQualifyingResultTable = QualifyingResultTable;

const SprintResultTable = ({ data }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="text-left text-neutral-400 text-xs uppercase">
        <tr className="bg-neutral-800/50">
          <th className="p-3 w-8 text-center font-semibold">POS.</th>
          <th className="p-3 w-8 text-center font-semibold">NO.</th>
          <th className="p-3 font-semibold">Driver</th>
          <th className="p-3 font-semibold hidden md:table-cell">Team</th>
          <th className="p-3 font-semibold text-right">Time</th>
          <th className="p-3 font-semibold text-right">Gap To Fastest</th>
          <th className="p-3 font-semibold text-right">Interval</th>
          <th className="p-3 font-semibold text-right">Points</th>
          <th className="p-3 font-semibold text-right">Laps</th>
        </tr>
      </thead>
      <tbody>
        {data.map(d => (
          <tr key={d.position} className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/40 transition-colors">
            <td className="p-3 font-bold text-center text-base">{d.position}</td>
            <td className="p-3 font-bold text-center text-base" style={{ color: teamColors[d.team_name] || '#FFFFFF' }}>{d.driver_number}</td>
            <td className="p-3 font-bold text-white whitespace-nowrap">
              <Link to={`/driver/${d.full_name.toLowerCase().replace(/\s+/g, '_')}`} className="hover:text-red-400 transition-colors">
                {d.full_name}
              </Link>
            </td>
            <td className="p-3 text-neutral-300 whitespace-nowrap hidden md:table-cell">
              <Link to={`/team/${d.team_name.toLowerCase().replace(/\s+/g, '_')}`} className="flex items-center gap-2 hover:text-white transition-colors">
                {teamLogos[d.team_name] && <img src={teamLogos[d.team_name]} alt={d.team_name} className="h-4 w-auto" />}
                <span>{d.team_name}</span>
              </Link>
            </td>
            <td className="p-3 text-right font-mono text-xs">{d.time || d.status}</td>
            <td className="p-3 text-right font-mono text-xs">{d.gap_to_leader}</td>
            <td className="p-3 text-right font-mono text-xs">{d.interval}</td>
            <td className="p-3 text-right font-bold">{d.points}</td>
            <td className="p-3 text-right">{d.laps}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const RaceResultTable = ({ data }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="text-left text-neutral-400 text-xs uppercase">
        <tr className="bg-neutral-800/50">
          <th className="p-3 w-8 text-center font-semibold">POS.</th>
          <th className="p-3 w-8 text-center font-semibold">NO.</th>
          <th className="p-3 font-semibold">Driver</th>
          <th className="p-3 font-semibold hidden md:table-cell">Team</th>
          <th className="p-3 font-semibold text-right">Time</th>
          <th className="p-3 font-semibold text-right">Gap To Leader</th>
          <th className="p-3 font-semibold text-right">Interval</th>
          <th className="p-3 font-semibold text-right">Points</th>
          <th className="p-3 font-semibold text-right">Laps</th>
        </tr>
      </thead>
      <tbody>
        {data.map(d => (
          <tr key={d.position} className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/40 transition-colors">
            <td className="p-3 font-bold text-center text-base">{d.position}</td>
            <td className="p-3 font-bold text-center text-base" style={{ color: teamColors[d.team_name] || '#FFFFFF' }}>{d.driver_number}</td>
            <td className="p-3 font-bold text-white whitespace-nowrap">
              <Link to={`/driver/${d.full_name.toLowerCase().replace(/\s+/g, '_')}`} className="hover:text-red-400 transition-colors">
                {d.full_name}
              </Link>
            </td>
            <td className="p-3 text-neutral-300 whitespace-nowrap hidden md:table-cell">
              <Link to={`/team/${d.team_name.toLowerCase().replace(/\s+/g, '_')}`} className="flex items-center gap-2 hover:text-white transition-colors">
                {teamLogos[d.team_name] && <img src={teamLogos[d.team_name]} alt={d.team_name} className="h-4 w-auto" />}
                <span>{d.team_name}</span>
              </Link>
            </td>
            <td className="p-3 text-right font-mono text-xs">{d.time || d.status}</td>
            <td className="p-3 text-right font-mono text-xs">{d.gap_to_leader}</td>
            <td className="p-3 text-right font-mono text-xs">{d.interval}</td>
            <td className="p-3 text-right font-bold">{d.points}</td>
            <td className="p-3 text-right">{d.laps}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const GridTable = ({ data, posKey = 'grid_position' }) => (
  <div className="overflow-x-auto">
    <table className="w-full text-sm">
      <thead className="text-left text-neutral-400 text-xs uppercase">
        <tr className="bg-neutral-800/50">
          <th className="p-3 w-8 text-center font-semibold">POS.</th>
          <th className="p-3 w-8 text-center font-semibold">NO.</th>
          <th className="p-3 font-semibold">Driver</th>
          <th className="p-3 font-semibold hidden md:table-cell">Team</th>
          <th className="p-3 font-semibold text-right">Time</th>
        </tr>
      </thead>
      <tbody>
        {data.map(d => (
          <tr key={d[posKey]} className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/40 transition-colors">
            <td className="p-3 font-bold text-center text-base">{d[posKey]}</td>
            <td className="p-3 font-bold text-center text-base" style={{ color: teamColors[d.team_name] || '#FFFFFF' }}>{d.driver_number}</td>
            <td className="p-3 font-bold text-white whitespace-nowrap">
              <Link to={`/driver/${d.full_name.toLowerCase().replace(/\s+/g, '_')}`} className="hover:text-red-400 transition-colors">
                {d.full_name}
              </Link>
            </td>
            <td className="p-3 text-neutral-300 whitespace-nowrap hidden md:table-cell">
              <Link to={`/team/${d.team_name.toLowerCase().replace(/\s+/g, '_')}`} className="flex items-center gap-2 hover:text-white transition-colors">
                {teamLogos[d.team_name] && <img src={teamLogos[d.team_name]} alt={d.team_name} className="h-4 w-auto" />}
                <span>{d.team_name}</span>
              </Link>
            </td>
            <td className="p-3 text-right font-mono text-xs">{d.time}</td>
          </tr>
        ))}
      </tbody>
    </table>
  </div>
);

const TyreStrategyTable = ({ tyreData }) => {
  const getCompoundColor = (compound) => {
    switch(compound?.toUpperCase()) {
      case 'SOFT': return '#FF3333';
      case 'MEDIUM': return '#EAEA00';
      case 'HARD': return '#FFFFFF';
      case 'INTERMEDIATE': return '#39B54A';
      case 'WET': return '#00AEEF';
      default: return '#666666';
    }
  };

  const getCompoundTextColor = (compound) => {
    if (compound?.toUpperCase() === 'HARD' || compound?.toUpperCase() === 'MEDIUM') return '#000000';
    return '#FFFFFF';
  };

  return (
    <div className="p-6">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
        <div>
          <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500 tracking-tight">Tyre Strategy & Pit Stops</h3>
          <p className="text-xs text-neutral-400 mt-1">
            Visual breakdown of tyre choices and stint lengths
          </p>
        </div>
        
        {/* Tyre Legend */}
        <div className="flex flex-wrap items-center gap-3 bg-neutral-900/50 p-2.5 rounded-xl border border-neutral-800">
          {[
            { label: 'Soft', id: 'S', color: '#FF3333', text: '#FFFFFF' },
            { label: 'Medium', id: 'M', color: '#EAEA00', text: '#000000' },
            { label: 'Hard', id: 'H', color: '#FFFFFF', text: '#000000' },
            { label: 'Inter', id: 'I', color: '#39B54A', text: '#FFFFFF' },
            { label: 'Wet', id: 'W', color: '#00AEEF', text: '#FFFFFF' }
          ].map(t => (
            <div key={t.id} className="flex items-center gap-1.5 px-2">
              <span 
                className="w-5 h-5 flex items-center justify-center rounded text-[10px] font-black border border-black/10 shadow-sm" 
                style={{ backgroundColor: t.color, color: t.text }}
              >
                {t.id}
              </span>
              <span className="text-xs font-bold text-neutral-300 uppercase tracking-wider">{t.label}</span>
            </div>
          ))}
        </div>
      </div>

      <div className="space-y-3">
        {Array.isArray(tyreData) ? tyreData.map((data) => (
          <div key={data.driver} className="flex items-center gap-4 group">
            <div className="w-16 font-bold text-lg text-neutral-400 group-hover:text-white transition-colors flex items-center justify-between">
              <span className="text-xs opacity-50 font-mono">P{data.position}</span>
              <span>{data.driver}</span>
            </div>
            <div className="flex-1 flex gap-1 h-9 rounded-lg overflow-hidden bg-neutral-900/80 shadow-inner border border-neutral-800/80 p-1 backdrop-blur-sm relative">
              {data.stints && data.stints.map((stint, idx) => (
                <div 
                  key={idx} 
                  className="h-full flex items-center justify-center rounded shadow-sm transition-all duration-300 hover:scale-[1.02] hover:brightness-110 hover:z-10 cursor-crosshair relative group/stint border border-black/10 overflow-hidden"
                  style={{ 
                    flexGrow: stint.laps > 0 ? stint.laps : 1, 
                    backgroundColor: getCompoundColor(stint.compound),
                    color: getCompoundTextColor(stint.compound)
                  }}
                >
                  {stint.laps > 0 ? (
                    <div className="flex items-center gap-1.5 px-1 truncate">
                      <span 
                        className="w-4 h-4 flex items-center justify-center rounded-full text-[9px] font-black"
                        style={{ 
                          backgroundColor: getCompoundTextColor(stint.compound) === '#000000' ? 'rgba(0,0,0,0.1)' : 'rgba(0,0,0,0.25)',
                          border: '1px solid currentColor',
                          opacity: 0.85
                        }}
                      >
                        {stint.compound?.charAt(0).toUpperCase()}
                      </span>
                      <span className="font-bold text-xs">
                        {stint.laps}
                      </span>
                    </div>
                  ) : ''}
                  <div className="absolute opacity-0 group-hover/stint:opacity-100 bottom-full mb-2 bg-neutral-900 text-white text-[11px] py-1.5 px-3 rounded-lg border border-neutral-700 pointer-events-none whitespace-nowrap shadow-xl z-20 font-mono">
                    Stint {stint.stint} • {stint.compound} • Laps {stint.start_lap}-{stint.end_lap}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )) : (
          <div className="text-neutral-500 italic text-sm">No tyre strategy data available for this session.</div>
        )}
      </div>
    </div>
  );
};

const SpeedSectorsTable = ({ speedTraps, sectorMatrix }) => {
  // Find the absolute maximum speed to calculate bar widths
  const maxSpeed = speedTraps && speedTraps.length > 0 
    ? Math.max(...speedTraps.map(s => s.speed)) 
    : 100;

  return (
    <div className="p-6">
      <div className="mb-6">
        <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500 tracking-tight">Speed & Sectors</h3>
        <p className="text-xs text-neutral-400 mt-1">
          Analyze straight-line performance and theoretical best laps (Ideal vs Actual)
        </p>
      </div>
      
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
        {/* Speed Trap Leaderboard */}
        <div className="lg:col-span-1">
          <div className="flex items-center gap-2 mb-4">
            <Gauge className="w-5 h-5 text-red-500" />
            <h4 className="text-lg font-bold text-neutral-200">Top Speeds</h4>
          </div>
          <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-xl overflow-hidden p-2">
            <div className="space-y-1">
              {speedTraps && [...speedTraps].sort((a, b) => b.speed - a.speed).slice(0, 10).map((d, i) => {
                const percentage = (d.speed / maxSpeed) * 100;
                return (
                  <div key={d.driver} className="relative flex items-center justify-between p-2 rounded-lg hover:bg-neutral-800/50 transition-colors group z-0">
                    {/* Background Bar */}
                    <div 
                      className="absolute left-0 top-0 bottom-0 bg-gradient-to-r from-neutral-800/30 to-red-500/10 rounded-lg -z-10 transition-all duration-500"
                      style={{ width: `${percentage}%` }}
                    />
                    
                    <div className="flex items-center gap-3">
                      <span className="w-5 text-center text-xs font-bold text-neutral-500">{i + 1}</span>
                      <div className="flex items-center gap-2">
                        <span className="w-1.5 h-4 rounded-sm" style={{ backgroundColor: teamColors[d.team_name] || '#666' }}></span>
                        <span className="font-bold text-sm text-white">{d.driver}</span>
                      </div>
                    </div>
                    
                    <span className="font-mono text-sm font-black text-red-400 group-hover:text-red-300 transition-colors">
                      {d.speed} <span className="text-[10px] text-neutral-500 font-normal">km/h</span>
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Insights / Track Records */}
          <div className="mt-8">
            <div className="flex items-center gap-2 mb-4">
              <Trophy className="w-5 h-5 text-yellow-500" />
              <h4 className="text-lg font-bold text-neutral-200">Session Bests</h4>
            </div>
            <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-xl overflow-hidden p-4 space-y-4">
              {['s1', 's2', 's3'].map((sector, idx) => {
                const best = sectorMatrix?.find(d => d[`${sector}_purple`]);
                return (
                  <div key={sector} className={`flex justify-between items-center ${idx !== 2 ? 'pb-3 border-b border-neutral-800/50' : ''}`}>
                    <div className="flex flex-col">
                      <span className="text-xs text-neutral-500 font-bold uppercase tracking-wider mb-1">Fastest Sector {idx + 1}</span>
                      {best ? (
                        <div className="flex items-center gap-2">
                          <span className="w-1.5 h-3 rounded-sm" style={{ backgroundColor: teamColors[best.team_name] || '#666' }}></span>
                          <span className="text-sm font-bold text-white">{best.driver}</span>
                        </div>
                      ) : <span className="text-sm text-neutral-500">-</span>}
                    </div>
                    {best && <span className="font-mono text-sm font-black text-purple-400 bg-purple-900/20 px-2 py-1 rounded border border-purple-500/30 shadow-[0_0_8px_rgba(168,85,247,0.15)]">{best[sector]}</span>}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Purple Sector Matrix */}
        <div className="lg:col-span-2 overflow-x-auto">
          <div className="flex items-center gap-2 mb-4">
            <Timer className="w-5 h-5 text-purple-500" />
            <h4 className="text-lg font-bold text-neutral-200">Sector Matrix</h4>
          </div>
          <div className="bg-neutral-900/40 border border-neutral-800/80 rounded-xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-neutral-800/50 text-neutral-400 text-[10px] tracking-wider uppercase text-left border-b border-neutral-800/80">
                <tr>
                  <th className="p-4 font-bold">Driver</th>
                  <th className="p-4 text-center font-bold">Sector 1</th>
                  <th className="p-4 text-center font-bold">Sector 2</th>
                  <th className="p-4 text-center font-bold">Sector 3</th>
                  <th className="p-4 text-right font-bold">Ideal Lap</th>
                  <th className="p-4 text-right font-bold">Actual Lap</th>
                  <th className="p-4 text-right font-bold">Delta (Lost)</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/50">
                {sectorMatrix && [...sectorMatrix].sort((a, b) => a.position - b.position).map(d => (
                  <tr key={d.driver} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="p-4">
                      <div className="flex items-center gap-2 font-bold text-white">
                        <span className="w-1.5 h-4 rounded-sm" style={{ backgroundColor: teamColors[d.team_name] || '#666' }}></span>
                        {d.driver}
                      </div>
                    </td>
                    
                    {/* Sectors with Pills */}
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-mono font-bold border ${d.s1_purple ? 'bg-purple-900/30 text-purple-400 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-neutral-800/50 text-neutral-300 border-neutral-700'}`}>
                        {d.s1}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-mono font-bold border ${d.s2_purple ? 'bg-purple-900/30 text-purple-400 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-neutral-800/50 text-neutral-300 border-neutral-700'}`}>
                        {d.s2}
                      </span>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-mono font-bold border ${d.s3_purple ? 'bg-purple-900/30 text-purple-400 border-purple-500/50 shadow-[0_0_10px_rgba(168,85,247,0.2)]' : 'bg-neutral-800/50 text-neutral-300 border-neutral-700'}`}>
                        {d.s3}
                      </span>
                    </td>
                    
                    {/* Laps & Delta */}
                    <td className="p-4 text-right font-mono text-xs text-blue-300/90 font-medium">
                      {d.ideal_lap}
                    </td>
                    <td className="p-4 text-right font-mono text-xs text-white font-bold">
                      {d.actual_lap}
                    </td>
                    <td className="p-4 text-right">
                      <span className="inline-block px-2 py-0.5 rounded bg-red-900/20 text-red-400 border border-red-900/30 font-mono text-xs font-bold">
                        +{d.potential_gain}s
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
};


const WeatherChart = ({ weatherData }) => {
  if (!weatherData || weatherData.length === 0) {
    return <div className="p-6 text-neutral-500 italic">No weather data available</div>;
  }

  const maxTrackTemp = Math.max(...weatherData.map(d => d.track_temp));
  const maxAirTemp = Math.max(...weatherData.map(d => d.air_temp));
  const hasRain = weatherData.some(d => d.rainfall);
  const avgHumidity = Math.round(weatherData.reduce((acc, curr) => acc + curr.humidity, 0) / weatherData.length);

  return (
    <div className="p-6">
      <h3 className="text-2xl font-black mb-6 text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500 tracking-tight">Track Conditions Dashboard</h3>
      
      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-lg">
          <span className="text-neutral-400 text-xs uppercase font-bold mb-1">Max Track Temp</span>
          <span className="text-2xl font-black text-orange-500">{maxTrackTemp.toFixed(1)}°C</span>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-lg">
          <span className="text-neutral-400 text-xs uppercase font-bold mb-1">Max Air Temp</span>
          <span className="text-2xl font-black text-green-500">{maxAirTemp.toFixed(1)}°C</span>
        </div>
        <div className="bg-neutral-900/50 border border-neutral-800 rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-lg">
          <span className="text-neutral-400 text-xs uppercase font-bold mb-1">Avg Humidity</span>
          <span className="text-2xl font-black text-[#00AEEF]">{avgHumidity}%</span>
        </div>
        <div className={`border rounded-xl p-4 flex flex-col items-center justify-center text-center shadow-lg ${hasRain ? 'bg-blue-900/20 border-blue-800/50' : 'bg-neutral-900/50 border-neutral-800'}`}>
          <span className="text-neutral-400 text-xs uppercase font-bold mb-1">Rainfall Status</span>
          <span className={`text-2xl font-black ${hasRain ? 'text-blue-400' : 'text-neutral-500'}`}>{hasRain ? 'RAIN DETECTED' : 'CLEAR'}</span>
        </div>
      </div>

      {/* Chart */}
      <div className="h-[380px] bg-neutral-900/20 rounded-xl p-4 border border-neutral-800/50">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={weatherData} margin={{ top: 10, right: 10, left: -20, bottom: 20 }}>
            <defs>
              <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
                <feGaussianBlur stdDeviation="3" result="blur" />
                <feComposite in="SourceGraphic" in2="blur" operator="over" />
              </filter>
            </defs>
            <CartesianGrid strokeDasharray="3 3" stroke="#2a2a2a" vertical={false} />
            <XAxis dataKey="time_offset" stroke="#666" tick={{fill: '#666', fontSize: 12}} tickLine={false} axisLine={false} label={{ value: 'Race Time (minutes)', position: 'bottom', fill: '#666', fontSize: 12, offset: 10 }} />
            
            {/* Split Y-Axes */}
            <YAxis yAxisId="left" stroke="#666" tick={{fill: '#666', fontSize: 12}} tickLine={false} axisLine={false} label={{ value: 'Temp (°C)', angle: -90, position: 'insideLeft', fill: '#666', fontSize: 12, offset: 25 }} domain={['auto', 'auto']} />
            <YAxis yAxisId="right" orientation="right" stroke="#666" tick={{fill: '#666', fontSize: 12}} tickLine={false} axisLine={false} label={{ value: 'Humidity (%)', angle: 90, position: 'insideRight', fill: '#666', fontSize: 12, offset: 15 }} domain={[0, 100]} />
            
            <RechartsTooltip 
              contentStyle={{ backgroundColor: 'rgba(10,10,10,0.95)', backdropFilter: 'blur(12px)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', color: '#fff', boxShadow: '0 10px 25px -5px rgba(0, 0, 0, 0.5)' }} 
              itemStyle={{ fontWeight: 'bold' }}
              labelFormatter={(lbl) => `Time Offset: ${lbl} mins`}
            />
            <Legend verticalAlign="top" height={40} iconType="circle" wrapperStyle={{ fontSize: '13px', fontWeight: '600', color: '#ccc' }} />
            
            <Line yAxisId="left" type="monotone" dataKey="track_temp" name="Track Temp" stroke="#ff7300" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#ff7300' }} filter="url(#glow)" />
            <Line yAxisId="left" type="monotone" dataKey="air_temp" name="Air Temp" stroke="#387908" strokeWidth={3} dot={false} activeDot={{ r: 6, strokeWidth: 0, fill: '#387908' }} filter="url(#glow)" />
            <Line yAxisId="right" type="monotone" dataKey="humidity" name="Humidity" stroke="#00AEEF" strokeWidth={2} strokeDasharray="5 5" dot={false} activeDot={{ r: 5, strokeWidth: 0, fill: "#00AEEF" }} />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
export { PracticeResultTable, QualifyingResultTable, SprintQualifyingResultTable, SprintResultTable, RaceResultTable, GridTable, TyreStrategyTable, SpeedSectorsTable, WeatherChart };
