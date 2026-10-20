import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useLocation } from 'react-router-dom';
import {
  Search, Trophy, Crown, User, AlertTriangle, Loader2,
  Medal, ChevronRight, GitCompareArrows, Star,
  Factory, TrendingUp, TrendingDown, Sparkles,
  ArrowUpDown, ArrowUp, ArrowDown, Database, Radio,
  type LucideIcon
} from 'lucide-react';
import { teamLogos, teamColors } from '../data/teamData';
import { fetchChampionship, fetchStandings } from '../services/api';
import type { ChampionshipPayload } from '../services/api';
import { SessionResultEntry } from '../types/f1';
import ChampionshipWorm from '../components/ChampionshipWorm';
import { safeMax, toNumber } from '../utils/data';

type ChampionshipView = {
  drivers: NonNullable<ChampionshipPayload['drivers']>;
  teams: NonNullable<ChampionshipPayload['teams']>;
  session_results: SessionResultEntry[];
  source?: string;
};

const EMPTY_CHAMPIONSHIP: ChampionshipView = {
  drivers: [],
  teams: [],
  session_results: [],
};

interface LeaderboardEntry {
  id: string;
  name: string;
  team?: string;
  teamId?: string;
  points: number;
  position: number;
  wins: number;
  podiums: number;
  dnfs: number;
  pointsLastRace?: number;
  abbreviation?: string;
  driverNumber?: number;
  color?: string;
  country?: string;
}

type SortField = 'position' | 'points' | 'wins' | 'podiums' | 'dnfs' | 'pointsLastRace';
type SortOrder = 'asc' | 'desc';

// =======================================================================
// --- PODIUM CARD (Top 3 Pit-Wall Showcase) ---
// =======================================================================
interface PodiumCardProps {
  entry: LeaderboardEntry;
  rank: number;
  type: 'driver' | 'constructor';
  maxPoints: number;
  leaderPoints: number;
}

const PodiumCard = ({ entry, rank, type, maxPoints, leaderPoints }: PodiumCardProps) => {
  const teamColor = type === 'driver' && entry.team
    ? (teamColors[entry.team] || entry.color || '#EF4444')
    : (teamColors[entry.name] || entry.color || '#EF4444');
  const darkLogos = ['Audi', 'Mercedes', 'Haas'];
  const teamName = type === 'driver' && entry.team ? entry.team : entry.name;
  const logoNeedsBrightening = darkLogos.includes(teamName);

  const rankConfig: Record<number, { border: string; bg: string; shadow: string; icon: LucideIcon; iconColor: string; label: string; labelBg: string }> = {
    0: { border: 'border-yellow-500/60', bg: 'from-yellow-500/15 via-yellow-900/10', shadow: 'shadow-yellow-500/20', icon: Crown, iconColor: 'text-yellow-400', label: 'P1 // CHAMPIONSHIP LEADER', labelBg: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
    1: { border: 'border-slate-400/40', bg: 'from-slate-400/15 via-slate-800/10', shadow: 'shadow-slate-400/15', icon: Medal, iconColor: 'text-slate-300', label: 'P2 // CONTENDER', labelBg: 'bg-slate-400/20 text-slate-300 border-slate-400/40' },
    2: { border: 'border-amber-600/40', bg: 'from-amber-600/15 via-amber-900/10', shadow: 'shadow-amber-600/15', icon: Medal, iconColor: 'text-amber-500', label: 'P3 // PODIUM SPOT', labelBg: 'bg-amber-600/20 text-amber-500 border-amber-600/40' },
  };
  const cfg = rankConfig[rank] || rankConfig[2];
  const RankIcon = cfg.icon;
  const pct = maxPoints > 0 ? Math.max(5, (entry.points / maxPoints) * 100) : 5;
  const gap = rank === 0 ? null : leaderPoints - entry.points;

  const linkTo = type === 'driver'
    ? `/driver/${entry.id || entry.name.toLowerCase().replace(/\s+/g, '_')}`
    : `/team/${entry.id || entry.name.toLowerCase().replace(/\s+/g, '_')}`;

  return (
    <Link to={linkTo} className="block group">
      <div className={`relative bg-linear-to-br ${cfg.bg} to-neutral-950/90 backdrop-blur-xl border ${cfg.border} rounded-lg p-5 shadow-2xl ${cfg.shadow} overflow-hidden transition-ui duration-300 h-full`}>
        {/* Pit-Wall Laser bar */}
        <div className="absolute top-0 left-0 right-0 h-1" style={{ backgroundColor: teamColor, boxShadow: `0 0 10px ${teamColor}` }} />
        
        {/* Team color glow */}
        <div className="absolute -right-10 -bottom-10 w-36 h-36 rounded-full blur-[70px] opacity-20 pointer-events-none group-hover:opacity-35 transition-opacity" style={{ backgroundColor: teamColor }} />
        
        {/* Watermark position */}
        <div className="absolute right-3 -bottom-4 text-[6rem] font-black opacity-[0.04] pointer-events-none select-none font-mono leading-none italic" style={{ color: teamColor }}>
          {rank + 1}
        </div>

        {/* Rank badge + gap */}
        <div className="flex items-center justify-between mb-3">
          <div className={`flex items-center gap-1.5 text-[11px] font-mono font-black uppercase tracking-widest px-2.5 py-1 rounded-md border ${cfg.labelBg}`}>
            <RankIcon size={12} /> {cfg.label}
          </div>
          {gap !== null ? (
            <span className="text-[11px] font-mono text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded-sm flex items-center gap-1">
              <TrendingDown size={10} /> -{gap} PTS
            </span>
          ) : (
            <span className="text-[11px] font-mono text-yellow-400 font-bold bg-yellow-500/10 border border-yellow-500/20 px-2 py-0.5 rounded-sm flex items-center gap-1">
              <Sparkles size={10} /> +0 GAP
            </span>
          )}
        </div>

        {/* Name & Team */}
        <div className="mb-4">
          {type === 'driver' ? (
            <>
              <div className="flex items-center gap-2">
                {entry.driverNumber && (
                  <span className="font-mono text-xs font-black px-1.5 py-0.5 rounded-sm bg-neutral-800 text-neutral-300 border border-neutral-700">
                    #{entry.driverNumber}
                  </span>
                )}
                {entry.abbreviation && (
                  <span className="font-mono text-xs font-black text-neutral-400 tracking-wider">
                    {entry.abbreviation}
                  </span>
                )}
              </div>
              <h3 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase italic group-hover:text-red-400 transition-colors leading-tight md:leading-8 mt-1">
                {entry.name}
              </h3>
              <div className="flex items-center gap-2 mt-1.5">
                {entry.team && teamLogos[entry.team] && (
                  <img src={teamLogos[entry.team]} alt={entry.team} className="h-4 w-auto object-contain" style={logoNeedsBrightening ? { filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.8))' } : { filter: 'drop-shadow(0px 1px 3px rgba(0,0,0,0.5))' }} />
                )}
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">{entry.team}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-3">
              {teamLogos[entry.name] && (
                <img src={teamLogos[entry.name]} alt={entry.name} className="h-8 w-auto object-contain" style={logoNeedsBrightening ? { filter: 'drop-shadow(0px 0px 3px rgba(255,255,255,0.8))' } : { filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))' }} />
              )}
              <h3 className="text-xl md:text-2xl font-black text-white tracking-tight uppercase italic group-hover:text-red-400 transition-colors leading-tight md:leading-8">
                {entry.name}
              </h3>
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div className="flex items-end justify-between gap-4">
          <div>
            <span className="text-3xl md:text-4xl font-black font-mono tracking-tight" style={{ color: teamColor, textShadow: `0 0 16px ${teamColor}60` }}>
              {entry.points}
            </span>
            <span className="text-[11px] text-neutral-500 uppercase font-mono font-bold tracking-widest block mt-0.5">Points</span>
          </div>
          <div className="flex gap-2 text-center">
            <div className="bg-neutral-950/70 border border-neutral-800 px-2.5 py-1.5 rounded-lg">
              <Trophy size={12} className="text-yellow-500 mx-auto mb-0.5" />
              <span className="font-mono font-black text-white text-sm block leading-none">{entry.wins}</span>
              <span className="text-[8px] text-neutral-500 uppercase font-bold">Wins</span>
            </div>
            <div className="bg-neutral-950/70 border border-neutral-800 px-2.5 py-1.5 rounded-lg">
              <Medal size={12} className="text-amber-400 mx-auto mb-0.5" />
              <span className="font-mono font-black text-white text-sm block leading-none">{entry.podiums}</span>
              <span className="text-[8px] text-neutral-500 uppercase font-bold">Pods</span>
            </div>
          </div>
        </div>

        {/* Points bar */}
        <div className="mt-3.5 w-full bg-neutral-950/80 rounded-full h-1.5 overflow-hidden border border-neutral-800 relative">
          <div className="h-full rounded-full transition-[width] duration-700 ease-out" style={{ width: `${pct}%`, backgroundColor: teamColor, boxShadow: `0 0 8px ${teamColor}` }} />
        </div>
      </div>
    </Link>
  );
};

// =======================================================================
// --- MAIN STATS PAGE ---
// =======================================================================
const StatsPage = () => {
  const location = useLocation();
  const [activeTab, setActiveTab] = useState<'drivers' | 'constructors' | 'progression'>(
    location.state?.tab || 'drivers'
  );
  const [searchTerm, setSearchTerm] = useState('');
  const [sortField, setSortField] = useState<SortField>('position');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const currentYear = new Date().getFullYear();

  // Fetch championship standings from the backend (relational SQLite / fallback)
  const { data, isLoading: loading, error, refetch } = useQuery<ChampionshipView>({
    queryKey: ['standings', currentYear],
    queryFn: async () => {
      try {
        const result = await fetchStandings(currentYear);
        return {
          drivers: result.drivers ?? [],
          teams: result.teams ?? [],
          session_results: result.session_results ?? [],
          source: (result as { source?: string }).source || 'sqlite_database',
        };
      } catch {
        // Fallback to fetchChampionship if route differs
        const result = await fetchChampionship(currentYear);
        return {
          drivers: result.drivers ?? [],
          teams: result.teams ?? [],
          session_results: result.session_results ?? [],
          source: 'cache_fallback',
        };
      }
    },
  });

  const { drivers: rawDrivers, teams: rawTeams, session_results: sessionResults } =
    data ?? EMPTY_CHAMPIONSHIP;

  // The WORM chart needs real per-round session results (Race + Sprint
  // merged per round). The relational standings payload has none, so the
  // championship cache is fetched alongside — the same ['championship']
  // query the Simulator and Compare pages share, so it costs nothing extra.
  const { data: championshipData } = useQuery<ChampionshipPayload>({
    queryKey: ['championship', currentYear],
    queryFn: () => fetchChampionship(currentYear),
  });

  // Prefer the championship session_results; the standings fallback covers
  // the case where the standings route itself returned FastF1-shaped data.
  const wormSessionResults =
    championshipData?.session_results?.length
      ? championshipData.session_results
      : sessionResults;

  // Normalize driver data
  const normalizedDrivers: LeaderboardEntry[] = useMemo(() => {
    return rawDrivers.map((d, index) => {
      const id = d.id || (d.name ? d.name.toLowerCase().replace(/\s+/g, '_') : `driver_${index}`);
      const team = d.team || '';
      const color = teamColors[team] || d.teamColor || '#EF4444';
      return {
        id,
        name: d.name || '-',
        team,
        teamId: (d as { team_id?: string }).team_id || team.toLowerCase().replace(/\s+/g, '_'),
        points: toNumber(d.points),
        position: toNumber(d.position) || index + 1,
        wins: toNumber(d.wins),
        podiums: toNumber(d.podiums),
        dnfs: toNumber(d.dnfs),
        pointsLastRace: toNumber(d.points_last_race),
        abbreviation: d.abbreviation || d.code || '',
        driverNumber: d.driver_number || d.number,
        color,
      };
    });
  }, [rawDrivers]);

  // Normalize constructor data
  const normalizedTeams: LeaderboardEntry[] = useMemo(() => {
    return rawTeams.map((t, index) => {
      const id = t.id || (t.name ? t.name.toLowerCase().replace(/\s+/g, '_') : `team_${index}`);
      const color = teamColors[t.name] || '#EF4444';
      return {
        id,
        name: t.name || '-',
        points: toNumber(t.points),
        position: toNumber(t.position) || index + 1,
        wins: toNumber(t.wins),
        podiums: toNumber(t.podiums),
        dnfs: toNumber((t as { dnfs?: number }).dnfs),
        pointsLastRace: toNumber((t as { points_last_race?: number }).points_last_race),
        color,
      };
    });
  }, [rawTeams]);

  // Compute maximums and leaders
  const maxDriverPoints = safeMax(normalizedDrivers.map((d) => d.points), 1);
  const maxTeamPoints = safeMax(normalizedTeams.map((t) => t.points), 1);
  const leaderDriverPoints = normalizedDrivers[0]?.points || 0;
  const leaderTeamPoints = normalizedTeams[0]?.points || 0;

  // Filtered and sorted dataset
  const activeEntries = activeTab === 'drivers' ? normalizedDrivers : normalizedTeams;
  const maxPoints = activeTab === 'drivers' ? maxDriverPoints : maxTeamPoints;
  const leaderPoints = activeTab === 'drivers' ? leaderDriverPoints : leaderTeamPoints;

  const filteredEntries = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return activeEntries;

    return activeEntries.filter((entry) => {
      const matchName = entry.name.toLowerCase().includes(term);
      const matchTeam = entry.team ? entry.team.toLowerCase().includes(term) : false;
      const matchAbbr = entry.abbreviation ? entry.abbreviation.toLowerCase().includes(term) : false;
      const matchNumber = entry.driverNumber ? entry.driverNumber.toString().includes(term) : false;
      return matchName || matchTeam || matchAbbr || matchNumber;
    });
  }, [activeEntries, searchTerm]);

  const sortedEntries = useMemo(() => {
    return [...filteredEntries].sort((a, b) => {
      const valA = a[sortField] ?? 0;
      const valB = b[sortField] ?? 0;

      if (sortField === 'position') {
        return sortOrder === 'asc' ? (a.position - b.position) : (b.position - a.position);
      }

      if (valA < valB) return sortOrder === 'asc' ? -1 : 1;
      if (valA > valB) return sortOrder === 'asc' ? 1 : -1;
      return a.position - b.position;
    });
  }, [filteredEntries, sortField, sortOrder]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder(field === 'position' ? 'asc' : 'desc');
    }
  };

  // Top 3 Podium for banner
  const podiumEntries = !searchTerm && sortField === 'position' && sortOrder === 'asc'
    ? activeEntries.slice(0, 3)
    : [];

  // Summary HUD statistics
  const totalWins = useMemo(() => normalizedDrivers.reduce((sum, d) => sum + d.wins, 0), [normalizedDrivers]);
  const totalPodiums = useMemo(() => normalizedDrivers.reduce((sum, d) => sum + d.podiums, 0), [normalizedDrivers]);

  return (
    <div className="bg-tarmac min-h-screen text-white font-sans relative selection:bg-red-500 selection:text-white">
      {/* Background Pit-Wall Grid & Holographic Glows */}
      <div className="fixed inset-0 xl:left-72 bg-[radial-gradient(#1f2937_1px,transparent_1px)] bg-size-[24px_24px] opacity-15 pointer-events-none" />
      <div className="fixed inset-0 xl:left-72 bg-linear-to-b from-red-950/20 via-neutral-950/90 to-neutral-950 pointer-events-none" />
      <div className="fixed top-0 left-1/4 xl:left-[35%] w-96 h-96 bg-red-600/10 blur-[130px] rounded-full pointer-events-none" />
      <div className="fixed bottom-1/4 right-1/4 w-96 h-96 bg-cyan-600/5 blur-[140px] rounded-full pointer-events-none" />

      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-10 py-6 md:py-8 xl:py-10 relative z-10">
        {/* Header telemetry HUD */}
        <section className="mb-8">
          <div className="flex flex-col xl:flex-row xl:items-end justify-between gap-6">
            <div>
              {/* Telemetry status badge */}
              <div className="flex items-center gap-2 mb-2 font-mono text-[11px] text-neutral-400">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300">
                  <Database size={12} className="text-red-500" />
                  SQLITE ORM RELATIONAL ENGINE
                </span>
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-900/60 border border-neutral-800/80 text-emerald-400">
                  <Radio size={12} className="" />
                  FEED LIVE
                </span>
              </div>

              <h1 className="text-4xl md:text-6xl font-black tracking-tight italic flex items-center gap-3">
                <Trophy className="text-yellow-500 " size={44} />
                Championship <span className=" text-chalk">Stats</span>
              </h1>
              <p className="text-neutral-400 mt-1 text-sm md:text-base font-medium">
                Official {currentYear} FIA Formula 1 World Championship Leaderboard & Telemetry Standings.
              </p>
            </div>

            {/* Controls: Tab Switcher & H2H Compare Shortcut */}
            <div className="flex flex-wrap items-center gap-3">
              <Link
                to="/compare"
                className="inline-flex items-center gap-2 px-4 py-2 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 hover:border-neutral-700 rounded-md text-xs font-mono font-bold tracking-wider uppercase transition-ui shadow-lg"
              >
                <GitCompareArrows size={15} className="text-red-500" /> H2H Compare
              </Link>

              <div className="flex bg-neutral-900/90 backdrop-blur-sm border border-neutral-800 p-1 rounded-md shadow-xl">
                <button
                  onClick={() => { setActiveTab('drivers'); setSearchTerm(''); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black font-mono uppercase tracking-wider transition-ui ${
                    activeTab === 'drivers'
                      ? 'bg-linear-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-600/30'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  <User size={14} /> Drivers
                </button>
                <button
                  onClick={() => { setActiveTab('constructors'); setSearchTerm(''); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black font-mono uppercase tracking-wider transition-ui ${
                    activeTab === 'constructors'
                      ? 'bg-linear-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-600/30'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  <Factory size={14} /> Constructors
                </button>
                <button
                  onClick={() => { setActiveTab('progression'); setSearchTerm(''); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black font-mono uppercase tracking-wider transition-ui ${
                    activeTab === 'progression'
                      ? 'bg-linear-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-600/30'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800/60'
                  }`}
                >
                  <TrendingUp size={14} /> Worm
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Pit-Wall HUD Telemetry Gauges */}
        {!loading && !error && activeTab !== 'progression' && (
          <section className="mb-8 grid grid-cols-2 lg:grid-cols-4 gap-3">
            <div className="bg-neutral-950/80 backdrop-blur-sm border border-neutral-800/80 rounded-md p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center shrink-0">
                <Crown size={18} className="text-yellow-400" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-neutral-500 uppercase font-mono font-bold tracking-widest block">Leader</span>
                <span className="font-black text-white text-sm block truncate leading-tight">
                  {activeTab === 'drivers' ? (normalizedDrivers[0]?.name || '-') : (normalizedTeams[0]?.name || '-')}
                </span>
              </div>
            </div>

            <div className="bg-neutral-950/80 backdrop-blur-sm border border-neutral-800/80 rounded-md p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-red-500/10 border border-red-500/20 flex items-center justify-center shrink-0">
                <Star size={18} className="text-red-400" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-neutral-500 uppercase font-mono font-bold tracking-widest block">Top Points</span>
                <span className="font-mono font-black text-white text-sm block leading-tight">
                  {activeTab === 'drivers' ? leaderDriverPoints : leaderTeamPoints} PTS
                </span>
              </div>
            </div>

            <div className="bg-neutral-950/80 backdrop-blur-sm border border-neutral-800/80 rounded-md p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shrink-0">
                <Trophy size={18} className="text-emerald-400" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-neutral-500 uppercase font-mono font-bold tracking-widest block">Total Wins</span>
                <span className="font-mono font-black text-white text-sm block leading-tight">{totalWins}</span>
              </div>
            </div>

            <div className="bg-neutral-950/80 backdrop-blur-sm border border-neutral-800/80 rounded-md p-3.5 flex items-center gap-3">
              <div className="w-9 h-9 rounded-lg bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                <Medal size={18} className="text-amber-400" />
              </div>
              <div className="min-w-0">
                <span className="text-[11px] text-neutral-500 uppercase font-mono font-bold tracking-widest block">Total Podiums</span>
                <span className="font-mono font-black text-white text-sm block leading-tight">{totalPodiums}</span>
              </div>
            </div>
          </section>
        )}

        {/* Error Notification */}
        {error && (
          <div className="bg-red-950/40 backdrop-blur-sm border border-red-500/50 rounded-lg p-8 text-center mb-8 max-w-lg mx-auto ">
            <AlertTriangle className="text-red-500 mx-auto mb-4" size={40} />
            <h3 className="font-black text-red-400 text-xl uppercase tracking-wider">Failed to load statistics</h3>
            <p className="text-neutral-300 text-sm mt-2 mb-6">{error?.message}</p>
            <button
              onClick={() => { void refetch(); }}
              className="px-6 py-2.5 bg-red-600 hover:bg-red-500 text-white rounded-md font-mono font-black text-xs uppercase tracking-wider inline-flex items-center gap-2 transition-ui shadow-lg hover:shadow-red-500/40"
            >
              <Loader2 size={14} /> Retry Connection
            </button>
          </div>
        )}

        {/* Loading Skeleton */}
        {loading ? (
          <div className="space-y-4 motion-safe:animate-pulse">
            <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4 mb-6">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-48 bg-neutral-900/40 border border-neutral-800/80 rounded-lg" />
              ))}
            </div>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="h-16 bg-neutral-900/40 border border-neutral-800/80 rounded-md" />
            ))}
          </div>
        ) : (
          <div>
            {/* ================================================================= */}
            {/* --- TAB CONTENT: DRIVERS & CONSTRUCTORS LEADERBOARD TABLE --- */}
            {/* ================================================================= */}
            {activeTab !== 'progression' && (
              <div className="space-y-6">
                {/* Top 3 Podium Showcase Cards (shown when not actively searching) */}
                {podiumEntries.length > 0 && (
                  <section>
                    <div className="flex items-center gap-2 mb-3">
                      <Sparkles size={15} className="text-yellow-400" />
                      <h2 className="text-xs font-mono font-black text-neutral-400 tracking-normal">
                        {activeTab === 'drivers' ? 'Drivers Championship Podium' : 'Constructors Championship Podium'}
                      </h2>
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-4">
                      {podiumEntries.map((entry, idx) => (
                        <PodiumCard
                          key={entry.id}
                          entry={entry}
                          rank={idx}
                          type={activeTab === 'drivers' ? 'driver' : 'constructor'}
                          maxPoints={maxPoints}
                          leaderPoints={leaderPoints}
                        />
                      ))}
                    </div>
                  </section>
                )}

                {/* Search & Leaderboard Toolbar */}
                <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-2">
                  <div className="relative flex-1 max-w-md group">
                    <input
                      type="search"
                      aria-label={activeTab === 'drivers' ? 'Filter drivers' : 'Filter constructors'}
                      name="standings-filter"
                      autoComplete="off"
                      spellCheck={false}
                      placeholder={activeTab === 'drivers' ? 'Filter by driver, team, or number (#12)…' : 'Filter by constructor…'}
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="w-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-md py-2.5 pl-10 pr-4 text-white placeholder-neutral-500 text-xs font-mono font-medium focus:outline-hidden focus:border-red-500 focus:ring-1 focus:ring-red-500/50 transition-ui shadow-inner"
                    />
                    <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-500 group-focus-within:text-red-500 transition-colors" size={15} />
                    {searchTerm && (
                      <button
                        onClick={() => setSearchTerm('')}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 hover:text-white text-xs font-mono font-bold"
                      >
                        CLEAR
                      </button>
                    )}
                  </div>

                  <div className="flex items-center gap-2 text-xs font-mono text-neutral-400 self-end sm:self-auto">
                    <span>SHOWING:</span>
                    <span className="font-black text-white px-2 py-0.5 rounded-sm bg-neutral-900 border border-neutral-800">
                      {sortedEntries.length} {activeTab === 'drivers' ? 'DRIVERS' : 'CONSTRUCTORS'}
                    </span>
                  </div>
                </div>

                {/* SLEEK PIT-WALL INTERACTIVE LEADERBOARD TABLE */}
                <div className="bg-neutral-950/80 backdrop-blur-sm border border-neutral-800/90 rounded-lg overflow-hidden shadow-2xl">
                  <div className="overflow-x-auto">
                    <table className="w-full text-left border-collapse whitespace-nowrap min-w-[800px]">
                      <thead>
                        <tr className="border-b border-neutral-800/90 bg-neutral-900/70 text-[11px] font-mono font-black uppercase tracking-wider text-neutral-400 select-none">
                          <th
                            onClick={() => handleSort('position')}
                            className="py-3.5 px-3 cursor-pointer hover:text-white transition-colors w-14 min-w-[56px] max-w-[56px] sticky left-0 z-20 bg-neutral-900/95 backdrop-blur-sm"
                          >
                            <div className="flex items-center gap-1">
                              POS
                              {sortField === 'position' ? (
                                sortOrder === 'asc' ? <ArrowUp size={11} className="text-red-500" /> : <ArrowDown size={11} className="text-red-500" />
                              ) : <ArrowUpDown size={11} className="text-neutral-600" />}
                            </div>
                          </th>
                          <th className="py-3.5 px-4 sticky left-[56px] z-20 bg-neutral-900/95 backdrop-blur-sm shadow-[4px_0_8px_rgba(0,0,0,0.4)] min-w-[180px]">
                            {activeTab === 'drivers' ? 'DRIVER & TEAM' : 'CONSTRUCTOR'}
                          </th>
                          <th
                            onClick={() => handleSort('points')}
                            className="py-3.5 px-4 cursor-pointer hover:text-white transition-colors text-right"
                          >
                            <div className="flex items-center justify-end gap-1">
                              PTS
                              {sortField === 'points' ? (
                                sortOrder === 'asc' ? <ArrowUp size={11} className="text-red-500" /> : <ArrowDown size={11} className="text-red-500" />
                              ) : <ArrowUpDown size={11} className="text-neutral-600" />}
                            </div>
                          </th>
                          <th className="py-3.5 px-4 text-right hidden sm:table-cell">
                            GAP
                          </th>
                          <th
                            onClick={() => handleSort('wins')}
                            className="py-3.5 px-3 cursor-pointer hover:text-white transition-colors text-center hidden md:table-cell w-20"
                          >
                            <div className="flex items-center justify-center gap-1">
                              WINS
                              {sortField === 'wins' ? (
                                sortOrder === 'asc' ? <ArrowUp size={11} className="text-red-500" /> : <ArrowDown size={11} className="text-red-500" />
                              ) : <ArrowUpDown size={11} className="text-neutral-600" />}
                            </div>
                          </th>
                          <th
                            onClick={() => handleSort('podiums')}
                            className="py-3.5 px-3 cursor-pointer hover:text-white transition-colors text-center hidden md:table-cell w-20"
                          >
                            <div className="flex items-center justify-center gap-1">
                              PODS
                              {sortField === 'podiums' ? (
                                sortOrder === 'asc' ? <ArrowUp size={11} className="text-red-500" /> : <ArrowDown size={11} className="text-red-500" />
                              ) : <ArrowUpDown size={11} className="text-neutral-600" />}
                            </div>
                          </th>
                          <th
                            onClick={() => handleSort('dnfs')}
                            className="py-3.5 px-3 cursor-pointer hover:text-white transition-colors text-center hidden lg:table-cell w-20"
                          >
                            <div className="flex items-center justify-center gap-1">
                              DNFS
                              {sortField === 'dnfs' ? (
                                sortOrder === 'asc' ? <ArrowUp size={11} className="text-red-500" /> : <ArrowDown size={11} className="text-red-500" />
                              ) : <ArrowUpDown size={11} className="text-neutral-600" />}
                            </div>
                          </th>
                          <th
                            onClick={() => handleSort('pointsLastRace')}
                            className="py-3.5 px-3 cursor-pointer hover:text-white transition-colors text-center hidden lg:table-cell w-24"
                          >
                            <div className="flex items-center justify-center gap-1">
                              LAST GP
                              {sortField === 'pointsLastRace' ? (
                                sortOrder === 'asc' ? <ArrowUp size={11} className="text-red-500" /> : <ArrowDown size={11} className="text-red-500" />
                              ) : <ArrowUpDown size={11} className="text-neutral-600" />}
                            </div>
                          </th>
                          <th className="py-3.5 px-4 text-center w-12">
                            VIEW
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-neutral-900/90 font-mono text-sm">
                        {sortedEntries.length === 0 ? (
                          <tr>
                            <td colSpan={9} className="py-12 text-center text-neutral-500 font-mono text-xs">
                              NO MATCHING {activeTab === 'drivers' ? 'DRIVERS' : 'CONSTRUCTORS'} FOUND FOR "{searchTerm}"
                            </td>
                          </tr>
                        ) : (
                          sortedEntries.map((entry) => {
                            const teamColor = entry.color || (entry.team ? teamColors[entry.team] : teamColors[entry.name]) || '#EF4444';
                            const linkTo = activeTab === 'drivers'
                              ? `/driver/${entry.id}`
                              : `/team/${entry.id}`;
                            const pct = maxPoints > 0 ? Math.max(3, (entry.points / maxPoints) * 100) : 3;
                            const gap = leaderPoints - entry.points;
                            const isP1 = entry.position === 1;
                            const isP2 = entry.position === 2;
                            const isP3 = entry.position === 3;
                            const inPointsZone = entry.position <= 10;

                            return (
                              <tr
                                key={entry.id}
                                className="group hover:bg-neutral-900/60 transition-colors relative"
                              >
                                {/* Position Column - Sticky on mobile */}
                                <td className="py-3 px-3 relative sticky left-0 z-10 bg-neutral-950/95 backdrop-blur-sm w-14 min-w-[56px] max-w-[56px]">
                                  {/* Team laser color indicator */}
                                  <div
                                    className="absolute left-0 top-0 bottom-0 w-1 group-hover:w-1.5 transition-ui"
                                    style={{ backgroundColor: teamColor, boxShadow: `0 0 8px ${teamColor}80` }}
                                  />
                                  <div className="flex items-center gap-2 pl-2">
                                    {isP1 ? (
                                      <span className="w-7 h-7 rounded-md bg-yellow-500/20 border border-yellow-500/50 text-yellow-400 font-black text-xs flex items-center justify-center">
                                        P1
                                      </span>
                                    ) : isP2 ? (
                                      <span className="w-7 h-7 rounded-md bg-slate-400/20 border border-slate-400/50 text-slate-300 font-black text-xs flex items-center justify-center">
                                        P2
                                      </span>
                                    ) : isP3 ? (
                                      <span className="w-7 h-7 rounded-md bg-amber-600/20 border border-amber-600/50 text-amber-500 font-black text-xs flex items-center justify-center">
                                        P3
                                      </span>
                                    ) : inPointsZone ? (
                                      <span className="w-7 h-7 rounded-md bg-neutral-900 border border-neutral-700/80 text-white font-bold text-xs flex items-center justify-center group-hover:border-neutral-500">
                                        {entry.position}
                                      </span>
                                    ) : (
                                      <span className="w-7 h-7 rounded-md text-neutral-500 font-medium text-xs flex items-center justify-center">
                                        {entry.position}
                                      </span>
                                    )}
                                  </div>
                                </td>

                                {/* Name & Team - Sticky on mobile */}
                                <td className="py-3 px-4 sticky left-[56px] z-10 bg-neutral-950/95 backdrop-blur-sm shadow-[4px_0_8px_rgba(0,0,0,0.4)] min-w-[180px]">
                                  <Link to={linkTo} className="flex items-center gap-3 group-hover:text-red-400 transition-colors">
                                    {activeTab === 'drivers' ? (
                                      <>
                                        {entry.driverNumber && (
                                          <span className="font-mono text-xs font-black px-1.5 py-0.5 rounded-sm bg-neutral-900 text-neutral-400 border border-neutral-800 hidden sm:inline-block">
                                            #{entry.driverNumber}
                                          </span>
                                        )}
                                        {entry.abbreviation && (
                                          <span className="font-mono text-xs font-black text-neutral-400 tracking-wider">
                                            {entry.abbreviation}
                                          </span>
                                        )}
                                        <div className="min-w-0">
                                          <span className="font-black text-sm text-white group-hover:text-red-400 transition-colors uppercase italic truncate block">
                                            {entry.name}
                                          </span>
                                          <div className="flex items-center gap-1.5 mt-0.5">
                                            {entry.team && teamLogos[entry.team] && (
                                              <img src={teamLogos[entry.team]} alt={entry.team} className="h-3 w-auto object-contain opacity-70" />
                                            )}
                                            <span className="text-[11px] text-neutral-400 uppercase tracking-wider truncate">
                                              {entry.team}
                                            </span>
                                          </div>
                                        </div>
                                      </>
                                    ) : (
                                      <div className="flex items-center gap-3">
                                        {teamLogos[entry.name] && (
                                          <img src={teamLogos[entry.name]} alt={entry.name} className="h-6 w-auto object-contain" />
                                        )}
                                        <span className="font-black text-sm text-white group-hover:text-red-400 transition-colors uppercase italic truncate">
                                          {entry.name}
                                        </span>
                                      </div>
                                    )}
                                  </Link>
                                </td>

                                {/* Points & Progress Bar */}
                                <td className="py-3 px-4 text-right">
                                  <div className="inline-block text-right">
                                    <span className="font-mono font-black text-base text-white block leading-none">
                                      {entry.points}
                                    </span>
                                    <div className="w-20 sm:w-24 bg-neutral-900 rounded-full h-1 mt-1 overflow-hidden border border-neutral-800 ml-auto">
                                      <div
                                        className="h-full rounded-full transition-ui duration-500"
                                        style={{ width: `${pct}%`, backgroundColor: teamColor }}
                                      />
                                    </div>
                                  </div>
                                </td>

                                {/* Gap to Leader */}
                                <td className="py-3 px-4 text-right hidden sm:table-cell font-mono text-xs">
                                  {isP1 ? (
                                    <span className="text-yellow-400 font-bold bg-yellow-500/10 px-1.5 py-0.5 rounded-sm border border-yellow-500/20">
                                      LEADER
                                    </span>
                                  ) : (
                                    <span className="text-neutral-400">
                                      -{gap}
                                    </span>
                                  )}
                                </td>

                                {/* Wins */}
                                <td className="py-3 px-3 text-center hidden md:table-cell font-mono">
                                  {entry.wins > 0 ? (
                                    <span className="inline-flex items-center gap-1 font-bold text-yellow-400 bg-yellow-500/10 px-2 py-0.5 rounded-md border border-yellow-500/20 text-xs">
                                      <Trophy size={10} /> {entry.wins}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-600 text-xs">-</span>
                                  )}
                                </td>

                                {/* Podiums */}
                                <td className="py-3 px-3 text-center hidden md:table-cell font-mono">
                                  {entry.podiums > 0 ? (
                                    <span className="inline-flex items-center gap-1 font-bold text-amber-300 bg-amber-500/10 px-2 py-0.5 rounded-md border border-amber-500/20 text-xs">
                                      <Medal size={10} /> {entry.podiums}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-600 text-xs">-</span>
                                  )}
                                </td>

                                {/* DNFs */}
                                <td className="py-3 px-3 text-center hidden lg:table-cell font-mono">
                                  {entry.dnfs > 0 ? (
                                    <span className="inline-flex items-center gap-1 font-bold text-red-400 bg-red-500/10 px-2 py-0.5 rounded-md border border-red-500/20 text-xs">
                                      <AlertTriangle size={10} /> {entry.dnfs}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-600 text-xs">0</span>
                                  )}
                                </td>

                                {/* Last GP Points */}
                                <td className="py-3 px-3 text-center hidden lg:table-cell font-mono text-xs">
                                  {entry.pointsLastRace && entry.pointsLastRace > 0 ? (
                                    <span className="font-bold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded-md border border-emerald-500/20">
                                      +{entry.pointsLastRace}
                                    </span>
                                  ) : (
                                    <span className="text-neutral-600">0</span>
                                  )}
                                </td>

                                {/* Action Link */}
                                <td className="py-3 px-4 text-center">
                                  <Link
                                    to={linkTo}
                                    className="inline-flex items-center justify-center w-7 h-7 rounded-lg bg-neutral-900 border border-neutral-800 text-neutral-400 hover:text-white hover:border-neutral-700 transition-colors"
                                  >
                                    <ChevronRight size={14} />
                                  </Link>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}

            {/* ================================================================= */}
            {/* --- TAB CONTENT: PROGRESSION WORM --- */}
            {/* ================================================================= */}
            {activeTab === 'progression' && (
              <div className="space-y-4">
                <ChampionshipWorm
                  sessionResults={wormSessionResults}
                  drivers={rawDrivers}
                  teams={rawTeams}
                />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default StatsPage;
