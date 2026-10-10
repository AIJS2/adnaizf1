// src/DriverComparePage - Ultimate Driver vs Driver H2H Comparator
// Major UI/UX overhaul with contextual icons & polished design

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDriverProfile } from '../services/api';
import { Link, useSearchParams } from 'react-router-dom';
import { API_URL } from '../config';
import { teamColors, teamLogos } from '../data/teamData';
import {
  Swords, Trophy, Medal, Target, ArrowLeftRight, TrendingUp,
  Flag, AlertTriangle, Loader2, CheckCircle2,
  Download, Hash, Gauge, Crown, CircleDot, Crosshair,
  BarChart3, GitCompareArrows, Shield, Star, Flame, Minus,
  User, Users, MapPin, Scale, Award, Sparkles
} from 'lucide-react';
import {
  XAxis, YAxis, CartesianGrid,
  Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart
} from 'recharts';
import type { LucideIcon } from 'lucide-react';
import type { NumericString, DriverProfile } from '../types/f1';
import type { ChampionshipPayload } from '../services/api';
import html2canvas from 'html2canvas';
import DriverRadarChart from '../components/DriverRadarChart';

/** One row of the head-to-head comparison bars in the Overview tab. */
interface MetricConfig {
  key: string;
  label: string;
  icon: LucideIcon;
  iconColor: string;
  val1?: NumericString | null;
  val2?: NumericString | null;
  unit?: string;
  format?: (v: NumericString | null | undefined) => string;
  /** When true the lower value is the better one (best/avg finishing position). */
  invert?: boolean;
}

/** One merged round of the two drivers' progression arrays. */
interface MergedProgressionRow {
  round: number;
  race_name: string;
  location: string;
  d1_points: NumericString;
  d1_cum: NumericString;
  d1_pos: NumericString;
  d2_points: NumericString;
  d2_cum: NumericString;
  d2_pos: NumericString;
  winner: string | null;
}

const DriverComparePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentYear = new Date().getFullYear();

  // No hardcoded fallback drivers: a name like 'charles_leclerc' is not
  // guaranteed to exist in the current season, so the initial state is empty
  // and the effect below fills in driversList[0] / driversList[1] once the
  // championship payload actually arrives.
  const [driver1Id, setDriver1Id] = useState(searchParams.get('d1') || '');
  const [driver2Id, setDriver2Id] = useState(searchParams.get('d2') || '');

    
      const [activeTab, setActiveTab] = useState('overview');

  
  // 1. Fetch available drivers list
  const { data: championshipData } = useQuery<ChampionshipPayload>({
    queryKey: ['championship', currentYear],
    queryFn: () => fetch(`${API_URL}/api/championship/${currentYear}`).then(r => r.json()),
  });

  const driversList: DriverProfile[] = championshipData?.drivers || [];

  useEffect(() => {
    if (driversList.length === 0) return;

    const validIds = new Set(driversList.map(d => d.id).filter((id): id is string => !!id));

    // Only seed defaults when the URL does not already pin a driver.
    if (!searchParams.get('d1') && driversList[0]?.id) setDriver1Id(driversList[0].id);
    if (!searchParams.get('d2') && driversList[1]?.id) setDriver2Id(driversList[1].id);

    // A URL-pinned driver that no longer races this season would 404 forever,
    // so fall back to the list defaults in that case too.
    const pinned1 = searchParams.get('d1');
    const pinned2 = searchParams.get('d2');
    if (pinned1 && !validIds.has(pinned1) && driversList[0]?.id) setDriver1Id(driversList[0].id);
    if (pinned2 && !validIds.has(pinned2) && driversList[1]?.id) setDriver2Id(driversList[1].id);
  }, [driversList, searchParams]);

  // 2. Fetch both driver profiles using useQuery
  const { data: profile1, isLoading: loading1, error: error1 } = useQuery({
    queryKey: ['driverProfile', currentYear, driver1Id],
    queryFn: () => fetchDriverProfile(currentYear, driver1Id),
    enabled: !!driver1Id,
  });

  const { data: profile2, isLoading: loading2, error: error2 } = useQuery({
    queryKey: ['driverProfile', currentYear, driver2Id],
    queryFn: () => fetchDriverProfile(currentYear, driver2Id),
    enabled: !!driver2Id,
  });

  const loading = loading1 || loading2;
  const error = error1 ? error1.message : error2 ? error2.message : null;

  useEffect(() => {
    if (driver1Id && driver2Id) {
      setSearchParams({ d1: driver1Id, d2: driver2Id });
    }
  }, [driver1Id, driver2Id]);

  const handleSwap = () => {
    const temp = driver1Id;
    setDriver1Id(driver2Id);
    setDriver2Id(temp);
  };

  const d1Color = profile1 ? (teamColors[profile1.team] || '#EF4444') : '#EF4444';
  let d2Color = profile2 ? (teamColors[profile2.team] || '#3B82F6') : '#3B82F6';
  if (profile1 && profile2 && d1Color.toLowerCase() === d2Color.toLowerCase()) {
    d2Color = '#FACC15';
  }

  const handleExportPNG = async () => {
    const el = document.getElementById('h2h-card');
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { backgroundColor: '#0a0a0a', scale: 2 });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `H2H_${profile1?.name}_vs_${profile2?.name}.png`;
      link.click();
    } catch (err: unknown) {
      console.error('Export failed', err);
    }
  };

  // Calculate Head-to-Head shared finish races
  const { d1Ahead, d2Ahead, sharedRaces, mergedProgression } = useMemo(() => {
    let d1A = 0, d2A = 0, shared = 0;
    const merged: MergedProgressionRow[] = [];

    if (profile1?.progression && profile2?.progression) {
      const p1Map = new Map(profile1.progression.map(r => [r.round, r]));
      const p2Map = new Map(profile2.progression.map(r => [r.round, r]));
      const allRounds = Array.from(new Set([...p1Map.keys(), ...p2Map.keys()])).sort((a, b) => a - b);

      for (const rnd of allRounds) {
        const r1 = p1Map.get(rnd);
        const r2 = p2Map.get(rnd);
        let winner: string | null = null;
        if (r1 && r2) {
          shared++;
          const pos1 = typeof r1.position === 'number' ? r1.position : 999;
          const pos2 = typeof r2.position === 'number' ? r2.position : 999;
          if (pos1 < pos2) { d1A++; winner = profile1.name; }
          else if (pos2 < pos1) { d2A++; winner = profile2.name; }
        }
        merged.push({
          round: rnd,
          race_name: r1?.race_name || r2?.race_name || `Round ${rnd}`,
          location: r1?.location || r2?.location || '',
          d1_points: r1?.points || 0,
          d1_cum: r1?.cumulative_points || 0,
          d1_pos: r1?.position ?? '-',
          d2_points: r2?.points || 0,
          d2_cum: r2?.cumulative_points || 0,
          d2_pos: r2?.position ?? '-',
          winner
        });
      }
    }
    return { d1Ahead: d1A, d2Ahead: d2A, sharedRaces: shared, mergedProgression: merged };
  }, [profile1, profile2]);

  // Metric config with contextual icons
  const metricConfigs = useMemo<MetricConfig[]>(() => [
    { key: 'points', label: 'Championship Points', icon: Star, iconColor: 'text-yellow-400', val1: profile1?.points, val2: profile2?.points, unit: ' PTS' },
    { key: 'wins', label: 'Race Wins', icon: Trophy, iconColor: 'text-yellow-500', val1: profile1?.wins, val2: profile2?.wins },
    { key: 'podiums', label: 'Podium Finishes', icon: Medal, iconColor: 'text-amber-400', val1: profile1?.podiums, val2: profile2?.podiums },
    { key: 'poles', label: 'Pole Positions', icon: Crosshair, iconColor: 'text-purple-400', val1: profile1?.poles, val2: profile2?.poles },
    { key: 'best', label: 'Best Finish', icon: Crown, iconColor: 'text-emerald-400', val1: profile1?.best_finish, val2: profile2?.best_finish, format: v => v ? `P${v}` : '-', invert: true },
    { key: 'avg', label: 'Average Finish', icon: Target, iconColor: 'text-blue-400', val1: profile1?.avg_finish, val2: profile2?.avg_finish, format: v => v ? `P${v}` : '-', invert: true },
  ], [profile1, profile2]);

  const renderComparisonBar = (metric: MetricConfig) => {
    const { label, icon: Icon, iconColor, val1, val2, unit = '', format, invert } = metric;
    const displayVal1 = format ? format(val1) : val1;
    const displayVal2 = format ? format(val2) : val2;
    const num1 = Number(val1) || 0;
    const num2 = Number(val2) || 0;
    const total = num1 + num2;

    const d1IsBetter = invert ? (num1 > 0 && (num2 === 0 || num1 < num2)) : num1 > num2;
    const d2IsBetter = invert ? (num2 > 0 && (num1 === 0 || num2 < num1)) : num2 > num1;
    const pct1 = total > 0 ? (num1 / total) * 100 : 50;

    return (
      <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4 shadow-sm hover:border-neutral-700 transition-colors">
        <div className="flex justify-between items-center text-xs mb-2">
          <span className={`font-black text-sm font-mono ${d1IsBetter ? 'text-white' : 'text-neutral-500'}`}>
            {displayVal1}{!format && unit}
            {d1IsBetter && <Flame size={12} className="inline ml-1 text-orange-400" />}
          </span>
          <span className="text-neutral-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
            <Icon size={13} className={iconColor} />
            {label}
          </span>
          <span className={`font-black text-sm font-mono ${d2IsBetter ? 'text-white' : 'text-neutral-500'}`}>
            {d2IsBetter && <Flame size={12} className="inline mr-1 text-orange-400" />}
            {displayVal2}{!format && unit}
          </span>
        </div>
        <div className="w-full bg-neutral-800 rounded-full h-2.5 overflow-hidden flex">
          <div className="h-full transition-all duration-700 rounded-l-full" style={{ width: `${pct1}%`, backgroundColor: d1Color }} />
          <div className="h-full transition-all duration-700 rounded-r-full" style={{ width: `${100 - pct1}%`, backgroundColor: d2Color }} />
        </div>
      </div>
    );
  };

  // Tabs
  const tabs = [
    { key: 'overview', label: 'Overview', icon: BarChart3 },
    { key: 'chart', label: 'Points Chart', icon: TrendingUp },
    { key: 'h2h', label: 'Race H2H', icon: Swords },
  ];

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans selection:bg-red-600 relative">
      {/* Backgrounds */}
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay" />
      <div className="fixed inset-0 bg-gradient-to-b from-neutral-950 via-neutral-950/95 to-neutral-950 pointer-events-none" />

      
      <main className="container mx-auto px-4 md:px-6 pt-28 pb-16 relative z-10">

        {/* Page Header */}
        <section className="mb-8 relative">
          <div className="absolute -left-10 -top-10 w-40 h-40 bg-red-500/15 blur-[70px] rounded-full pointer-events-none" />
          <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3">
            <Swords size={14} /> Head-to-Head Battle &bull; Season {currentYear}
          </div>
          <h1 className="text-4xl md:text-6xl font-black tracking-tighter text-white flex items-center gap-3 italic transform -skew-x-3">
            <GitCompareArrows className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" size={48} />
            Driver <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 pr-2">Duel</span>
          </h1>
          <p className="text-neutral-400 mt-2 text-sm md:text-base max-w-xl">
            Pit any two F1 drivers against each other. Compare season stats, race-by-race finishes, and points trajectory.
          </p>
        </section>

        {/* Controls: Pick 2 Drivers */}
        <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-5 md:p-6 shadow-2xl mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            {/* Driver 1 Selector */}
            <div className="w-full md:w-5/12">
              <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">
                <User size={12} className="text-red-400" /> Driver 1
              </label>
              <select
                value={driver1Id}
                onChange={(e) => setDriver1Id(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none transition-all hover:border-neutral-600 cursor-pointer"
                style={{ borderLeftWidth: '5px', borderLeftColor: d1Color }}
              >
                {driversList.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.team}) - P{d.position} ({Math.round(Number(d.points) || 0)} PTS)
                  </option>
                ))}
              </select>
            </div>

            {/* Swap Button */}
            <button
              onClick={handleSwap}
              title="Swap Drivers"
              className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 border border-neutral-700 hover:border-neutral-500 flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 flex-shrink-0 shadow-lg hover:shadow-xl group"
            >
              <ArrowLeftRight size={20} className="group-hover:rotate-180 transition-transform duration-300" />
            </button>

            {/* Driver 2 Selector */}
            <div className="w-full md:w-5/12">
              <label className="flex items-center gap-1.5 text-xs font-bold text-neutral-400 mb-2 uppercase tracking-wider">
                <User size={12} className="text-blue-400" /> Driver 2
              </label>
              <select
                value={driver2Id}
                onChange={(e) => setDriver2Id(e.target.value)}
                className="w-full bg-neutral-950 border border-neutral-700 text-white rounded-xl p-3.5 text-sm font-bold focus:ring-2 focus:ring-red-500 outline-none transition-all hover:border-neutral-600 cursor-pointer"
                style={{ borderLeftWidth: '5px', borderLeftColor: d2Color }}
              >
                {driversList.map(d => (
                  <option key={d.id} value={d.id}>
                    {d.name} ({d.team}) - P{d.position} ({Math.round(Number(d.points) || 0)} PTS)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Quick same-team toggle hint */}
          {profile1 && profile2 && profile1.team === profile2.team && (
            <div className="mt-4 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
              <Users size={14} /> Teammate battle! Both drivers race for <span className="font-bold">{profile1.team}</span>
            </div>
          )}
        </section>

        {error && (
          <div className="bg-red-950/40 border border-red-500/50 text-red-400 p-5 rounded-2xl mb-8 flex items-center gap-3">
            <AlertTriangle size={24} className="flex-shrink-0" />
            <span className="font-semibold text-sm">{error}</span>
          </div>
        )}

        {loading && (
          <div className="bg-neutral-900/40 border border-neutral-800 rounded-3xl p-16 flex flex-col items-center justify-center min-h-[40vh] mb-8">
            <Loader2 className="animate-spin text-red-500 mb-4" size={48} />
            <h3 className="text-xl font-bold text-white flex items-center gap-2">
              <Swords size={20} className="text-red-400" /> Analyzing Battle Data...
            </h3>
            <p className="text-xs text-neutral-500 mt-2">Computing race finish battles & season trajectories</p>
          </div>
        )}

        {/* COMPARISON RESULTS */}
        {profile1 && profile2 && !loading && (
          <div className="space-y-6">
            
            {/* Export + Tabs Row */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {tabs.map(t => (
                  <button key={t.key} onClick={() => setActiveTab(t.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200
                      ${activeTab === t.key
                        ? 'bg-red-600/90 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)] border border-red-500'
                        : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600'
                      }`}>
                    <t.icon size={14} />
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleExportPNG}
                className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg border border-neutral-700 hover:border-neutral-600 uppercase tracking-wider"
              >
                <Download size={14} /> Export PNG
              </button>
            </div>

            <div id="h2h-card" className="space-y-6 p-4 md:p-6 bg-neutral-950/90 rounded-3xl">

              {/* 1. FIGHTER BANNER (HERO CARDS) — Always visible */}
              <div className="grid grid-cols-1 md:grid-cols-11 gap-4 items-stretch">
                
                {/* Driver 1 Card */}
                <div
                  className="md:col-span-5 bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden group"
                  style={{ borderLeftWidth: '6px', borderLeftColor: d1Color }}
                >
                  {/* Big number watermark */}
                  <div className="absolute right-4 -bottom-6 text-[8rem] font-black opacity-[0.04] pointer-events-none select-none font-mono leading-none" style={{ color: d1Color }}>
                    {profile1.driver_number}
                  </div>
                  {/* Glow */}
                  <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[60px] opacity-10 pointer-events-none" style={{ backgroundColor: d1Color }} />
                  
                  <div className="flex items-center gap-3 mb-3">
                    {teamLogos[profile1.team] && <img src={teamLogos[profile1.team]} alt={profile1.team} className="h-5 w-auto object-contain opacity-70" />}
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">{profile1.team}</span>
                    <span className="font-mono text-xs font-bold bg-neutral-800 px-2 py-0.5 rounded text-neutral-300 flex items-center gap-1">
                      <Hash size={10} />{profile1.driver_number}
                    </span>
                  </div>
                  <Link to={`/driver/${profile1.id}`} className="block group-hover:text-red-400 transition-colors">
                    <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{profile1.name}</h2>
                  </Link>
                  <div className="mt-5 flex items-center gap-3">
                    <div className="bg-neutral-950/80 border border-neutral-800 px-4 py-2.5 rounded-2xl">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold flex items-center gap-1"><Shield size={10} /> Championship</span>
                      <span className="text-2xl font-black font-mono text-white">P{profile1.position}</span>
                    </div>
                    <div className="bg-neutral-950/80 border border-neutral-800 px-4 py-2.5 rounded-2xl">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold flex items-center gap-1"><Star size={10} /> Points</span>
                      <span className="text-2xl font-black font-mono" style={{ color: d1Color }}>{Math.round(Number(profile1.points) || 0)}</span>
                    </div>
                    <div className="bg-neutral-950/80 border border-neutral-800 px-4 py-2.5 rounded-2xl">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold flex items-center gap-1"><Trophy size={10} /> Wins</span>
                      <span className="text-2xl font-black font-mono text-white">{profile1.wins || 0}</span>
                    </div>
                  </div>
                </div>

                {/* VS Center Badge */}
                <div className="md:col-span-1 flex flex-col items-center justify-center text-center py-2">
                  <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-red-600 to-orange-500 font-black text-white flex items-center justify-center shadow-lg shadow-red-600/30 text-base font-mono tracking-tighter relative">
                    <Swords size={22} />
                    <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                  </div>
                  <div className="mt-3 text-center">
                    <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider block">Race H2H</span>
                    <div className="font-mono font-black text-base mt-0.5 flex items-center gap-1 justify-center">
                      <span style={{ color: d1Color }}>{d1Ahead}</span>
                      <Minus size={12} className="text-neutral-600" />
                      <span style={{ color: d2Color }}>{d2Ahead}</span>
                    </div>
                  </div>
                </div>

                {/* Driver 2 Card */}
                <div
                  className="md:col-span-5 bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden group text-right md:text-left"
                  style={{ borderRightWidth: '6px', borderRightColor: d2Color }}
                >
                  <div className="absolute left-4 -bottom-6 text-[8rem] font-black opacity-[0.04] pointer-events-none select-none font-mono leading-none" style={{ color: d2Color }}>
                    {profile2.driver_number}
                  </div>
                  <div className="absolute -left-10 -top-10 w-32 h-32 rounded-full blur-[60px] opacity-10 pointer-events-none" style={{ backgroundColor: d2Color }} />
                  
                  <div className="flex items-center gap-3 mb-3 justify-end md:justify-start">
                    {teamLogos[profile2.team] && <img src={teamLogos[profile2.team]} alt={profile2.team} className="h-5 w-auto object-contain opacity-70" />}
                    <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">{profile2.team}</span>
                    <span className="font-mono text-xs font-bold bg-neutral-800 px-2 py-0.5 rounded text-neutral-300 flex items-center gap-1">
                      <Hash size={10} />{profile2.driver_number}
                    </span>
                  </div>
                  <Link to={`/driver/${profile2.id}`} className="block group-hover:text-red-400 transition-colors">
                    <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{profile2.name}</h2>
                  </Link>
                  <div className="mt-5 flex items-center gap-3 justify-end md:justify-start">
                    <div className="bg-neutral-950/80 border border-neutral-800 px-4 py-2.5 rounded-2xl">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold flex items-center gap-1"><Shield size={10} /> Championship</span>
                      <span className="text-2xl font-black font-mono text-white">P{profile2.position}</span>
                    </div>
                    <div className="bg-neutral-950/80 border border-neutral-800 px-4 py-2.5 rounded-2xl">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold flex items-center gap-1"><Star size={10} /> Points</span>
                      <span className="text-2xl font-black font-mono" style={{ color: d2Color }}>{Math.round(Number(profile2.points) || 0)}</span>
                    </div>
                    <div className="bg-neutral-950/80 border border-neutral-800 px-4 py-2.5 rounded-2xl">
                      <span className="text-[10px] text-neutral-500 uppercase font-bold flex items-center gap-1"><Trophy size={10} /> Wins</span>
                      <span className="text-2xl font-black font-mono text-white">{profile2.wins || 0}</span>
                    </div>
                  </div>
                </div>

              </div>

              {/* 2. OVERVIEW TAB - STATISTICAL BENCHMARK BARS */}
              {activeTab === 'overview' && (
                <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                    <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                      <Scale size={20} className="text-cyan-400" />
                      Performance Comparison
                    </h3>
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <span className="flex items-center gap-1.5"><CircleDot size={10} style={{ color: d1Color }} /> {profile1.name}</span>
                      <span className="flex items-center gap-1.5"><CircleDot size={10} style={{ color: d2Color }} /> {profile2.name}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    {/* Radar Chart */}
                    <div className="w-full">
                      <DriverRadarChart profile1={profile1} profile2={profile2} />
                    </div>

                    {/* Comparison Bars */}
                    <div className="space-y-4">
                      {metricConfigs.map(m => (
                        <div key={m.key}>{renderComparisonBar(m)}</div>
                      ))}
                    </div>
                  </div>

                  {/* H2H Summary Scoreboard */}
                  <div className="mt-6 bg-neutral-950/70 border border-neutral-800 rounded-2xl p-5">
                    <div className="flex items-center justify-between">
                      <div className="text-center flex-1">
                        <div className="text-3xl font-black font-mono" style={{ color: d1Color }}>{d1Ahead}</div>
                        <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mt-1">
                          {profile1.name.split(' ').pop()} Wins
                        </div>
                      </div>
                      <div className="text-center px-6">
                        <div className="flex items-center gap-2">
                          <Swords size={18} className="text-red-500" />
                          <span className="text-sm font-bold text-neutral-400 uppercase tracking-wider">Race Battles</span>
                        </div>
                        <div className="text-xs text-neutral-600 mt-1">{sharedRaces} shared races</div>
                      </div>
                      <div className="text-center flex-1">
                        <div className="text-3xl font-black font-mono" style={{ color: d2Color }}>{d2Ahead}</div>
                        <div className="text-[10px] text-neutral-500 uppercase font-bold tracking-wider mt-1">
                          {profile2.name.split(' ').pop()} Wins
                        </div>
                      </div>
                    </div>
                    {/* H2H visual bar */}
                    <div className="mt-4 w-full h-3 bg-neutral-800 rounded-full overflow-hidden flex">
                      <div className="h-full rounded-l-full transition-all duration-700" style={{ width: `${sharedRaces > 0 ? (d1Ahead / sharedRaces) * 100 : 50}%`, backgroundColor: d1Color }} />
                      <div className="h-full rounded-r-full transition-all duration-700" style={{ width: `${sharedRaces > 0 ? (d2Ahead / sharedRaces) * 100 : 50}%`, backgroundColor: d2Color }} />
                    </div>
                  </div>
                </section>
              )}

              {/* 3. CHART TAB - DUAL POINTS PROGRESSION */}
              {activeTab === 'chart' && (
                <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                        <TrendingUp size={20} className="text-emerald-400" />
                        Points Trajectory Duel
                      </h3>
                      <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5">
                        <Sparkles size={12} className="text-neutral-500" /> Round-by-round cumulative championship points
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <span className="flex items-center gap-1.5"><CircleDot size={10} style={{ color: d1Color }} /> {profile1.name}</span>
                      <span className="flex items-center gap-1.5"><CircleDot size={10} style={{ color: d2Color }} /> {profile2.name}</span>
                    </div>
                  </div>

                  <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mergedProgression} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorD1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={d1Color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={d1Color} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorD2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={d2Color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={d2Color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                        <XAxis dataKey="location" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: 'rgba(15,15,15,0.95)', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                          formatter={(val, name) => [`${val} PTS`, name]}
                          labelFormatter={(loc, items) => {
                            const row = items?.[0]?.payload;
                            return row ? `${row.race_name} (${row.location})` : loc;
                          }}
                        />
                        <Area type="monotone" dataKey="d1_cum" name={profile1.name} stroke={d1Color} strokeWidth={3} fill="url(#colorD1)" dot={{ r: 4, fill: d1Color, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
                        <Area type="monotone" dataKey="d2_cum" name={profile2.name} stroke={d2Color} strokeWidth={3} fill="url(#colorD2)" dot={{ r: 4, fill: d2Color, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              {/* 4. H2H TAB - RACE BY RACE CLASH TABLE */}
              {activeTab === 'h2h' && (
                <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                        <Flag size={20} className="text-red-500" />
                        Grand Prix Battle Log
                      </h3>
                      <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5">
                        <Gauge size={12} className="text-neutral-500" /> {sharedRaces} shared race weekends analyzed
                      </p>
                    </div>
                    <div className="flex items-center gap-2 font-mono text-xs font-bold">
                      <span className="px-3 py-1.5 rounded-full border flex items-center gap-1.5" style={{ borderColor: d1Color + '40', backgroundColor: d1Color + '10', color: d1Color }}>
                        <Crown size={12} /> {d1Ahead}
                      </span>
                      <span className="text-neutral-600">vs</span>
                      <span className="px-3 py-1.5 rounded-full border flex items-center gap-1.5" style={{ borderColor: d2Color + '40', backgroundColor: d2Color + '10', color: d2Color }}>
                        <Crown size={12} /> {d2Ahead}
                      </span>
                    </div>
                  </div>

                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-neutral-950/80 text-neutral-400 text-xs uppercase font-semibold text-left">
                        <tr>
                          <th className="p-4 w-12 text-center"><Hash size={12} className="inline" /></th>
                          <th className="p-4"><MapPin size={12} className="inline mr-1" /> Grand Prix</th>
                          <th className="p-4 text-center" style={{ color: d1Color }}>{profile1.name.split(' ').pop()}</th>
                          <th className="p-4 text-center" style={{ color: d2Color }}>{profile2.name.split(' ').pop()}</th>
                          <th className="p-4 text-right"><Award size={12} className="inline mr-1" /> Verdict</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-800/60 font-mono">
                        {mergedProgression.map((row) => (
                          <tr key={row.round} className="hover:bg-neutral-800/30 transition-colors">
                            <td className="p-4 text-center text-neutral-600 font-bold text-xs">{row.round}</td>
                            <td className="p-4 font-sans">
                              <div className="font-bold text-white text-sm">{row.race_name}</div>
                              <div className="text-xs text-neutral-500 font-normal flex items-center gap-1 mt-0.5">
                                <MapPin size={10} /> {row.location}
                              </div>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`font-black ${row.winner === profile1.name ? 'text-white' : 'text-neutral-500'}`}>
                                {typeof row.d1_pos === 'number' ? `P${row.d1_pos}` : row.d1_pos}
                              </span>
                              <span className="text-xs text-neutral-600 ml-1.5">(+{row.d1_points})</span>
                            </td>
                            <td className="p-4 text-center">
                              <span className={`font-black ${row.winner === profile2.name ? 'text-white' : 'text-neutral-500'}`}>
                                {typeof row.d2_pos === 'number' ? `P${row.d2_pos}` : row.d2_pos}
                              </span>
                              <span className="text-xs text-neutral-600 ml-1.5">(+{row.d2_points})</span>
                            </td>
                            <td className="p-4 text-right font-sans">
                              {row.winner === profile1.name && (
                                <span
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
                                  style={{ backgroundColor: `${d1Color}15`, color: d1Color }}
                                >
                                  <CheckCircle2 size={12} /> {profile1.name.split(' ').pop()}
                                </span>
                              )}
                              {row.winner === profile2.name && (
                                <span
                                  className="inline-flex items-center gap-1 px-3 py-1 rounded-full text-xs font-bold"
                                  style={{ backgroundColor: `${d2Color}15`, color: d2Color }}
                                >
                                  <CheckCircle2 size={12} /> {profile2.name.split(' ').pop()}
                                </span>
                              )}
                              {!row.winner && (
                                <span className="text-xs text-neutral-600 font-normal flex items-center gap-1 justify-end">
                                  <Minus size={12} /> Draw
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </section>
              )}
            </div>

          </div>
        )}

      </main>
    </div>
  );
};

export default DriverComparePage;
