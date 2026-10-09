// src/DashboardPage.jsx - Next-Gen F1 Telemetry & Championship Dashboard

import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { fetchDashboardData } from '../services/api';

import ErrorState from '../components/layout/ErrorState';
import { Link } from 'react-router-dom';
import { 
  Trophy, Calendar, Clock, ChevronRight, AlertTriangle, RefreshCw, 
  ArrowUp, Flag, Gauge, Zap, TrendingUp, Users, Activity, Award, MapPin, Calculator, Swords, Crown, Target, Shield, Flame,
  FlaskConical, FlagTriangleRight
} from 'lucide-react';
import { API_URL } from '../config';
import { teamLogos, teamColors } from '../data/teamData';
import { getTrackMap } from '../data/trackData';
import HeroCountdown from '../components/ui/HeroCountdown';
import TeamCard from '../components/dashboard/TeamCard';
import DriverStandingsList from '../components/dashboard/DriverStandingsList';
import RaceAnalyticsCard from '../components/dashboard/RaceAnalyticsCard';





// =======================================================================
// --- MAIN DASHBOARD PAGE ---
// =======================================================================
function DashboardPage() {
  
  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;

  const { data, error, isLoading: loading, refetch } = useQuery({
    queryKey: ['dashboard', currentYear],
    queryFn: async () => {
      let dataCurrent = await fetchDashboardData(currentYear);
      if (dataCurrent.status === "pre_season" || (dataCurrent.driver_standings && dataCurrent.driver_standings.length === 0)) {
        let dataPrev = await fetchDashboardData(prevYear);
        return { ...dataPrev, year: prevYear, next_race_event: dataCurrent.next_race_event };
      }
      return dataCurrent;
    }
  });
  
  const dashboardData = data;


  if (loading) {
    return (
      <div className="bg-neutral-950 min-h-screen text-white font-sans">
        
        <main className="container mx-auto px-4 md:px-6 pt-28 pb-16">
          <div className="animate-pulse space-y-6">
            <div className="h-64 md:h-80 bg-neutral-900/60 border border-neutral-800 rounded-3xl w-full"></div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[400px] bg-neutral-900/60 border border-neutral-800 rounded-3xl w-full"></div>
              <div className="h-[400px] bg-neutral-900/60 border border-neutral-800 rounded-3xl w-full"></div>
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={refetch} />;

  // Derived Values
  const upcomingRace = dashboardData?.race_analytics?.find(r => r.status === 'Upcoming') || dashboardData?.race_analytics?.[dashboardData.race_analytics.length - 1];
  const finishedRaces = dashboardData?.race_analytics?.filter(r => r.status === 'Finished') || [];
  const lastRace = finishedRaces.length > 0 ? finishedRaces[finishedRaces.length - 1] : null;

  const p1Driver = dashboardData?.driver_standings?.[0];
  const p2Driver = dashboardData?.driver_standings?.[1];
  const p1Team = dashboardData?.team_standings?.[0];

  const targetCountdownDate = dashboardData?.next_race_event?.date || (upcomingRace ? `${upcomingRace.date}T13:00:00Z` : null);
  const trackMapImg = getTrackMap(upcomingRace || { name: dashboardData?.next_race_event?.name });

  const maxTeamPoints = dashboardData?.team_standings?.length > 0 ? Math.max(...dashboardData.team_standings.map(t => t.points)) : 1;
  

  // Title Fight gap calculation
  const titleGap = (p1Driver && p2Driver) ? Math.round(p1Driver.points - p2Driver.points) : 0;
  const totalDuelPoints = (p1Driver && p2Driver) ? (p1Driver.points + p2Driver.points) : 1;
  const p1DuelPct = (p1Driver && p2Driver) ? Math.round((p1Driver.points / totalDuelPoints) * 100) : 50;

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans selection:bg-red-600">
      
      <main className="container mx-auto px-4 md:px-6 pt-28 pb-16">

        {/* 1. SEASON PULSE BAR */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-8">
          <div className="relative overflow-hidden bg-neutral-900/60 hover:bg-neutral-900/80 border border-neutral-800/80 hover:border-red-500/50 rounded-2xl p-4 flex items-center gap-3.5 backdrop-blur-xl shadow-lg hover:shadow-[0_0_25px_rgba(239,68,68,0.15)] transition-all duration-300 group cursor-default">
            <div className="absolute top-0 right-0 w-24 h-24 bg-red-500/5 rounded-full blur-2xl group-hover:bg-red-500/10 transition-colors pointer-events-none" />
            <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] transition-all">
              <Calendar size={18} />
            </div>
            <div className="min-w-0 relative z-10">
              <span className="text-[10px] uppercase font-black tracking-widest text-neutral-500 block group-hover:text-red-400 transition-colors">Season Calendar</span>
              <p className="text-sm font-black text-white truncate drop-shadow-md">
                {lastRace ? <>{lastRace.round} <span className="text-neutral-500 font-medium">/ {dashboardData?.total_races || 24}</span> Races</> : `${dashboardData?.year} FIA F1 Season`}
              </p>
              {lastRace && <p className="text-[10px] text-neutral-400 mt-0.5 truncate group-hover:text-red-300/80 transition-colors">Next: {upcomingRace?.name || 'End of Season'}</p>}
            </div>
          </div>

          <div className="relative overflow-hidden bg-neutral-900/60 hover:bg-neutral-900/80 border border-neutral-800/80 hover:border-yellow-500/50 rounded-2xl p-4 flex items-center gap-3.5 backdrop-blur-xl shadow-lg hover:shadow-[0_0_25px_rgba(234,179,8,0.15)] transition-all duration-300 group cursor-default">
            <div className="absolute top-0 right-0 w-24 h-24 bg-yellow-500/5 rounded-full blur-2xl group-hover:bg-yellow-500/10 transition-colors pointer-events-none" />
            <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-500 flex-shrink-0 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(234,179,8,0.4)] transition-all">
              <Crown size={18} />
            </div>
            <div className="min-w-0 relative z-10">
              <span className="text-[10px] uppercase font-black tracking-widest text-neutral-500 block group-hover:text-yellow-500 transition-colors">Drivers Leader</span>
              <p className="text-sm font-black text-white truncate drop-shadow-md">
                {p1Driver ? `${p1Driver.name} (${parseInt(p1Driver.points)} PTS)` : '-'}
              </p>
              {p2Driver && <p className="text-[10px] text-neutral-400 mt-0.5 truncate group-hover:text-yellow-400/80 transition-colors">+{parseInt(p1Driver.points - p2Driver.points)} PTS ahead of {p2Driver.name.split(' ').pop()}</p>}
            </div>
          </div>

          <div className="relative overflow-hidden bg-neutral-900/60 hover:bg-neutral-900/80 border border-neutral-800/80 hover:border-cyan-500/50 rounded-2xl p-4 flex items-center gap-3.5 backdrop-blur-xl shadow-lg hover:shadow-[0_0_25px_rgba(6,182,212,0.15)] transition-all duration-300 group cursor-default">
            <div className="absolute top-0 right-0 w-24 h-24 bg-cyan-500/5 rounded-full blur-2xl group-hover:bg-cyan-500/10 transition-colors pointer-events-none" />
            <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 flex-shrink-0 group-hover:scale-110 group-hover:rotate-3 group-hover:shadow-[0_0_15px_rgba(6,182,212,0.4)] transition-all">
              <Shield size={18} />
            </div>
            <div className="min-w-0 relative z-10">
              <span className="text-[10px] uppercase font-black tracking-widest text-neutral-500 block group-hover:text-cyan-400 transition-colors">Constructors Leader</span>
              <p className="text-sm font-black text-white truncate drop-shadow-md">
                {p1Team ? `${p1Team.name} (${parseInt(p1Team.points)} PTS)` : '-'}
              </p>
              {dashboardData?.team_standings?.[1] && <p className="text-[10px] text-neutral-400 mt-0.5 truncate group-hover:text-cyan-300/80 transition-colors">+{parseInt(p1Team.points - dashboardData.team_standings[1].points)} PTS ahead of {dashboardData.team_standings[1].name}</p>}
            </div>
          </div>

          <div className="relative overflow-hidden bg-neutral-900/60 hover:bg-neutral-900/80 border border-neutral-800/80 hover:border-orange-500/50 rounded-2xl p-4 flex items-center gap-3.5 backdrop-blur-xl shadow-lg hover:shadow-[0_0_25px_rgba(249,115,22,0.15)] transition-all duration-300 group cursor-default">
            <div className="absolute top-0 right-0 w-24 h-24 bg-orange-500/5 rounded-full blur-2xl group-hover:bg-orange-500/10 transition-colors pointer-events-none" />
            <div className="w-10 h-10 rounded-xl bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-500 flex-shrink-0 group-hover:scale-110 group-hover:-rotate-3 group-hover:shadow-[0_0_15px_rgba(249,115,22,0.4)] transition-all">
              <Flame size={18} />
            </div>
            <div className="min-w-0 relative z-10">
              <span className="text-[10px] uppercase font-black tracking-widest text-neutral-500 block group-hover:text-orange-500 transition-colors">Last GP Winner</span>
              <p className="text-sm font-black text-white truncate drop-shadow-md">
                {lastRace?.winner ? `${lastRace.winner}` : (dashboardData?.last_race_name || '-')}
              </p>
              {lastRace && <p className="text-[10px] text-neutral-400 mt-0.5 truncate group-hover:text-orange-400/80 transition-colors">{lastRace.name}</p>}
            </div>
          </div>
        </section>

        {/* 2. NEXT GRAND PRIX COMMAND CENTER HERO */}
        <section className="relative bg-gradient-to-br from-neutral-900 via-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 md:p-10 shadow-2xl overflow-hidden mb-8 group">
          <div className="absolute top-0 right-1/4 w-96 h-96 bg-red-600/10 rounded-full blur-3xl pointer-events-none" />
          <div className="absolute bottom-0 right-0 w-80 h-80 bg-orange-600/5 rounded-full blur-2xl pointer-events-none" />

          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8 relative z-10">
            <div className="max-w-xl">
              <div className="flex items-center gap-2 mb-3">
                <span className="bg-red-600/20 text-red-500 border border-red-500/30 text-[11px] font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5">
                  <Zap size={12} className="fill-red-500" />
                  Next Grand Prix Hub &bull; {upcomingRace ? `Round ${upcomingRace.round}` : 'Upcoming'}
                </span>
                {upcomingRace?.location && (
                  <span className="text-neutral-400 text-xs font-semibold flex items-center gap-1">
                    <MapPin size={12} /> {upcomingRace.location}
                  </span>
                )}
              </div>

              <h1 className="text-3xl sm:text-5xl md:text-6xl font-black tracking-tight text-white uppercase italic">
                {upcomingRace?.name || dashboardData?.next_race_event?.name || 'Grand Prix'}
              </h1>

              <p className="text-neutral-400 text-sm sm:text-base mt-2 mb-6">
                {dashboardData?.next_race_event ? (
                  <>
                    Next live session: <strong className="text-white">{dashboardData.next_race_event.name.split(' - ')[1] || 'Track Session'}</strong>
                  </>
                ) : 'Upcoming championship battle on the official Formula 1 calendar.'}
              </p>

              {/* Countdown Timer */}
              {targetCountdownDate && (
                <div className="mb-6">
                  <HeroCountdown targetDate={targetCountdownDate} />
                </div>
              )}

              {/* Quick CTAs */}
              <div className="flex flex-wrap items-center gap-3">
                <Link 
                  to={upcomingRace ? `/race/${dashboardData?.year}/${upcomingRace.round}` : `/races`}
                  className="inline-flex items-center gap-2 px-6 py-3 bg-red-600 hover:bg-red-700 text-white rounded-xl font-bold text-sm transition-all shadow-lg shadow-red-600/20 hover:-translate-y-0.5"
                >
                  <Flag size={16} /> View Race Details
                </Link>
                <Link 
                  to="/races"
                  className="inline-flex items-center gap-2 px-6 py-3 bg-neutral-800/80 hover:bg-neutral-800 text-white border border-neutral-700 hover:border-neutral-600 rounded-xl font-bold text-sm transition-all hover:-translate-y-0.5"
                >
                  <Gauge size={16} /> Open Telemetry
                </Link>
              </div>
            </div>

            {/* Right side: Circuit Artwork */}
            {trackMapImg && (
              <div className="flex flex-col items-center justify-center lg:items-end flex-shrink-0">
                <div className="relative p-4 sm:p-6 bg-neutral-950/60 border border-neutral-800/80 rounded-3xl backdrop-blur-xl shadow-2xl flex flex-col items-center">
                  <div className="absolute top-3 left-4 text-[10px] uppercase font-bold tracking-widest text-neutral-500 flex items-center gap-1.5">
                    <Activity size={12} className="text-red-500" /> Circuit Layout
                  </div>
                  <img 
                    src={trackMapImg} 
                    alt={upcomingRace?.name || "Circuit Map"} 
                    className="w-56 sm:w-64 md:w-72 h-44 sm:h-52 object-contain filter drop-shadow-[0_10px_20px_rgba(0,0,0,0.8)] mt-4 group-hover:scale-105 transition-transform duration-500" 
                  />
                  <div className="mt-2 text-xs font-mono font-bold text-neutral-400">
                    {upcomingRace?.location || 'Official F1 Circuit'}
                  </div>
                </div>
              </div>
            )}
          </div>
        </section>

        {/* 3. WORLD CHAMPIONSHIP TITLE FIGHT (P1 vs P2) */}
        {p1Driver && p2Driver && (
          <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl mb-8 relative overflow-hidden">
            {/* Title Fight dramatic background gradients */}
            <div className="absolute top-0 left-0 w-1/3 h-full opacity-20 pointer-events-none blur-3xl transition-colors duration-1000" style={{ backgroundColor: teamColors[p1Driver.team] || '#EF4444' }} />
            <div className="absolute top-0 right-0 w-1/3 h-full opacity-20 pointer-events-none blur-3xl transition-colors duration-1000" style={{ backgroundColor: teamColors[p2Driver.team] || '#3B82F6' }} />

            <div className="flex items-center justify-between mb-6 relative z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]">
                  <Swords size={20} className="animate-pulse" />
                </div>
                <div>
                  <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white flex items-center gap-2">
                    Title Fight <span className="text-red-500">Battle</span>
                  </h2>
                  <p className="text-xs text-neutral-400 font-medium">Head-to-head championship showdown</p>
                </div>
              </div>
              <Link to="/simulator" className="text-xs uppercase font-bold text-emerald-400 hover:text-emerald-300 flex items-center gap-1 group bg-emerald-500/10 px-3 py-1.5 rounded-full border border-emerald-500/20 transition-colors">
                <Calculator size={14} />
                Predict <ChevronRight size={14} className="group-hover:translate-x-1 transition-transform" />
              </Link>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-5 relative z-10">
              {/* P1 Driver Card */}
              <Link
                to={`/driver/${p1Driver.name.toLowerCase().replace(/\s+/g, '_')}`}
                className="group bg-neutral-950/70 hover:bg-neutral-900/90 border border-neutral-800/80 hover:border-neutral-600 rounded-2xl p-5 transition-all duration-300 flex items-center justify-between relative overflow-hidden hover:-translate-y-1 shadow-lg"
              >
                <div 
                  className="absolute left-0 top-0 bottom-0 w-2 group-hover:w-3 transition-all duration-300" 
                  style={{ backgroundColor: teamColors[p1Driver.team] || '#EF4444', boxShadow: `0 0 15px ${teamColors[p1Driver.team]}80` }} 
                />
                <div className="flex items-center gap-4 ml-2">
                  <div className="text-4xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-br from-yellow-300 to-yellow-600 drop-shadow-md italic pr-1">P1</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-white text-xl group-hover:text-red-400 transition-colors uppercase tracking-tight">
                        {p1Driver.name}
                      </h3>
                      <span className="text-[10px] font-bold bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30 flex items-center gap-1">
                        <Crown size={10} /> LEADER
                      </span>
                    </div>
                    <div className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
                      {teamLogos[p1Driver.team] && <img src={teamLogos[p1Driver.team]} alt={p1Driver.team} className="h-4 w-auto drop-shadow-md" />}
                      <span className="font-semibold uppercase tracking-wider">{p1Driver.team}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black font-mono text-white tracking-tighter">{parseInt(p1Driver.points)}</div>
                  <span className="text-[11px] text-neutral-500 font-bold uppercase tracking-widest">PTS</span>
                </div>
              </Link>

              {/* P2 Driver Card */}
              <Link
                to={`/driver/${p2Driver.name.toLowerCase().replace(/\s+/g, '_')}`}
                className="group bg-neutral-950/70 hover:bg-neutral-900/90 border border-neutral-800/80 hover:border-neutral-600 rounded-2xl p-5 transition-all duration-300 flex items-center justify-between relative overflow-hidden hover:-translate-y-1 shadow-lg"
              >
                <div 
                  className="absolute left-0 top-0 bottom-0 w-2 group-hover:w-3 transition-all duration-300" 
                  style={{ backgroundColor: teamColors[p2Driver.team] || '#3B82F6', boxShadow: `0 0 15px ${teamColors[p2Driver.team]}80` }} 
                />
                <div className="flex items-center gap-4 ml-2">
                  <div className="text-4xl font-black font-mono text-transparent bg-clip-text bg-gradient-to-br from-slate-200 to-slate-500 drop-shadow-md italic pr-1">P2</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <h3 className="font-extrabold text-white text-xl group-hover:text-red-400 transition-colors uppercase tracking-tight">
                        {p2Driver.name}
                      </h3>
                      <span className="text-[10px] font-bold bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 flex items-center gap-1">
                        <Target size={10} /> HUNTING
                      </span>
                    </div>
                    <div className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
                      {teamLogos[p2Driver.team] && <img src={teamLogos[p2Driver.team]} alt={p2Driver.team} className="h-4 w-auto drop-shadow-md" />}
                      <span className="font-semibold uppercase tracking-wider">{p2Driver.team}</span>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <div className="text-4xl font-black font-mono text-white tracking-tighter">{parseInt(p2Driver.points)}</div>
                  <span className="text-[11px] text-neutral-500 font-bold uppercase tracking-widest">PTS</span>
                </div>
              </Link>
            </div>

            {/* Duel Gap Bar */}
            <div className="bg-neutral-950/90 border border-neutral-800 rounded-2xl p-4 md:p-5 relative z-10 shadow-inner">
              <div className="flex justify-between items-center text-xs font-mono text-neutral-300 mb-3">
                <span className="font-black text-white text-sm tracking-tight">{p1Driver.name} <span className="text-neutral-500 ml-1">({p1DuelPct}%)</span></span>
                <span className="bg-neutral-900 text-red-500 border border-red-500/30 px-3 py-1 rounded-full font-black text-[10px] tracking-widest shadow-[0_0_10px_rgba(239,68,68,0.2)]">
                  GAP: {titleGap} PTS
                </span>
                <span className="font-black text-white text-sm tracking-tight"><span className="text-neutral-500 mr-1">({100 - p1DuelPct}%)</span> {p2Driver.name}</span>
              </div>
              <div className="w-full bg-neutral-900 rounded-full h-3 overflow-hidden flex border border-neutral-800">
                <div 
                  className="h-full transition-all duration-1000 relative" 
                  style={{ width: `${p1DuelPct}%`, backgroundColor: teamColors[p1Driver.team] || '#EF4444' }} 
                >
                  <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]" />
                </div>
                <div className="w-1 h-full bg-neutral-950 flex-shrink-0 z-10" />
                <div 
                  className="h-full transition-all duration-1000 relative" 
                  style={{ width: `${100 - p1DuelPct}%`, backgroundColor: teamColors[p2Driver.team] || '#666666' }} 
                />
              </div>
            </div>
          </section>
        )}

        {/* 4. TOP CONSTRUCTORS SHOWCASE */}
        <section className="mb-8">
          <div className="flex justify-between items-center mb-6">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
                <Shield size={20} />
              </div>
              <div>
                <h2 className="text-xl md:text-2xl font-black uppercase tracking-tight text-white">
                  Top Constructors Championship
                </h2>
                <p className="text-xs text-neutral-400 font-medium">Leading teams fighting for the constructor crown</p>
              </div>
            </div>
            <Link to="/stats" className="text-xs md:text-sm font-bold uppercase tracking-wider text-red-500 hover:text-red-400 transition-colors flex items-center group">
              Full Standings <ChevronRight size={16} className="ml-1 group-hover:translate-x-1.5 transition-transform" />
            </Link>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {(dashboardData?.team_standings?.slice(0, 4) || []).map((team, index) => (
              <TeamCard key={team.name} team={team} index={index} maxPoints={maxTeamPoints} />
            ))}
          </div>
        </section>

        {/* 5. TWO-COLUMN MAIN HUB: DRIVER STANDINGS + RECENT RACES */}
        <section className="grid grid-cols-1 lg:grid-cols-2 gap-8 mb-8">
          <DriverStandingsList 
            drivers={dashboardData?.driver_standings?.slice(0, 7) || []} 
          />

          <RaceAnalyticsCard
            races={dashboardData?.race_analytics || []}
            year={dashboardData?.year}
          />
        </section>



        {/* 6. QUICK ACTION FEATURE TILES */}
        <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
          <Link
            to="/races"
            className="group relative bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 hover:border-red-500/50 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_10px_30px_rgba(239,68,68,0.15)] flex flex-col justify-between overflow-hidden"
          >
            <Gauge size={80} className="absolute -right-6 -bottom-6 text-red-500/5 group-hover:text-red-500/10 transition-colors pointer-events-none" />
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-red-500/10 rounded-full blur-2xl group-hover:bg-red-500/20 transition-colors" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 mb-5 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                <Gauge size={24} />
              </div>
              <h3 className="text-lg font-black text-white group-hover:text-red-400 transition-colors uppercase tracking-tight">
                Telemetry
              </h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed font-medium">
                Compare speed traces, throttle maps, brake zones & DRS activation lap by lap.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[11px] font-black text-red-500 uppercase tracking-widest relative z-10">
              Launch <ChevronRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>

          <Link
            to="/compare"
            className="group relative bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 hover:border-purple-500/50 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_10px_30px_rgba(168,85,247,0.15)] flex flex-col justify-between overflow-hidden"
          >
            <Swords size={80} className="absolute -right-6 -bottom-6 text-purple-500/5 group-hover:text-purple-500/10 transition-colors pointer-events-none" />
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-colors" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-5 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                <Swords size={24} />
              </div>
              <h3 className="text-lg font-black text-white group-hover:text-purple-400 transition-colors uppercase tracking-tight">
                Driver Duel
              </h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed font-medium">
                Pit two drivers head-to-head! Compare career stats, win rates and race-by-race results.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[11px] font-black text-purple-400 uppercase tracking-widest relative z-10">
              Compare <ChevronRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>

          <Link
            to="/simulator"
            className="group relative bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 hover:border-emerald-500/50 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_10px_30px_rgba(16,185,129,0.15)] flex flex-col justify-between overflow-hidden"
          >
            <FlaskConical size={80} className="absolute -right-6 -bottom-6 text-emerald-500/5 group-hover:text-emerald-500/10 transition-colors pointer-events-none" />
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-emerald-500/10 rounded-full blur-2xl group-hover:bg-emerald-500/20 transition-colors" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-5 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                <FlaskConical size={24} />
              </div>
              <h3 className="text-lg font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight">
                Simulator
              </h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed font-medium">
                What-If scenario calculator. Simulate race results to predict the World Champion.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[11px] font-black text-emerald-400 uppercase tracking-widest relative z-10">
              Predict <ChevronRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>

          <Link
            to="/stats"
            className="group relative bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 hover:border-yellow-500/50 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_10px_30px_rgba(234,179,8,0.15)] flex flex-col justify-between overflow-hidden"
          >
            <Crown size={80} className="absolute -right-6 -bottom-6 text-yellow-500/5 group-hover:text-yellow-500/10 transition-colors pointer-events-none" />
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-yellow-500/10 rounded-full blur-2xl group-hover:bg-yellow-500/20 transition-colors" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 mb-5 group-hover:scale-110 group-hover:-rotate-3 transition-transform">
                <Crown size={24} />
              </div>
              <h3 className="text-lg font-black text-white group-hover:text-yellow-400 transition-colors uppercase tracking-tight">
                Profiles
              </h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed font-medium">
                Deep championship standings and official profiles for every driver and team this season.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[11px] font-black text-yellow-500 uppercase tracking-widest relative z-10">
              Explore <ChevronRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>

          <Link
            to="/races"
            className="group relative bg-neutral-900/60 backdrop-blur-sm border border-neutral-800 hover:border-cyan-500/50 rounded-3xl p-6 transition-all duration-300 hover:-translate-y-1.5 hover:shadow-[0_10px_30px_rgba(6,182,212,0.15)] flex flex-col justify-between overflow-hidden"
          >
            <FlagTriangleRight size={80} className="absolute -right-6 -bottom-6 text-cyan-500/5 group-hover:text-cyan-500/10 transition-colors pointer-events-none" />
            <div className="absolute -right-4 -top-4 w-24 h-24 bg-cyan-500/10 rounded-full blur-2xl group-hover:bg-cyan-500/20 transition-colors" />
            <div className="relative z-10">
              <div className="w-12 h-12 rounded-2xl bg-cyan-500/10 border border-cyan-500/30 flex items-center justify-center text-cyan-400 mb-5 group-hover:scale-110 group-hover:rotate-3 transition-transform">
                <FlagTriangleRight size={24} />
              </div>
              <h3 className="text-lg font-black text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tight">
                Race Hub
              </h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed font-medium">
                Complete FP, Qualifying, Starting Grid, Tyre Strategy, and Speed Sector data for every GP.
              </p>
            </div>
            <div className="mt-6 flex items-center gap-2 text-[11px] font-black text-cyan-400 uppercase tracking-widest relative z-10">
              Browse <ChevronRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>
        </section>

      </main>
    </div>
  );
}

export default DashboardPage;

