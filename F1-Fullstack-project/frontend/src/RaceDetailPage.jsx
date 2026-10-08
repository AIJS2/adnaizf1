// src/RaceDetailPage.jsx - FIXED: shared teamData & config, improved error state

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { Trophy, GitCommitVertical, Clock, Calendar, AlertTriangle, RefreshCw, Activity, TrendingUp, Wrench, Disc, Route, Gauge, Sun, List, LayoutGrid, Timer, Flag } from 'lucide-react';
import { API_URL } from './config';
import { teamLogos, teamColors } from './data/teamData';
import { getTrackMap } from './data/trackData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer } from 'recharts';
import TelemetryTab from './TelemetryTab';

// =======================================================================
// --- KOMPONEN-KOMPONEN KECIL ---
// =======================================================================

const SummaryCard = ({ title, icon, data }) => (
  <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-6 h-full shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:shadow-[0_8px_30px_rgba(255,0,0,0.1)] hover:border-neutral-700 transition-all duration-500 group relative overflow-hidden">
    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-red-500/10 transition-colors"></div>
    <div className="flex justify-between items-center text-neutral-400 text-sm relative z-10">
      <span className="font-semibold uppercase tracking-wider">{title}</span>
      <span className="text-neutral-500 group-hover:text-red-500 transition-colors">{icon}</span>
    </div>
    {data && data.full_name ? (
      <div className="mt-5 relative z-10">
        <p className="text-2xl font-black text-white flex items-center gap-3 tracking-tight">
          {data.team_name && teamLogos[data.team_name] && (
            <Link to={`/team/${data.team_name.toLowerCase().replace(/\s+/g, '_')}`}>
              <img src={teamLogos[data.team_name]} alt={data.team_name} className="h-6 w-auto drop-shadow-md hover:opacity-80 transition-opacity" />
            </Link>
          )}
          <Link to={`/driver/${data.full_name.toLowerCase().replace(/\s+/g, '_')}`} className="hover:text-red-400 transition-colors">
            {data.full_name}
          </Link>
        </p>
        {title === 'Fastest Lap' && data.lap_number ? (
          <p className="font-mono text-red-400 mt-2 text-sm font-bold bg-red-500/10 inline-block px-2 py-1 rounded">Lap {data.lap_number} <span className="text-neutral-300 ml-2">{data.lap_time}</span></p>
        ) : (
          <p className="font-mono text-neutral-300 mt-2 font-bold text-lg">{data.time || data.lap_time}</p>
        )}
      </div>
    ) : (
      <p className="mt-5 text-neutral-500 text-sm italic relative z-10">Race not run yet.</p>
    )}
  </div>
);

// =======================================================================
// --- TABEL-TABEL HASIL SESSION ---
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

// --- LAP CHART COMPONENT ---
const LapChartComponent = ({ lapChart, results }) => {
  const sample = lapChart && lapChart[0] ? lapChart[0] : {};
  const activeKeys = Object.keys(sample).filter(k => k !== 'lap');

  const driverMeta = {};
  if (results) {
    results.forEach(r => {
      const parts = (r.full_name || '').split(' ');
      const last = parts[parts.length - 1] || '';
      const fallbackAbbr = last.slice(0, 3).toUpperCase();
      const abbr = r.abbreviation || fallbackAbbr;
      driverMeta[abbr] = {
        name: r.full_name,
        team: r.team_name,
        color: teamColors[r.team_name] || '#888888'
      };
    });
  }

  const [selectedDrivers, setSelectedDrivers] = useState(activeKeys);

  const toggleDriver = (drv) => {
    if (selectedDrivers.includes(drv)) {
      if (selectedDrivers.length > 1) {
        setSelectedDrivers(selectedDrivers.filter(d => d !== drv));
      }
    } else {
      setSelectedDrivers([...selectedDrivers, drv]);
    }
  };

  const selectTop10 = () => setSelectedDrivers(activeKeys.slice(0, 10));
  const selectAll = () => setSelectedDrivers(activeKeys);
  const clearAll = () => setSelectedDrivers([]);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500 tracking-tight">
            Lap-by-Lap Position Chart
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Track positional changes, overtakes, and pit stops from Lap 1 to {lapChart.length}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={selectTop10}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-lg text-neutral-300 transition-colors"
          >
            Top 10
          </button>
          <button 
            onClick={selectAll}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-lg text-neutral-300 transition-colors"
          >
            All
          </button>
          <button 
            onClick={clearAll}
            className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-xs font-bold rounded-lg text-red-400 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Driver Toggle Pills */}
      <div className="flex flex-wrap gap-2 mb-6 max-h-28 overflow-y-auto p-2 bg-neutral-950/60 rounded-xl border border-neutral-800">
        {activeKeys.map(drv => {
          const isSelected = selectedDrivers.includes(drv);
          const meta = driverMeta[drv];
          const color = meta?.color || '#888888';
          return (
            <button
              key={drv}
              onClick={() => toggleDriver(drv)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                isSelected 
                  ? 'bg-neutral-900 text-white border-neutral-600 shadow' 
                  : 'bg-transparent text-neutral-500 border-neutral-800 opacity-50 hover:opacity-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {drv}
            </button>
          );
        })}
      </div>

      {/* Recharts LineChart with Y reversed so P1 is at top */}
      <div className="h-[460px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lapChart} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis 
              dataKey="lap" 
              stroke="#666" 
              tick={{ fill: '#888', fontSize: 11 }} 
              tickLine={false} 
              axisLine={false} 
              label={{ value: 'Race Lap Number', position: 'insideBottom', fill: '#666', fontSize: 11, offset: -10 }}
            />
            <YAxis 
              domain={[1, 20]} 
              reversed={true} 
              ticks={[1, 3, 5, 10, 15, 20]}
              tickFormatter={(v) => `P${v}`}
              stroke="#666" 
              tick={{ fill: '#888', fontSize: 11 }} 
              tickLine={false} 
              axisLine={false} 
            />
            <RechartsTooltip 
              contentStyle={{ backgroundColor: 'rgba(15,15,15,0.95)', border: '1px solid #333', borderRadius: '12px', color: '#fff' }}
              labelFormatter={(lbl) => `Lap ${lbl}`}
              formatter={(val, name) => [`P${val}`, name]}
            />
            {selectedDrivers.map(drv => {
              const meta = driverMeta[drv];
              const color = meta?.color || '#EF4444';
              return (
                <Line
                  key={drv}
                  type="linear"
                  dataKey={drv}
                  name={meta?.name || drv}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, stroke: '#fff', strokeWidth: 1.5 }}
                  connectNulls={true}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
// --- GAP CHART COMPONENT ---
const GapChartComponent = ({ gapChart, results }) => {
  const sample = gapChart && gapChart[0] ? gapChart[0] : {};
  const activeKeys = Object.keys(sample).filter(k => k !== 'lap');

  const driverMeta = {};
  if (results) {
    results.forEach(r => {
      const parts = (r.full_name || '').split(' ');
      const last = parts[parts.length - 1] || '';
      const fallbackAbbr = last.slice(0, 3).toUpperCase();
      const abbr = r.abbreviation || fallbackAbbr;
      driverMeta[abbr] = {
        name: r.full_name,
        team: r.team_name,
        color: teamColors[r.team_name] || '#888888'
      };
    });
  }

  const [selectedDrivers, setSelectedDrivers] = useState(activeKeys);
  const [zoomFront, setZoomFront] = useState(false);

  const toggleDriver = (drv) => {
    if (selectedDrivers.includes(drv)) {
      if (selectedDrivers.length > 1) {
        setSelectedDrivers(selectedDrivers.filter(d => d !== drv));
      }
    } else {
      setSelectedDrivers([...selectedDrivers, drv]);
    }
  };

  const selectTop5 = () => setSelectedDrivers(activeKeys.slice(0, 5));
  const selectAll = () => setSelectedDrivers(activeKeys);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500 tracking-tight">
            Race Progression (Gap to Leader)
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Analyze pace and gap variations across the race distance
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setZoomFront(!zoomFront)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 border ${zoomFront ? 'bg-orange-900/40 text-orange-400 border-orange-500/30' : 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}
            title="Cap the gap at +30s to focus on the battle for the podium"
          >
            {zoomFront ? '🔍 Zoomed In (Front Pack)' : '📉 Show All (Inc. Backmarkers)'}
          </button>
          <div className="w-px h-6 bg-neutral-800 mx-1"></div>
          <button 
            onClick={selectTop5}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-lg text-neutral-300 transition-colors"
          >
            Top 5
          </button>
          <button 
            onClick={selectAll}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-lg text-neutral-300 transition-colors"
          >
            All Drivers
          </button>
        </div>
      </div>

      {/* Driver Toggle Pills */}
      <div className="flex flex-wrap gap-2 mb-6 max-h-28 overflow-y-auto p-2 bg-neutral-950/60 rounded-xl border border-neutral-800">
        {activeKeys.map(drv => {
          const isSelected = selectedDrivers.includes(drv);
          const meta = driverMeta[drv];
          const color = meta?.color || '#888888';
          return (
            <button
              key={drv}
              onClick={() => toggleDriver(drv)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                isSelected 
                  ? 'bg-neutral-900 text-white border-neutral-600 shadow' 
                  : 'bg-transparent text-neutral-500 border-neutral-800 opacity-50 hover:opacity-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {drv}
            </button>
          );
        })}
      </div>

      <div className="h-[460px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={gapChart} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis 
              dataKey="lap" 
              stroke="#666" 
              tick={{ fill: '#888', fontSize: 11 }} 
              tickLine={false} 
              axisLine={false} 
              label={{ value: 'Race Lap Number', position: 'insideBottom', fill: '#666', fontSize: 11, offset: -10 }}
            />
            <YAxis 
              domain={zoomFront ? [0, 30] : ['auto', 'auto']} 
              allowDataOverflow={true}
              reversed={true} 
              tickFormatter={(v) => `+${v}s`}
              stroke="#666" 
              tick={{ fill: '#888', fontSize: 11 }} 
              tickLine={false} 
              axisLine={false} 
            />
            <RechartsTooltip 
              contentStyle={{ backgroundColor: 'rgba(15,15,15,0.95)', border: '1px solid #333', borderRadius: '12px', color: '#fff' }}
              labelFormatter={(lbl) => `Lap ${lbl}`}
              formatter={(val, name) => [`+${val}s`, name]}
            />
            {selectedDrivers.map(drv => {
              const meta = driverMeta[drv];
              const color = meta?.color || '#EF4444';
              return (
                <Line
                  key={drv}
                  type="monotone"
                  dataKey={drv}
                  name={meta?.name || drv}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={true}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// --- LAP TIMES CHART COMPONENT ---
const LapTimesChartComponent = ({ lapTimesChart, results }) => {
  const sample = lapTimesChart && lapTimesChart[0] ? lapTimesChart[0] : {};
  const activeKeys = Object.keys(sample).filter(k => k !== 'lap');

  const driverMeta = {};
  if (results) {
    results.forEach(r => {
      const parts = (r.full_name || '').split(' ');
      const last = parts[parts.length - 1] || '';
      const fallbackAbbr = last.slice(0, 3).toUpperCase();
      const abbr = r.abbreviation || fallbackAbbr;
      driverMeta[abbr] = {
        name: r.full_name,
        team: r.team_name,
        color: teamColors[r.team_name] || '#888888'
      };
    });
  }

  const [selectedDrivers, setSelectedDrivers] = useState(activeKeys);
  const [filterOutliers, setFilterOutliers] = useState(true);

  const toggleDriver = (drv) => {
    if (selectedDrivers.includes(drv)) {
      if (selectedDrivers.length > 1) {
        setSelectedDrivers(selectedDrivers.filter(d => d !== drv));
      }
    } else {
      setSelectedDrivers([...selectedDrivers, drv]);
    }
  };

  const selectTop5 = () => setSelectedDrivers(activeKeys.slice(0, 5));
  const selectAll = () => setSelectedDrivers(activeKeys);

  const formatLapTime = (seconds) => {
    if (!seconds) return '';
    const m = Math.floor(seconds / 60);
    const s = Math.floor(seconds % 60);
    const ms = Math.floor((seconds % 1) * 1000);
    return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
  };

  // Calculate domain manually to avoid Recharts domain function crash
  let yDomain = ['dataMin', 'dataMax'];
  if (filterOutliers && lapTimesChart && lapTimesChart.length > 0) {
    let minTime = Infinity;
    lapTimesChart.forEach(row => {
      selectedDrivers.forEach(drv => {
        if (row[drv] && row[drv] < minTime) {
          minTime = row[drv];
        }
      });
    });
    if (minTime < Infinity) {
      yDomain = [minTime, minTime * 1.15];
    }
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500 tracking-tight">
            Lap Analysis (Lap Times)
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Analyze individual lap times and pace consistency across the race
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setFilterOutliers(!filterOutliers)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 border ${filterOutliers ? 'bg-blue-900/40 text-blue-400 border-blue-500/30' : 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}
            title="Filter out slow laps (e.g. pit stops) to zoom in on normal race pace"
          >
            {filterOutliers ? '🔍 Zoomed In (Race Pace)' : '📉 Show All (Inc. Pit Stops)'}
          </button>
          <div className="w-px h-6 bg-neutral-800 mx-1"></div>
          <button 
            onClick={selectTop5}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-lg text-neutral-300 transition-colors"
          >
            Top 5
          </button>
          <button 
            onClick={selectAll}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-lg text-neutral-300 transition-colors"
          >
            All Drivers
          </button>
        </div>
      </div>

      {/* Driver Toggle Pills */}
      <div className="flex flex-wrap gap-2 mb-6 max-h-28 overflow-y-auto p-2 bg-neutral-950/60 rounded-xl border border-neutral-800">
        {activeKeys.map(drv => {
          const isSelected = selectedDrivers.includes(drv);
          const meta = driverMeta[drv];
          const color = meta?.color || '#888888';
          return (
            <button
              key={drv}
              onClick={() => toggleDriver(drv)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                isSelected 
                  ? 'bg-neutral-900 text-white border-neutral-600 shadow' 
                  : 'bg-transparent text-neutral-500 border-neutral-800 opacity-50 hover:opacity-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {drv}
            </button>
          );
        })}
      </div>

      <div className="h-[460px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lapTimesChart} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis 
              dataKey="lap" 
              stroke="#666" 
              tick={{ fill: '#888', fontSize: 11 }} 
              tickLine={false} 
              axisLine={false} 
              label={{ value: 'Race Lap Number', position: 'insideBottom', fill: '#666', fontSize: 11, offset: -10 }}
            />
            <YAxis 
              domain={yDomain}
              allowDataOverflow={true}
              tickFormatter={formatLapTime}
              stroke="#666" 
              tick={{ fill: '#888', fontSize: 11 }} 
              tickLine={false} 
              axisLine={false} 
            />
            <RechartsTooltip 
              contentStyle={{ backgroundColor: 'rgba(15,15,15,0.95)', border: '1px solid #333', borderRadius: '12px', color: '#fff' }}
              labelFormatter={(lbl) => `Lap ${lbl}`}
              formatter={(val, name) => [formatLapTime(val), name]}
            />
            {selectedDrivers.map(drv => {
              const meta = driverMeta[drv];
              const color = meta?.color || '#EF4444';
              return (
                <Line
                  key={drv}
                  type="monotone"
                  dataKey={drv}
                  name={meta?.name || drv}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
                  connectNulls={true}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

// --- ERROR STATE ---
const ErrorState = ({ message, onRetry }) => (

  <div className="bg-neutral-950 min-h-screen text-white flex items-center justify-center text-center px-4">
    <div className="max-w-md">
      <AlertTriangle size={48} className="text-red-500 mx-auto mb-4" />
      <h2 className="text-3xl font-bold text-red-500 mb-2">Gagal Memuat Detail Race</h2>
      <p className="text-neutral-400 mb-4">Pastikan backend sudah berjalan dan coba lagi.</p>
      <p className="text-neutral-600 text-xs font-mono mb-6 bg-neutral-900 px-3 py-2 rounded">{message}</p>
      <div className="flex gap-3 justify-center">
        <button onClick={onRetry}
          className="flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white font-bold rounded-full transition-colors">
          <RefreshCw size={16} /> Coba Lagi
        </button>
        <Link to="/races"
          className="flex items-center gap-2 px-6 py-3 bg-neutral-800 hover:bg-neutral-700 text-white font-bold rounded-full transition-colors">
          ← Kembali
        </Link>
      </div>
    </div>
  </div>
);

// =======================================================================
// --- KOMPONEN UTAMA HALAMAN DETAIL BALAPAN ---
// =======================================================================

const getTabIcon = (tab, isActive) => {
  const props = { size: 16, className: isActive ? 'text-white' : 'text-neutral-300 group-hover:text-white transition-colors' };
  switch (tab) {
    case 'Race': return <Trophy {...props} />;
    case 'Lap Telemetry': return <Timer {...props} />;
    case 'Race Progression': return <TrendingUp {...props} />;
    case 'Tyre Strategy': return <Wrench {...props} />;
    case 'Speed & Sectors': return <Gauge {...props} />;
    case 'Weather Data': return <Sun {...props} />;
    case 'Practice 1':
    case 'Practice 2':
    case 'Practice 3': return <Activity {...props} />;
    case 'Qualifying':
    case 'Sprint Qualifying': return <Timer {...props} />;
    case 'Starting Grid':
    case 'Sprint Grid': return <LayoutGrid {...props} />;
    case 'Sprint': return <Flag {...props} />;
    case 'Lap Chart': return <Route {...props} />;
    case 'Lap Times': return <Timer {...props} />;
    default: return <List {...props} />;
  }
};

const ALL_POSSIBLE_TABS = [
  'Practice 1', 'Practice 2', 'Practice 3',
  'Sprint Qualifying', 'Sprint Grid', 'Sprint',
  'Qualifying', 'Starting Grid', 'Race', 'Lap Chart',
  'Race Progression', 'Lap Times', 'Tyre Strategy', 'Speed & Sectors', 'Weather Data',
  'Lap Telemetry'
];

function RaceDetailPage() {
  const { year, round } = useParams();
  const navigate = useNavigate();

  const [raceData, setRaceData] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('Race');

  const fetchPageData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [detailsResponse, scheduleResponse] = await Promise.all([
        fetch(`${API_URL}/api/race/${year}/${round}`),
        fetch(`${API_URL}/api/races/${year}`),
      ]);
      if (!detailsResponse.ok) throw new Error('Gagal mengambil detail balapan.');
      if (!scheduleResponse.ok) throw new Error('Gagal mengambil jadwal balapan.');

      const detailsData = await detailsResponse.json();
      const scheduleData = await scheduleResponse.json();
      if (detailsData.error) throw new Error(detailsData.message || detailsData.error);

      setRaceData(detailsData);
      setSchedule(scheduleData);

      const available = detailsData.available_tabs || [];
      if (available.includes('Race')) {
        setActiveTab('Race');
      } else if (available.length > 0) {
        const orderedTabs = ALL_POSSIBLE_TABS.filter(t => available.includes(t));
        setActiveTab(orderedTabs[orderedTabs.length - 1]);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPageData();
  }, [year, round]);

  const handleRaceChange = (event) => {
    navigate(`/race/${year}/${event.target.value}`);
  };

  const SkeletonLoader = () => (
    <div className="bg-neutral-950 min-h-screen text-white font-sans animate-pulse">
      <Navbar />
      <main className="container mx-auto px-6 pt-28 pb-12">
        <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 gap-4">
          <div>
            <div className="h-4 w-40 bg-neutral-800 rounded mb-4"></div>
            <div className="h-12 w-64 md:w-96 bg-neutral-800 rounded"></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="h-10 w-24 bg-neutral-800 rounded"></div>
            <div className="h-10 w-32 bg-neutral-800 rounded"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 h-32">
              <div className="h-4 w-24 bg-neutral-800 rounded mb-4"></div>
              <div className="h-6 w-32 bg-neutral-800 rounded mb-2"></div>
              <div className="h-4 w-48 bg-neutral-800 rounded"></div>
            </div>
          ))}
        </div>
        <div className="h-10 w-full bg-neutral-800 rounded mb-4"></div>
        <div className="h-64 w-full bg-neutral-900 border border-neutral-800 rounded-2xl"></div>
        <div className="mt-4 text-center text-neutral-500">
          Fetching comprehensive F1 data... this might take 1-2 minutes if cache is cold.
        </div>
      </main>
    </div>
  );

  if (loading) return <SkeletonLoader />;

  if (error) return <ErrorState message={error} onRetry={fetchPageData} />;

  const raceWinnerData = raceData?.race_winner
    ? { ...raceData.race_winner, team_name: raceData.results?.[0]?.team_name }
    : null;
  const poleSitterData = raceData?.pole_position
    ? { ...raceData.pole_position, team_name: raceData.qualifying_results?.find(d => d.full_name === raceData.pole_position.full_name)?.team_name }
    : null;
  const fastestLapData = raceData?.fastest_lap;

  const baseAvailableTabs = ALL_POSSIBLE_TABS.filter(tab => raceData?.available_tabs?.includes(tab));
  const availableTabs = [...baseAvailableTabs];
  if (raceData?.lap_chart && !availableTabs.includes('Lap Chart')) availableTabs.push('Lap Chart');
  if (raceData?.gap_chart && !availableTabs.includes('Race Progression')) availableTabs.push('Race Progression');
  if (raceData?.lap_times_chart && !availableTabs.includes('Lap Times')) availableTabs.push('Lap Times');
  if (raceData?.tyre_strategy && !availableTabs.includes('Tyre Strategy')) availableTabs.push('Tyre Strategy');
  if (raceData?.speed_traps && raceData?.sector_matrix && !availableTabs.includes('Speed & Sectors')) availableTabs.push('Speed & Sectors');
  if (raceData?.weather_info && raceData.weather_info.length > 0 && !availableTabs.includes('Weather Data')) availableTabs.push('Weather Data');
  if (!availableTabs.includes('Lap Telemetry')) availableTabs.push('Lap Telemetry');

  const renderActiveTable = () => {
    if (availableTabs.length === 0 || raceData?.status === 'Upcoming') {
      return (
        <div className="p-12 text-center flex flex-col items-center justify-center">
          <Calendar size={48} className="text-red-500 mb-4 opacity-80" />
          <h3 className="text-2xl font-black text-white mb-2">Upcoming Race Weekend</h3>
          <p className="text-neutral-400 max-w-md text-sm">
            {raceData?.message || "Data sesi dan telemetry untuk balapan ini akan tersedia begitu akhir pekan balapan dimulai dan sesi selesai."}
          </p>
        </div>
      );
    }
    const noData = (session) => (
      <div className="p-8 text-center text-neutral-500">Data for {session} is not yet available.</div>
    );
    switch (activeTab) {
      case 'Practice 1':        return raceData?.practice1_results        ? <PracticeResultTable data={raceData.practice1_results} />               : noData('Practice 1');
      case 'Practice 2':        return raceData?.practice2_results        ? <PracticeResultTable data={raceData.practice2_results} />               : noData('Practice 2');
      case 'Practice 3':        return raceData?.practice3_results        ? <PracticeResultTable data={raceData.practice3_results} />               : noData('Practice 3');
      case 'Sprint Qualifying': return raceData?.sprint_qualifying_results ? <SprintQualifyingResultTable data={raceData.sprint_qualifying_results} /> : noData('Sprint Qualifying');
      case 'Sprint Grid':       return raceData?.sprint_grid_results      ? <GridTable data={raceData.sprint_grid_results} />                       : noData('Sprint Grid');
      case 'Sprint':            return raceData?.sprint_results           ? <SprintResultTable data={raceData.sprint_results} />                    : noData('Sprint');
      case 'Qualifying':        return raceData?.qualifying_results       ? <QualifyingResultTable data={raceData.qualifying_results} />            : noData('Qualifying');
      case 'Starting Grid':     return raceData?.starting_grid           ? <GridTable data={raceData.starting_grid} />                             : noData('Starting Grid');
      case 'Race':              return raceData?.results                  ? <RaceResultTable data={raceData.results} />                             : noData('Race');
      case 'Lap Chart':         return raceData?.lap_chart                ? <LapChartComponent lapChart={raceData.lap_chart} results={raceData.results} /> : noData('Lap Chart');
      case 'Race Progression':  return raceData?.gap_chart                ? <GapChartComponent gapChart={raceData.gap_chart} results={raceData.results} /> : noData('Race Progression');
      case 'Lap Times':         return raceData?.lap_times_chart          ? <LapTimesChartComponent lapTimesChart={raceData.lap_times_chart} results={raceData.results} /> : noData('Lap Times');
      case 'Tyre Strategy':     return raceData?.tyre_strategy            ? <TyreStrategyTable tyreData={raceData.tyre_strategy} />                 : noData('Tyre Strategy');
      case 'Speed & Sectors':   return (raceData?.speed_traps && raceData?.sector_matrix) ? <SpeedSectorsTable speedTraps={raceData.speed_traps} sectorMatrix={raceData.sector_matrix} /> : noData('Speed & Sectors');
      case 'Weather Data':      return raceData?.weather_info             ? <WeatherChart weatherData={raceData.weather_info} />                    : noData('Weather Data');
      case 'Lap Telemetry':     return <TelemetryTab year={year} round={round} />;
      default:                  return <div className="p-8 text-center text-neutral-500">Please select a session.</div>;
    }
  };

  const SESSION_TAB_NAMES = [
    'Practice 1', 'Practice 2', 'Practice 3',
    'Sprint Qualifying', 'Sprint Grid', 'Sprint',
    'Qualifying', 'Starting Grid', 'Race'
  ];
  const sessionTabs = availableTabs.filter(t => SESSION_TAB_NAMES.includes(t));
  const telemetryTabs = availableTabs.filter(t => !SESSION_TAB_NAMES.includes(t));

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans relative">
      {/* Backgrounds */}
      <div className="fixed inset-0 bg-[url('https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat opacity-[0.10] pointer-events-none mix-blend-luminosity"></div>
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
      <div className="fixed inset-0 bg-gradient-to-b from-red-900/10 via-neutral-950/80 to-neutral-950 pointer-events-none"></div>

      <Navbar />
      <main className="container mx-auto px-4 md:px-6 pt-28 pb-16 relative z-10">

        {/* Header */}
        <section className="flex flex-col sm:flex-row justify-between sm:items-end mb-10 gap-6 relative">
          <div className="absolute -left-10 -top-10 w-32 h-32 bg-red-500/20 blur-[60px] rounded-full pointer-events-none"></div>
          <div>
            <Link to="/races" className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-400 mb-3 font-bold uppercase tracking-wider transition-colors">
              ← Back to Calendar
            </Link>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic transform -skew-x-6">
              {raceData?.race_info.name}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-sm flex-shrink-0">
            <div className="flex items-center gap-2 py-2.5 px-4 bg-neutral-900/80 backdrop-blur border border-neutral-700/50 rounded-xl font-mono font-bold shadow-lg">
              <Calendar size={16} className="text-red-500" />
              <span className="text-neutral-400">Season</span>
              <span className="text-white">{year}</span>
            </div>
            <select
              onChange={handleRaceChange}
              value={round}
              className="bg-neutral-900/80 backdrop-blur border border-neutral-700/50 py-2.5 px-4 rounded-xl font-bold appearance-none cursor-pointer shadow-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
            >
              {schedule.map(race => (
                <option key={race.round} value={race.round}>{race.location}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Track Map */}
        <section className="mb-10 flex justify-center bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-5 left-6 text-neutral-500 font-black text-xs uppercase tracking-[0.2em]">Circuit Layout</div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-red-500/10 blur-[80px] rounded-full pointer-events-none"></div>
          {getTrackMap(raceData?.race_info) ? (
            <img 
              src={getTrackMap(raceData?.race_info)} 
              alt={`Track map for ${raceData?.race_info?.name || raceData?.race_info?.location}`} 
              className="h-32 md:h-64 object-contain brightness-0 invert opacity-70 transition-all duration-500 hover:opacity-100 hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            />
          ) : (
            <div className="text-neutral-600 italic py-10 font-bold">
              Track map not available for {raceData?.race_info?.location || raceData?.race_info?.name}.
            </div>
          )}
        </section>

        {/* Summary Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-10">
          <SummaryCard title="Race Winner"  icon={<Trophy size={20} />}          data={raceWinnerData} />
          <SummaryCard title="Pole Position" icon={<GitCommitVertical size={20} />} data={poleSitterData} />
          <SummaryCard title="Fastest Lap"  icon={<Clock size={20} />}           data={fastestLapData} />
        </section>

        {/* Session Tabs */}
        {sessionTabs.length > 0 && (
          <section className="mb-5">
            <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2.5 ml-2">Official Sessions</h3>
            <div className="flex items-center gap-2 p-2 bg-neutral-900/60 backdrop-blur-md border border-neutral-800/80 rounded-2xl overflow-x-auto no-scrollbar shadow-xl">
              {sessionTabs.map(tab => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`group flex items-center gap-2 py-2.5 px-5 text-sm font-bold uppercase tracking-wider whitespace-nowrap rounded-lg transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]'
                        : 'text-neutral-400 hover:bg-neutral-800/80 hover:text-white'
                    }`}
                  >
                    {getTabIcon(tab, isActive)}
                    {tab}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Telemetry Tabs */}
        {telemetryTabs.length > 0 && (
          <section className="mb-8">
            <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2.5 ml-2">Data & Telemetry</h3>
            <div className="flex items-center gap-2 p-2 bg-neutral-900/60 backdrop-blur-md border border-neutral-800/80 rounded-2xl overflow-x-auto no-scrollbar shadow-xl">
              {telemetryTabs.map(tab => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`group flex items-center gap-2 py-2.5 px-5 text-sm font-bold uppercase tracking-wider whitespace-nowrap rounded-lg transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]'
                        : 'text-neutral-400 hover:bg-neutral-800/80 hover:text-white'
                    }`}
                  >
                    {getTabIcon(tab, isActive)}
                    {tab}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Result Table */}
        <div className="bg-neutral-900/40 backdrop-blur-xl border border-neutral-800/80 shadow-2xl rounded-3xl overflow-hidden mb-12">
          {renderActiveTable()}
        </div>
      </main>
    </div>
  );
}

export default RaceDetailPage;

