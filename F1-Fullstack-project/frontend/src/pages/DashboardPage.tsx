// src/DashboardPage - Next-Gen F1 Telemetry & Championship Dashboard

import { useQuery } from '@tanstack/react-query';
import { fetchDashboardData } from '../services/api';

import ErrorState from '../components/layout/ErrorState';
import { Link } from 'react-router-dom';
import { 
  Calendar, ChevronRight, Flag, Gauge, Zap, Activity, Calculator, Swords, Crown, Target, Shield, Flame,
  FlagTriangleRight
} from 'lucide-react';
import { teamLogos, getDriverColor } from '../data/teamData';
import { getTrackMap, getCountryCode } from '../data/trackData';
import { getCircuitSpec } from '../data/circuitSpecs';
import { CountryFlag } from '../components/ui/CountryFlag';
import HeroCountdown from '../components/ui/HeroCountdown';
import TeamCard, { TeamStanding } from '../components/dashboard/TeamCard';
import DriverStandingsList from '../components/dashboard/DriverStandingsList';
import RaceAnalyticsCard from '../components/dashboard/RaceAnalyticsCard';
import AnimatedNumber from '../components/ui/AnimatedNumber';
import { Track3D } from '../components/ui/Track3D';
import { safeMax, toNumber } from '../utils/data';
import { resolveNextRaceFromSources, countdownTarget } from '../utils/nextRace';
import { motion, useReducedMotion, type Variants } from 'framer-motion';

// =======================================================================
// --- MAIN DASHBOARD PAGE ---
// =======================================================================
function DashboardPage() {
  const currentYear = new Date().getFullYear();
  const prevYear = currentYear - 1;
  const shouldReduceMotion = useReducedMotion();

  const sectionVariants: Variants = {
    hidden: { opacity: shouldReduceMotion ? 1 : 0, y: shouldReduceMotion ? 0 : 16 },
    visible: (index: number) => ({
      opacity: 1,
      y: 0,
      transition: {
        delay: shouldReduceMotion ? 0 : index * 0.05,
        duration: shouldReduceMotion ? 0 : 0.35,
        ease: [0.22, 1, 0.36, 1],
      },
    }),
  };

  const { data, error, isLoading: loading, refetch } = useQuery({
    queryKey: ['dashboard', currentYear],
    queryFn: async () => {
      const dataCurrent = await fetchDashboardData(currentYear);
      const hasStandings = Array.isArray(dataCurrent.driver_standings) && dataCurrent.driver_standings.length > 0;
      if (dataCurrent.status === 'pre_season' || !hasStandings) {
        try {
          const dataPrev = await Promise.race([
            fetchDashboardData(prevYear),
            new Promise<never>((_, reject) => setTimeout(() => reject(new Error('timeout')), 4000)),
          ]);
          return { ...dataPrev, year: prevYear, next_race_event: dataCurrent.next_race_event ?? null };
        } catch {
          return dataCurrent;
        }
      }
      return dataCurrent;
    }
  });
  
  const dashboardData = data;

  if (loading) {
    return (
      <div className="bg-neutral-950 min-h-screen text-white font-sans">
        <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-6 md:py-8 space-y-6">
          <div className="motion-safe:animate-pulse space-y-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {[1, 2, 3, 4].map((i) => (
                <div key={i} className="h-24 bg-neutral-900/60 border border-neutral-800 rounded-xl" />
              ))}
            </div>
            <div className="h-[420px] bg-neutral-900/60 border border-neutral-800 rounded-2xl w-full" />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-[400px] bg-neutral-900/60 border border-neutral-800 rounded-xl w-full" />
              <div className="h-[400px] bg-neutral-900/60 border border-neutral-800 rounded-xl w-full" />
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) return <ErrorState message={error.message} onRetry={refetch} />;

  // Derived Values
  const raceAnalytics = dashboardData?.race_analytics ?? [];
  const upcomingRace = raceAnalytics.find(r => r.status === 'Upcoming') || raceAnalytics[raceAnalytics.length - 1];
  const finishedRaces = raceAnalytics.filter(r => r.status === 'Finished');
  const lastRace = finishedRaces.length > 0 ? finishedRaces[finishedRaces.length - 1] : null;

  const driverStandings = dashboardData?.driver_standings ?? [];
  const p1Driver = driverStandings[0];
  const p2Driver = driverStandings[1];
  const p1Team = dashboardData?.team_standings?.[0];
  const p2Team = dashboardData?.team_standings?.[1];

  const nextEvent = resolveNextRaceFromSources(
    dashboardData?.race_analytics,
    dashboardData?.next_race_event,
  );

  const heroRaceName = nextEvent
    ? (nextEvent.name || '').split(' - ')[0] || 'Grand Prix'
    : 'Grand Prix';
  const targetCountdownDate = countdownTarget(nextEvent?.date);
  const heroPhase = nextEvent?.phase ?? 'future';
  const trackMapImg = getTrackMap(
    upcomingRace ?? (dashboardData?.next_race_event?.name ? { name: dashboardData.next_race_event.name } : null)
  );

  const countryCode = getCountryCode(
    upcomingRace ?? (nextEvent ? { ...nextEvent, location: nextEvent.location } : { name: heroRaceName })
  );

  const circuitSpec = getCircuitSpec(
    nextEvent?.location || upcomingRace?.location || upcomingRace?.name || heroRaceName
  );

  const rawSessionName = dashboardData?.next_race_event?.name || '';
  const sessionParts = rawSessionName.split(' - ');
  const nextSessionLabel = sessionParts.length > 1 ? sessionParts.slice(1).join(' - ') : null;

  const teamStandings = dashboardData?.team_standings ?? [];
  const maxTeamPoints = safeMax(teamStandings.map(t => toNumber(t.points)), 1);

  // Points arrive as NumericString from the API, so coerce once at the boundary.
  const p1Points = Number(p1Driver?.points) || 0;
  const p2Points = Number(p2Driver?.points) || 0;

  // Title Fight gap calculation
  const p1Name = p1Driver?.name ?? '';
  const p2Name = p2Driver?.name ?? '';
  const titleGap = (p1Driver && p2Driver) ? Math.round(p1Points - p2Points) : 0;
  const totalDuelPoints = (p1Driver && p2Driver) ? (p1Points + p2Points) : 1;
  const p1DuelPct = (p1Driver && p2Driver && totalDuelPoints > 0)
    ? Math.round((p1Points / totalDuelPoints) * 100)
    : 50;
  const teamGap = (p1Team && p2Team) ? Math.round(Number(p1Team.points) - Number(p2Team.points)) : null;

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans selection:bg-red-600">
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 lg:px-8 xl:px-10 py-5 sm:py-6 md:py-8 space-y-6 sm:space-y-8">

        {/* 1. SEASON PULSE BAR */}
        <motion.section
          aria-label="Season Quick Pulse"
          initial="hidden"
          animate="visible"
          custom={0}
          variants={sectionVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4"
        >
          <Link
            to="/races"
            className="relative overflow-hidden bg-neutral-900/60 hover:bg-neutral-900/90 border border-neutral-800/80 hover:border-red-500/50 rounded-xl p-4 flex items-center gap-3.5 backdrop-blur-xl shadow-lg transition-all duration-200 group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-red-500"
          >
            <div className="w-11 h-11 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500 shrink-0 group-hover:scale-105 transition-transform">
              <Calendar size={19} aria-hidden="true" />
            </div>
            <div className="min-w-0 relative z-10 flex-1">
              <span className="text-[11px] uppercase font-black tracking-widest text-neutral-400 block group-hover:text-red-400 transition-colors">Season Calendar</span>
              <p className="text-base font-black text-white truncate drop-shadow-sm">
                {lastRace ? <>{lastRace.round} <span className="text-neutral-400 font-medium">/ {dashboardData?.total_races || 24}</span> Races</> : `${dashboardData?.year ?? currentYear} FIA F1 Season`}
              </p>
              {lastRace && <p className="text-xs text-neutral-400 mt-0.5 truncate group-hover:text-neutral-300 transition-colors">Next: {upcomingRace?.name || 'End of Season'}</p>}
            </div>
          </Link>

          <Link
            to="/stats"
            className="relative overflow-hidden bg-neutral-900/60 hover:bg-neutral-900/90 border border-neutral-800/80 hover:border-yellow-500/50 rounded-xl p-4 flex items-center gap-3.5 backdrop-blur-xl shadow-lg transition-all duration-200 group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-yellow-500"
          >
            <div className="w-11 h-11 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center text-yellow-400 shrink-0 group-hover:scale-105 transition-transform">
              <Crown size={19} aria-hidden="true" />
            </div>
            <div className="min-w-0 relative z-10 flex-1">
              <span className="text-[11px] uppercase font-black tracking-widest text-neutral-400 block group-hover:text-yellow-400 transition-colors">Drivers Leader</span>
              <p className="text-base font-black text-white truncate drop-shadow-sm">
                {p1Driver ? `${p1Name || 'Unknown Driver'} (${parseInt(String(p1Driver.points), 10)} PTS)` : '-'}
              </p>
              {p2Driver && p2Name && <p className="text-xs text-neutral-400 mt-0.5 truncate group-hover:text-neutral-300 transition-colors">+{Math.round(p1Points - p2Points)} PTS ahead of {p2Name.split(' ').pop()}</p>}
            </div>
          </Link>

          <Link
            to="/stats"
            className="relative overflow-hidden bg-neutral-900/60 hover:bg-neutral-900/90 border border-neutral-800/80 hover:border-cyan-500/50 rounded-xl p-4 flex items-center gap-3.5 backdrop-blur-xl shadow-lg transition-all duration-200 group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-cyan-500"
          >
            <div className="w-11 h-11 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 shrink-0 group-hover:scale-105 transition-transform">
              <Shield size={19} aria-hidden="true" />
            </div>
            <div className="min-w-0 relative z-10 flex-1">
              <span className="text-[11px] uppercase font-black tracking-widest text-neutral-400 block group-hover:text-cyan-400 transition-colors">Constructors Leader</span>
              <p className="text-base font-black text-white truncate drop-shadow-sm">
                {p1Team ? `${p1Team.name} (${parseInt(String(p1Team.points), 10)} PTS)` : '-'}
              </p>
              {p2Team && <p className="text-xs text-neutral-400 mt-0.5 truncate group-hover:text-neutral-300 transition-colors">+{teamGap} PTS ahead of {p2Team.name}</p>}
            </div>
          </Link>

          <Link
            to="/races"
            className="relative overflow-hidden bg-neutral-900/60 hover:bg-neutral-900/90 border border-neutral-800/80 hover:border-orange-500/50 rounded-xl p-4 flex items-center gap-3.5 backdrop-blur-xl shadow-lg transition-all duration-200 group focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-orange-500"
          >
            <div className="w-11 h-11 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 shrink-0 group-hover:scale-105 transition-transform">
              <Flame size={19} aria-hidden="true" />
            </div>
            <div className="min-w-0 relative z-10 flex-1">
              <span className="text-[11px] uppercase font-black tracking-widest text-neutral-400 block group-hover:text-orange-400 transition-colors">Last GP Winner</span>
              <p className="text-base font-black text-white truncate drop-shadow-sm">
                {lastRace?.winner ? `${lastRace.winner}` : (dashboardData?.last_race_name || '-')}
              </p>
              {lastRace && <p className="text-xs text-neutral-400 mt-0.5 truncate group-hover:text-neutral-300 transition-colors">{lastRace.name}</p>}
            </div>
          </Link>
        </motion.section>

        {/* 2. NEXT GRAND PRIX COMMAND CENTER HERO */}
        <motion.section
          aria-label="Next Grand Prix Command Center"
          initial="hidden"
          animate="visible"
          custom={1}
          variants={sectionVariants}
          className="relative rounded-2xl bg-linear-to-br from-neutral-900/95 via-neutral-900/80 to-neutral-950 border border-neutral-800/90 shadow-2xl p-5 sm:p-7 md:p-8 xl:p-9 overflow-hidden group"
        >
          {/* Subtle Ambient Red Glow */}
          <div className="pointer-events-none absolute -top-32 -left-32 w-96 h-96 rounded-full bg-red-600/10 blur-[100px]" aria-hidden="true" />
          <div className="pointer-events-none absolute -bottom-32 -right-32 w-96 h-96 rounded-full bg-red-500/5 blur-[120px]" aria-hidden="true" />

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8 items-stretch relative z-10">
            {/* Left Column: Command & Countdown (7 cols on lg/xl) */}
            <div className="lg:col-span-7 flex flex-col justify-between space-y-6">
              <div>
                {/* Top Meta Bar */}
                <div className="flex flex-wrap items-center gap-2 mb-3.5">
                  <span className="bg-red-600/20 text-red-400 border border-red-500/30 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 shadow-xs">
                    <Zap size={12} className="fill-red-500" />
                    Next Grand Prix Hub &bull; {nextEvent?.round ? `Round ${nextEvent.round}` : 'Upcoming'}
                  </span>

                  <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-neutral-950/80 border border-neutral-800 text-neutral-300 text-xs font-bold">
                    {countryCode && <CountryFlag code={countryCode} alt="" className="w-4 h-auto rounded-xs shadow-xs" />}
                    <span>{nextEvent?.location || circuitSpec.circuitName}</span>
                  </div>

                  {heroPhase === 'race_day' && (
                    <span className="bg-amber-500/20 text-amber-300 border border-amber-500/50 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 motion-safe:animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-amber-400" /> Race Day — Today
                    </span>
                  )}
                  {heroPhase === 'live' && (
                    <span className="bg-green-500/20 text-green-400 border border-green-500/50 text-xs font-black uppercase tracking-wider px-3 py-1 rounded-full flex items-center gap-1.5 motion-safe:animate-pulse">
                      <span className="w-1.5 h-1.5 rounded-full bg-green-400" /> Live On Track
                    </span>
                  )}
                </div>

                {/* Grand Prix Title */}
                <h1 className="text-3xl sm:text-4xl md:text-5xl lg:text-5xl xl:text-6xl font-black italic tracking-tight text-white leading-[1.08] drop-shadow-md">
                  {heroRaceName}
                </h1>

                {/* Dynamic Circuit & Session Subtitle */}
                <div className="mt-3 flex flex-wrap items-center gap-x-2.5 gap-y-1 text-sm sm:text-base text-neutral-300 font-medium">
                  <span className="font-bold text-white">{circuitSpec.circuitName}</span>
                  <span className="text-neutral-600 hidden sm:inline">&bull;</span>
                  <span className="text-neutral-400 text-xs sm:text-sm">{circuitSpec.laps} Laps ({circuitSpec.raceDistance})</span>
                  {nextSessionLabel && (
                    <>
                      <span className="text-neutral-600 hidden sm:inline">&bull;</span>
                      <span className="text-neutral-400 text-xs sm:text-sm">
                        Session: <strong className="text-neutral-200 font-semibold">{nextSessionLabel}</strong>
                      </span>
                    </>
                  )}
                </div>
              </div>

              {/* Countdown Timer */}
              {targetCountdownDate && (
                <div className="pt-1">
                  <div className="text-[11px] font-black uppercase tracking-widest text-neutral-400 mb-2 flex items-center gap-1.5">
                    <Activity size={12} className="text-red-500" />
                    <span>Countdown To Track Action</span>
                  </div>
                  <HeroCountdown targetDate={targetCountdownDate} phase={heroPhase} />
                </div>
              )}

              {/* Quick CTAs */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                <Link 
                  to={nextEvent?.round ? `/race/${dashboardData?.year}/${nextEvent.round}` : `/races`}
                  className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white rounded-lg font-bold text-sm tracking-wide transition-all duration-200 shadow-lg shadow-red-600/30 hover:shadow-red-600/50"
                >
                  <Flag size={16} /> View Race Details
                </Link>
                <Link 
                  to="/races"
                  className="inline-flex items-center gap-2 px-5 py-2.5 sm:px-6 sm:py-3 bg-neutral-900/90 hover:bg-neutral-850 active:bg-neutral-900 text-neutral-200 hover:text-white border border-neutral-700 hover:border-neutral-600 rounded-lg font-bold text-sm tracking-wide transition-all duration-200"
                >
                  <Gauge size={16} /> Open Telemetry
                </Link>
                <Link
                  to="/simulator"
                  className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-emerald-400 hover:text-emerald-300 transition-colors ml-auto sm:ml-0"
                >
                  <Calculator size={14} /> Simulate Outcome <ChevronRight size={14} />
                </Link>
              </div>
            </div>

            {/* Right Column: Circuit Telemetry Pod (5 cols on lg/xl) */}
            <div className="lg:col-span-5 flex flex-col justify-between bg-neutral-950/70 border border-neutral-800/80 rounded-xl p-4 sm:p-5 md:p-6 backdrop-blur-xl relative overflow-hidden shadow-inner">
              {/* Circuit Pod Header */}
              <div className="flex items-center justify-between border-b border-neutral-800/80 pb-3 mb-3 relative z-10">
                <div className="flex items-center gap-2 text-xs font-black uppercase tracking-wider text-neutral-300">
                  <Activity size={14} className="text-red-500" />
                  <span>Circuit Telemetry</span>
                </div>
              </div>

              {/* Circuit Map with Ambient Glow */}
              <div className="relative flex items-center justify-center py-2 my-auto min-h-[160px] sm:min-h-[190px]">
                {trackMapImg ? (
                  <Track3D className="w-full" tone="red">
                    <div className="absolute inset-0 bg-red-600/5 blur-2xl rounded-full pointer-events-none" aria-hidden="true" />
                    <img 
                      src={trackMapImg} 
                      alt={upcomingRace?.name || "Circuit Map"} 
                      className="w-full max-w-[270px] sm:max-w-[310px] max-h-[170px] sm:max-h-[195px] object-contain invert transition-transform duration-500 hover:scale-105" 
                    />
                  </Track3D>
                ) : (
                  <div className="text-neutral-500 text-xs font-mono uppercase tracking-wider">Circuit Map Not Available</div>
                )}
              </div>

              {/* Circuit Telemetry Metric Badges */}
              <div className="grid grid-cols-4 gap-2 pt-3 border-t border-neutral-800/80 relative z-10">
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-2 sm:p-2.5 text-center">
                  <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest">LENGTH</span>
                  <span className="font-mono font-black text-xs sm:text-sm text-white mt-0.5 block">{circuitSpec.length}</span>
                </div>
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-2 sm:p-2.5 text-center">
                  <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest">TURNS</span>
                  <span className="font-mono font-black text-xs sm:text-sm text-white mt-0.5 block">{circuitSpec.turns}</span>
                </div>
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-2 sm:p-2.5 text-center">
                  <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest">LAPS</span>
                  <span className="font-mono font-black text-xs sm:text-sm text-white mt-0.5 block">{circuitSpec.laps}</span>
                </div>
                <div className="bg-neutral-900/80 border border-neutral-800 rounded-lg p-2 sm:p-2.5 text-center">
                  <span className="block text-[10px] font-bold text-neutral-500 uppercase tracking-widest">RECORD</span>
                  <span className="font-mono font-black text-xs sm:text-xs text-red-400 mt-0.5 block truncate" title={circuitSpec.lapRecord || 'Official'}>
                    {circuitSpec.lapRecord ? circuitSpec.lapRecord.split(' ')[0] : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </motion.section>

        {/* 3. WORLD CHAMPIONSHIP TITLE FIGHT (P1 vs P2) */}
        {p1Driver && p2Driver && (() => {
          const p1TeamColor = getDriverColor(p1Name, p1Driver.team);
          let p2TeamColor = getDriverColor(p2Name, p2Driver.team);
          if (p1Driver.team && p2Driver.team && (p1Driver.team === p2Driver.team || p1TeamColor.toLowerCase() === p2TeamColor.toLowerCase())) {
            p2TeamColor = getDriverColor(p2Name, p2Driver.team, true);
            if (p1TeamColor.toLowerCase() === p2TeamColor.toLowerCase()) {
              p2TeamColor = '#FACC15';
            }
          }

          return (
            <motion.section
              aria-label="Title Fight Battle"
              initial="hidden"
              animate="visible"
              custom={2}
              variants={sectionVariants}
              className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-2xl p-5 sm:p-6 md:p-8 shadow-2xl relative overflow-hidden"
            >
              {/* Title Fight dramatic background gradients */}
              <div className="absolute top-0 left-0 w-1/3 h-full opacity-20 pointer-events-none blur-3xl transition-colors duration-1000" style={{ backgroundColor: p1TeamColor }} />
              <div className="absolute top-0 right-0 w-1/3 h-full opacity-20 pointer-events-none blur-3xl transition-colors duration-1000" style={{ backgroundColor: p2TeamColor }} />

              <div className="flex items-center justify-between mb-6 relative z-10">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 ">
                    <Swords size={20} className="" />
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
                  to={`/driver/${p1Name ? p1Name.toLowerCase().replace(/\s+/g, '_') : 'unknown'}`}
                  className="group bg-neutral-950/70 hover:bg-neutral-900/90 border border-neutral-800/80 hover:border-neutral-600 rounded-xl p-5 transition-ui duration-300 flex items-center justify-between relative overflow-hidden shadow-lg"
                >
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-2 group-hover:w-3 transition-ui duration-300" 
                    style={{ backgroundColor: p1TeamColor, boxShadow: `0 0 15px ${p1TeamColor}80` }} 
                  />
                  <div className="flex items-center gap-4 ml-2">
                    <div className="text-4xl font-black font-mono drop-shadow-md italic pr-1 text-chalk">P1</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-white text-xl group-hover:text-red-400 transition-colors uppercase tracking-tight">
                          {p1Name || 'Unknown Driver'}
                        </h3>
                        <span className="text-[11px] font-bold bg-yellow-500/10 text-yellow-400 px-2 py-0.5 rounded-full border border-yellow-500/30 flex items-center gap-1">
                          <Crown size={10} /> LEADER
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
                        {teamLogos[p1Driver.team ?? ''] && <img src={teamLogos[p1Driver.team ?? '']} alt={p1Driver.team ?? ''} className="h-4 w-auto drop-shadow-md" />}
                        <span className="font-semibold uppercase tracking-wider">{p1Driver.team || 'Unknown Team'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <AnimatedNumber value={Math.round(p1Points)} className="text-4xl font-black font-mono text-white tracking-tighter" />
                    <span className="text-[11px] text-neutral-500 font-bold uppercase tracking-widest block">PTS</span>
                  </div>
                </Link>

                {/* P2 Driver Card */}
                <Link
                  to={`/driver/${p2Name ? p2Name.toLowerCase().replace(/\s+/g, '_') : 'unknown'}`}
                  className="group bg-neutral-950/70 hover:bg-neutral-900/90 border border-neutral-800/80 hover:border-neutral-600 rounded-xl p-5 transition-ui duration-300 flex items-center justify-between relative overflow-hidden shadow-lg"
                >
                  <div 
                    className="absolute left-0 top-0 bottom-0 w-2 group-hover:w-3 transition-ui duration-300" 
                    style={{ backgroundColor: p2TeamColor, boxShadow: `0 0 15px ${p2TeamColor}80` }} 
                  />
                  <div className="flex items-center gap-4 ml-2">
                    <div className="text-4xl font-black font-mono drop-shadow-md italic pr-1 text-chalk">P2</div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-white text-xl group-hover:text-red-400 transition-colors uppercase tracking-tight">
                          {p2Name || 'Unknown Driver'}
                        </h3>
                        <span className="text-[11px] font-bold bg-red-500/10 text-red-400 px-2 py-0.5 rounded-full border border-red-500/30 flex items-center gap-1">
                          <Target size={10} /> HUNTING
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400 mt-1 flex items-center gap-2">
                        {teamLogos[p2Driver.team ?? ''] && <img src={teamLogos[p2Driver.team ?? '']} alt={p2Driver.team ?? ''} className="h-4 w-auto drop-shadow-md" />}
                        <span className="font-semibold uppercase tracking-wider">{p2Driver.team || 'Unknown Team'}</span>
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <AnimatedNumber value={Math.round(p2Points)} className="text-4xl font-black font-mono text-white tracking-tighter" />
                    <span className="text-[11px] text-neutral-500 font-bold uppercase tracking-widest block">PTS</span>
                  </div>
                </Link>
              </div>

              {/* Duel Gap Bar */}
              <div className="bg-neutral-950/90 border border-neutral-800 rounded-xl p-4 md:p-5 relative z-10 shadow-inner">
                <div className="flex justify-between items-center text-xs font-mono text-neutral-300 mb-3">
                  <span className="font-black text-white text-sm tracking-tight">{p1Name || 'Unknown Driver'} <span className="text-neutral-500 ml-1">({p1DuelPct}%)</span></span>
                  <span className="bg-neutral-900 text-red-500 border border-red-500/30 px-3 py-1 rounded-full font-black text-[11px] tracking-widest ">
                    GAP: <AnimatedNumber value={titleGap} /> PTS
                  </span>
                  <span className="font-black text-white text-sm tracking-tight"><span className="text-neutral-500 mr-1">({100 - p1DuelPct}%)</span> {p2Name || 'Unknown Driver'}</span>
                </div>
                <div className="w-full bg-neutral-900 rounded-full h-3 overflow-hidden flex border border-neutral-800">
                  <div 
                    className="h-full transition-ui duration-1000 relative" 
                    style={{ width: `${p1DuelPct}%`, backgroundColor: p1TeamColor }} 
                  >
                    <div className="absolute inset-0 bg-white/20 w-full animate-[shimmer_2s_infinite]" />
                  </div>
                  <div className="w-1 h-full bg-neutral-950 shrink-0 z-10" />
                  <div 
                    className="h-full transition-ui duration-1000 relative" 
                    style={{ width: `${100 - p1DuelPct}%`, backgroundColor: p2TeamColor }} 
                  />
                </div>
              </div>
            </motion.section>
          );
        })()}

        {/* 4. TOP CONSTRUCTORS SHOWCASE */}
        <motion.section
          aria-label="Top Constructors Championship"
          initial="hidden"
          animate="visible"
          custom={3}
          variants={sectionVariants}
          className="space-y-5"
        >
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400">
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
            {(dashboardData?.team_standings?.slice(0, 4) || []).map((team: TeamStanding, index: number) => (
              <TeamCard key={team.name} team={team} index={index} maxPoints={maxTeamPoints} />
            ))}
          </div>
        </motion.section>

        {/* 5. TWO-COLUMN MAIN HUB: DRIVER STANDINGS + RECENT RACES */}
        <motion.section
          initial="hidden"
          animate="visible"
          custom={4}
          variants={sectionVariants}
          className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-8"
        >
          <DriverStandingsList
            drivers={driverStandings.slice(0, 7)}
          />

          <RaceAnalyticsCard
            races={raceAnalytics}
            year={dashboardData?.year ?? currentYear}
          />
        </motion.section>

        {/* 5b. EMPTY SEASON NOTICE */}
        {driverStandings.length === 0 && raceAnalytics.length === 0 && (
          <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-8 text-center backdrop-blur-xl">
            <FlagTriangleRight className="mx-auto mb-3 text-neutral-600" size={36} />
            <h3 className="text-lg font-black uppercase tracking-tight text-white">
              No live data available
            </h3>
            <p className="mx-auto mt-2 max-w-md text-sm text-neutral-400">
              {dashboardData?.status === 'pre_season'
                ? (dashboardData.message || 'The season has not started yet. Standings will appear once the first race weekend is completed.')
                : 'The backend returned no standings and no calendar for this season. Try another season or check back later.'}
            </p>
          </section>
        )}

        {/* 6. QUICK ACTION FEATURE TILES */}
        <motion.section
          aria-label="Quick Actions"
          initial="hidden"
          animate="visible"
          custom={5}
          variants={sectionVariants}
          className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4"
        >
          <Link
            to="/races"
            className="group relative bg-neutral-900/60 backdrop-blur-xs border border-neutral-800 hover:border-red-500/50 rounded-xl p-5 transition-all duration-300 hover:shadow-[0_10px_30px_rgba(239,68,68,0.15)] flex flex-col justify-between overflow-hidden"
          >
            <Gauge size={80} className="absolute -right-6 -bottom-6 text-red-500/5 group-hover:text-red-500/10 transition-colors pointer-events-none" />
            <div className="relative z-10">
              <div className="w-11 h-11 rounded-lg bg-red-600/10 border border-red-500/30 flex items-center justify-center text-red-500 mb-4 group-hover:scale-105 transition-transform">
                <Gauge size={22} />
              </div>
              <h3 className="text-base font-black text-white group-hover:text-red-400 transition-colors uppercase tracking-tight">
                Telemetry
              </h3>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed font-medium">
                Compare speed traces, throttle maps, brake zones & active aero / MOM deployment lap by lap.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-[11px] font-black text-red-500 uppercase tracking-widest relative z-10">
              Launch <ChevronRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>

          <Link
            to="/compare"
            className="group relative bg-neutral-900/60 backdrop-blur-xs border border-neutral-800 hover:border-purple-500/50 rounded-xl p-5 transition-all duration-300 hover:shadow-[0_10px_30px_rgba(168,85,247,0.15)] flex flex-col justify-between overflow-hidden"
          >
            <Swords size={80} aria-hidden="true" className="absolute -right-6 -bottom-6 text-purple-500/5 group-hover:text-purple-500/10 transition-colors pointer-events-none" />
            <div className="relative z-10">
              <div className="w-11 h-11 rounded-lg bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-400 mb-4 group-hover:scale-105 transition-transform">
                <Swords size={22} aria-hidden="true" />
              </div>
              <h3 className="text-base font-black text-white group-hover:text-purple-400 transition-colors uppercase tracking-tight">
                Driver Duel
              </h3>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed font-medium">
                Pit two drivers head-to-head! Compare career stats, win rates and race-by-race results.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-[11px] font-black text-purple-400 uppercase tracking-widest relative z-10">
              Compare <ChevronRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>

          <Link
            to="/simulator"
            className="group relative bg-neutral-900/60 backdrop-blur-xs border border-neutral-800 hover:border-emerald-500/50 rounded-xl p-5 transition-all duration-300 hover:shadow-[0_10px_30px_rgba(16,185,129,0.15)] flex flex-col justify-between overflow-hidden"
          >
            <Calculator size={80} aria-hidden="true" className="absolute -right-6 -bottom-6 text-emerald-500/5 group-hover:text-emerald-500/10 transition-colors pointer-events-none" />
            <div className="relative z-10">
              <div className="w-11 h-11 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-400 mb-4 group-hover:scale-105 transition-transform">
                <Calculator size={22} aria-hidden="true" />
              </div>
              <h3 className="text-base font-black text-white group-hover:text-emerald-400 transition-colors uppercase tracking-tight">
                Simulator
              </h3>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed font-medium">
                Run championship outcomes, podium scenarios and see mathematical points implications.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-[11px] font-black text-emerald-400 uppercase tracking-widest relative z-10">
              Simulate <ChevronRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>

          <Link
            to="/stats"
            className="group relative bg-neutral-900/60 backdrop-blur-xs border border-neutral-800 hover:border-yellow-500/50 rounded-xl p-5 transition-all duration-300 hover:shadow-[0_10px_30px_rgba(234,179,8,0.15)] flex flex-col justify-between overflow-hidden"
          >
            <Crown size={80} aria-hidden="true" className="absolute -right-6 -bottom-6 text-yellow-500/5 group-hover:text-yellow-500/10 transition-colors pointer-events-none" />
            <div className="relative z-10">
              <div className="w-11 h-11 rounded-lg bg-yellow-500/10 border border-yellow-500/30 flex items-center justify-center text-yellow-400 mb-4 group-hover:scale-105 transition-transform">
                <Crown size={22} />
              </div>
              <h3 className="text-base font-black text-white group-hover:text-yellow-400 transition-colors uppercase tracking-tight">
                Standings
              </h3>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed font-medium">
                Complete Driver and Constructor World Championship tables, points histories and margins.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-[11px] font-black text-yellow-400 uppercase tracking-widest relative z-10">
              Explore <ChevronRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>

          <Link
            to="/live"
            className="group relative bg-neutral-900/60 backdrop-blur-xs border border-neutral-800 hover:border-cyan-500/50 rounded-xl p-5 transition-all duration-300 hover:shadow-[0_10px_30px_rgba(6,182,212,0.15)] flex flex-col justify-between overflow-hidden"
          >
            <Activity size={80} aria-hidden="true" className="absolute -right-6 -bottom-6 text-cyan-500/5 group-hover:text-cyan-500/10 transition-colors pointer-events-none" />
            <div className="relative z-10">
              <div className="w-11 h-11 rounded-lg bg-cyan-500/10 border border-cyan-500/20 flex items-center justify-center text-cyan-400 mb-4 group-hover:scale-105 transition-transform">
                <Activity size={22} />
              </div>
              <h3 className="text-base font-black text-white group-hover:text-cyan-400 transition-colors uppercase tracking-tight">
                Live Timing
              </h3>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed font-medium">
                Real-time pit-wall feed with driver gaps, sector splits and track status during active sessions.
              </p>
            </div>
            <div className="mt-5 flex items-center gap-1.5 text-[11px] font-black text-cyan-400 uppercase tracking-widest relative z-10">
              Launch Feed <ChevronRight size={14} className="group-hover:translate-x-1.5 transition-transform" />
            </div>
          </Link>
        </motion.section>

      </main>
    </div>
  );
}

export default DashboardPage;
