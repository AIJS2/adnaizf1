import { DriverProfile, TeamProfile } from '../types/f1';
import { useState, useEffect, useMemo } from 'react';
import { Link, useLocation } from 'react-router-dom';
import {
  Search, Trophy, Crown, User, AlertTriangle, Loader2,
  Medal, ChevronRight, GitCompareArrows, Star,
  Factory, Shield, TrendingUp, TrendingDown, Sparkles
} from 'lucide-react';
import { API_URL } from '../config';
import { teamLogos, teamColors } from '../data/teamData';
import ChampionshipWorm from '../components/ChampionshipWorm';

interface EntryProps {
  id?: string;
  driverId?: string;
  name?: string;
  team?: string;
  points?: number;
  wins?: number;
  podiums?: number;
  dnfs?: number;
  abbreviation?: string;
}

interface PodiumCardProps {
  entry: EntryProps;
  rank: number;
  type: 'driver' | 'constructor';
  maxPoints: number;
  leaderPoints: number;
}

interface StandingRowProps {
  entry: EntryProps;
  index: number;
  type: 'driver' | 'constructor';
  maxPoints: number;
  leaderPoints: number;
  searchTerm?: string;
}

// =======================================================================
// --- PODIUM CARD (Top 3 special treatment) ---
// =======================================================================
const PodiumCard = ({ entry, rank, type, maxPoints, leaderPoints }: PodiumCardProps) => {
  const teamColor = type === 'driver' && entry.team
    ? (teamColors[entry.team] || '#EF4444')
    : (teamColors[entry.name] || '#EF4444');
  const darkLogos = ['Audi', 'Mercedes', 'Haas'];
  const teamName = type === 'driver' && entry.team ? entry.team : entry.name;
  const logoNeedsBrightening = darkLogos.includes(teamName);

  const rankConfig: Record<number, { border: string; bg: string; shadow: string; icon: any; iconColor: string; label: string; labelBg: string }> = {
    0: { border: 'border-yellow-500/60', bg: 'from-yellow-500/10 via-yellow-900/5', shadow: 'shadow-yellow-500/20', icon: Crown, iconColor: 'text-yellow-400', label: '1ST', labelBg: 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' },
    1: { border: 'border-slate-400/40', bg: 'from-slate-400/10 via-slate-800/5', shadow: 'shadow-slate-400/15', icon: Medal, iconColor: 'text-slate-300', label: '2ND', labelBg: 'bg-slate-400/20 text-slate-300 border-slate-400/40' },
    2: { border: 'border-amber-600/40', bg: 'from-amber-600/10 via-amber-900/5', shadow: 'shadow-amber-600/15', icon: Medal, iconColor: 'text-amber-500', label: '3RD', labelBg: 'bg-amber-600/20 text-amber-500 border-amber-600/40' },
  };
  const cfg = rankConfig[rank];
  const RankIcon = cfg.icon;
  const pct = maxPoints > 0 ? Math.max(5, (entry.points / maxPoints) * 100) : 5;
  const gap = rank === 0 ? null : leaderPoints - entry.points;

  const linkTo = type === 'driver'
    ? `/driver/${entry.id || entry.name.toLowerCase().replace(/\s+/g, '_')}`
    : `/team/${entry.id || entry.name.toLowerCase().replace(/\s+/g, '_')}`;

  return (
    <Link to={linkTo} className="block group">
      <div className={`relative bg-gradient-to-br ${cfg.bg} to-neutral-950/80 backdrop-blur-xl border ${cfg.border} rounded-3xl p-6 shadow-2xl ${cfg.shadow} overflow-hidden transition-all duration-300 group-hover:-translate-y-2 group-hover:shadow-2xl h-full`}>
        {/* Team color glow */}
        <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-[80px] opacity-15 pointer-events-none group-hover:opacity-30 transition-opacity" style={{ backgroundColor: teamColor }} />
        {/* Watermark number */}
        <div className="absolute right-3 -bottom-4 text-[7rem] font-black opacity-[0.03] pointer-events-none select-none font-mono leading-none" style={{ color: teamColor }}>
          {rank + 1}
        </div>

        {/* Rank badge */}
        <div className="flex items-center justify-between mb-4">
          <div className={`flex items-center gap-1.5 text-[10px] font-black uppercase tracking-widest px-2.5 py-1 rounded-lg border ${cfg.labelBg}`}>
            <RankIcon size={12} /> {cfg.label}
          </div>
          {gap !== null && (
            <span className="text-[11px] font-mono text-red-400 font-bold bg-red-500/10 border border-red-500/20 px-2 py-0.5 rounded flex items-center gap-1">
              <TrendingDown size={10} /> -{gap}
            </span>
          )}
        </div>

        {/* Name & Team */}
        <div className="mb-4">
          {type === 'driver' ? (
            <>
              <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase italic group-hover:text-red-400 transition-colors leading-tight">
                {entry.name}
              </h3>
              <div className="flex items-center gap-2.5 mt-2">
                {entry.team && teamLogos[entry.team] && (
                  <img src={teamLogos[entry.team]} alt={entry.team} className="h-5 w-auto object-contain" style={logoNeedsBrightening ? { filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.8))' } : { filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))' }} />
                )}
                <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">{entry.team}</span>
              </div>
            </>
          ) : (
            <div className="flex items-center gap-4">
              {teamLogos[entry.name] && (
                <img src={teamLogos[entry.name]} alt={entry.name} className="h-10 w-auto object-contain" style={logoNeedsBrightening ? { filter: 'drop-shadow(0px 0px 3px rgba(255,255,255,0.8))' } : { filter: 'drop-shadow(0px 2px 4px rgba(0,0,0,0.5))' }} />
              )}
              <h3 className="text-2xl md:text-3xl font-black text-white tracking-tight uppercase italic group-hover:text-red-400 transition-colors leading-tight">
                {entry.name}
              </h3>
            </div>
          )}
        </div>

        {/* Stats row */}
        <div className="flex items-end justify-between gap-4">
          <div className="flex items-center gap-4">
            <div>
              <span className="text-4xl md:text-5xl font-black font-mono" style={{ color: teamColor, textShadow: `0 0 20px ${teamColor}60` }}>
                {entry.points}
              </span>
              <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest block mt-0.5">Points</span>
            </div>
          </div>
          <div className="flex gap-3 text-center">
            {entry.wins !== undefined && (
              <div className="bg-neutral-950/60 border border-neutral-800 px-3 py-2 rounded-xl">
                <Trophy size={14} className="text-yellow-500 mx-auto mb-1" />
                <span className="font-black text-white text-lg block leading-none">{entry.wins}</span>
                <span className="text-[9px] text-neutral-500 uppercase font-bold">Wins</span>
              </div>
            )}
            {entry.podiums !== undefined && (
              <div className="bg-neutral-950/60 border border-neutral-800 px-3 py-2 rounded-xl">
                <Medal size={14} className="text-amber-400 mx-auto mb-1" />
                <span className="font-black text-white text-lg block leading-none">{entry.podiums}</span>
                <span className="text-[9px] text-neutral-500 uppercase font-bold">Podiums</span>
              </div>
            )}
            {entry.dnfs !== undefined && entry.dnfs > 0 && (
              <div className="bg-neutral-950/60 border border-neutral-800 px-3 py-2 rounded-xl">
                <AlertTriangle size={14} className="text-red-500 mx-auto mb-1" />
                <span className="font-black text-white text-lg block leading-none">{entry.dnfs}</span>
                <span className="text-[9px] text-neutral-500 uppercase font-bold">DNFs</span>
              </div>
            )}
          </div>
        </div>

        {/* Points bar */}
        <div className="mt-4 w-full bg-neutral-950/80 rounded-full h-2 overflow-hidden border border-neutral-800 relative">
          <div className="h-full rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${pct}%`, backgroundColor: teamColor, boxShadow: `0 0 12px ${teamColor}` }}>
            <div className="absolute top-0 right-0 bottom-0 w-16 bg-gradient-to-l from-white/30 to-transparent" />
          </div>
        </div>
      </div>
    </Link>
  );
};

// =======================================================================
// --- STANDING ROW (P4 and below) ---
// =======================================================================
const StandingRow = ({ entry, index, type, maxPoints, leaderPoints, searchTerm }: StandingRowProps) => {
  const teamColor = type === 'driver' && entry.team ? (teamColors[entry.team] || '#EF4444') : (teamColors[entry.name] || '#EF4444');
  const darkLogos = ['Audi', 'Mercedes', 'Haas'];
  const pct = maxPoints > 0 ? Math.max(5, (entry.points / maxPoints) * 100) : 5;
  const gap = leaderPoints - entry.points;

  const linkTo = type === 'driver'
    ? `/driver/${entry.id || entry.name.toLowerCase().replace(/\s+/g, '_')}`
    : `/team/${entry.id || entry.name.toLowerCase().replace(/\s+/g, '_')}`;

  return (
    <Link to={linkTo}
      className="block group bg-neutral-900/40 backdrop-blur hover:bg-neutral-900/80 border border-neutral-800/80 hover:border-neutral-600 rounded-2xl p-4 md:p-5 transition-all duration-300 shadow-lg relative overflow-hidden cursor-pointer"
      style={{ boxShadow: '0 4px 20px rgba(0,0,0,0.4)' }}
      onMouseEnter={(e) => e.currentTarget.style.boxShadow = `0 8px 40px ${teamColor}25, inset 0 0 15px ${teamColor}08`}
      onMouseLeave={(e) => e.currentTarget.style.boxShadow = '0 4px 20px rgba(0,0,0,0.4)'}
    >
      {/* Left color accent */}
      <div className="absolute left-0 top-0 bottom-0 w-1.5 transition-all duration-300 group-hover:w-2.5" style={{ backgroundColor: teamColor, boxShadow: `0 0 10px ${teamColor}` }} />

      {/* Watermark */}
      <div className="absolute right-4 md:right-12 -bottom-3 md:-bottom-6 text-6xl md:text-8xl font-black text-white/[0.02] leading-none select-none pointer-events-none italic -skew-x-12">
        {type === 'driver' ? (entry.abbreviation || entry.name.substring(0, 3).toUpperCase()) : entry.name.substring(0, 3).toUpperCase()}
      </div>

      <div className="flex items-center justify-between gap-3 ml-2">
        {/* Position + Info */}
        <div className="flex items-center gap-4 md:gap-6 min-w-0">
          {/* Position number */}
          <div className="w-10 h-10 md:w-12 md:h-12 flex items-center justify-center -skew-x-12 border border-neutral-700 bg-neutral-800/80 group-hover:border-neutral-500 group-hover:bg-neutral-700/80 transition-all rounded-lg">
            <span className="text-lg md:text-xl font-black text-neutral-400 group-hover:text-white skew-x-12 transition-colors">{index + 1}</span>
          </div>

          <div className="min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              {type === 'constructor' && teamLogos[entry.name] && (
                <img src={teamLogos[entry.name]} alt={entry.name} className="h-6 md:h-7 w-auto object-contain" style={darkLogos.includes(entry.name) ? { filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.7))' } : { filter: 'drop-shadow(0px 2px 3px rgba(0,0,0,0.5))' }} />
              )}
              <h3 className="font-black text-white text-lg md:text-xl tracking-tight group-hover:text-red-400 transition-colors truncate uppercase italic">
                {entry.name}
              </h3>
            </div>
            {type === 'driver' && (
              <div className="flex items-center gap-2.5 mt-1">
                {entry.team && teamLogos[entry.team] && (
                  <img src={teamLogos[entry.team]} alt={entry.team} className="h-4 md:h-5 w-auto object-contain" style={darkLogos.includes(entry.team || '') ? { filter: 'drop-shadow(0px 0px 2px rgba(255,255,255,0.7))' } : { filter: 'drop-shadow(0px 1px 3px rgba(0,0,0,0.5))' }} />
                )}
                <span className="text-neutral-400 text-xs font-bold uppercase tracking-wider truncate">{entry.team}</span>
              </div>
            )}
          </div>
        </div>

        {/* Stats + Points */}
        <div className="flex items-center gap-4 md:gap-8 flex-shrink-0 z-10">
          <div className="hidden md:flex items-center gap-5 text-xs font-mono text-neutral-400">
            {entry.wins !== undefined && (
              <div className="text-center">
                <Trophy size={12} className="text-yellow-500/60 mx-auto mb-0.5" />
                <span className="font-black text-base text-white">{entry.wins}</span>
              </div>
            )}
            {entry.podiums !== undefined && (
              <div className="text-center">
                <Medal size={12} className="text-amber-400/60 mx-auto mb-0.5" />
                <span className="font-black text-base text-white">{entry.podiums}</span>
              </div>
            )}
            {entry.dnfs !== undefined && entry.dnfs > 0 && (
              <div className="text-center">
                <AlertTriangle size={12} className="text-red-500/60 mx-auto mb-0.5" />
                <span className="font-black text-base text-white">{entry.dnfs}</span>
              </div>
            )}
          </div>

          <div className="text-right min-w-[70px]">
            <span className="text-2xl md:text-3xl font-black font-mono italic tracking-tighter text-neutral-200" style={{ textShadow: `0 0 10px ${teamColor}30` }}>
              {entry.points}
            </span>
            <div className="flex items-end justify-end gap-1.5 mt-0.5">
              <span className="text-[9px] text-neutral-500 uppercase font-bold tracking-widest">PTS</span>
              {!searchTerm && gap > 0 && (
                <span className="text-[10px] font-mono text-red-400/80 font-bold">-{gap}</span>
              )}
            </div>
          </div>

          <ChevronRight size={20} className="text-neutral-700 group-hover:text-white group-hover:translate-x-1 transition-all" />
        </div>
      </div>

      {/* Points bar */}
      <div className="mt-4 w-full bg-neutral-950/80 rounded-full h-1.5 overflow-hidden border border-neutral-800/50 relative">
        <div className="h-full rounded-full transition-all duration-1000 ease-out relative" style={{ width: `${pct}%`, backgroundColor: teamColor, boxShadow: `0 0 8px ${teamColor}80` }}>
          <div className="absolute top-0 right-0 bottom-0 w-12 bg-gradient-to-l from-white/30 to-transparent" />
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
  const [activeTab, setActiveTab] = useState(location.state?.tab || 'drivers');
  const [data, setData] = useState<{ drivers: DriverProfile[]; teams: TeamProfile[]; session_results: any[] }>({ drivers: [], teams: [], session_results: [] });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const currentYear = new Date().getFullYear();

  const fetchStats = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/championship/${currentYear}`);
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const result = await response.json();
      if (result.error) throw new Error(result.error);
      setData({
        drivers: result.drivers || [],
        teams: result.teams || [],
        session_results: result.session_results || []
      });
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [currentYear]);

  const maxDriverPoints = data.drivers.length > 0 ? Math.max(...data.drivers.map(d => d.points || 0), 1) : 1;
  const maxTeamPoints = data.teams.length > 0 ? Math.max(...data.teams.map(t => t.points || 0), 1) : 1;

  const filteredDrivers = useMemo(() => data.drivers.filter(d =>
    (d.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (d.team || '').toLowerCase().includes(searchTerm.toLowerCase())
  ), [data.drivers, searchTerm]);

  const filteredTeams = useMemo(() => data.teams.filter(t =>
    (t.name || '').toLowerCase().includes(searchTerm.toLowerCase())
  ), [data.teams, searchTerm]);

  // Split into podium (top 3) and rest
  const podiumDrivers = !searchTerm ? filteredDrivers.slice(0, 3) : [];
  const restDrivers = !searchTerm ? filteredDrivers.slice(3) : filteredDrivers;
  const podiumTeams = !searchTerm ? filteredTeams.slice(0, 3) : [];
  const restTeams = !searchTerm ? filteredTeams.slice(3) : filteredTeams;

  const leaderDriverPoints = data.drivers[0]?.points || 0;
  const leaderTeamPoints = data.teams[0]?.points || 0;

  // Season summary stats
  const totalRaceWins = useMemo(() => data.drivers.reduce((sum, d) => sum + (d.wins || 0), 0), [data.drivers]);
  const totalPodiums = useMemo(() => data.drivers.reduce((sum, d) => sum + (d.podiums || 0), 0), [data.drivers]);

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans relative">
      {/* Backgrounds */}
      <div className="fixed inset-0 bg-[url('https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat opacity-[0.12] pointer-events-none mix-blend-luminosity" />
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay" />
      <div className="fixed inset-0 bg-gradient-to-b from-red-900/15 via-neutral-950/85 to-neutral-950 pointer-events-none" />

      
      <main className="container mx-auto px-4 md:px-6 pt-28 pb-16 relative z-10">
        
        {/* Header */}
        <section className="mb-10">
          <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6">
            <div className="relative">
              <div className="absolute -left-10 -top-10 w-40 h-40 bg-red-500/15 blur-[70px] rounded-full pointer-events-none" />
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter flex items-center gap-4 italic transform -skew-x-6">
                <Trophy className="text-yellow-500 drop-shadow-[0_0_15px_rgba(234,179,8,0.5)]" size={52} />
                Championship <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 pr-2">Stats</span>
              </h1>
              <p className="text-neutral-400 mt-2 text-base md:text-lg font-medium">
                Official standings and season performance for {currentYear}.
              </p>
            </div>

            {/* Tab Switcher + Compare Link */}
            <div className="flex flex-wrap items-center gap-3">
              <Link to="/compare"
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-neutral-900/80 backdrop-blur hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-700/50 rounded-xl text-sm font-black transition-all shadow-lg hover:-translate-y-1 hover:shadow-red-500/20">
                <GitCompareArrows size={18} className="text-red-500" /> Compare H2H
              </Link>

              <div className="flex bg-neutral-900/80 backdrop-blur border border-neutral-700/50 p-1.5 rounded-xl shadow-lg">
                <button onClick={() => { setActiveTab('drivers'); setSearchTerm(''); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all ${
                    activeTab === 'drivers'
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-600/40'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}>
                  <User size={16} /> Drivers
                </button>
                <button onClick={() => { setActiveTab('constructors'); setSearchTerm(''); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all ${
                    activeTab === 'constructors'
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-600/40'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}>
                  <Factory size={16} /> Constructors
                </button>
                <button onClick={() => { setActiveTab('progression'); setSearchTerm(''); }}
                  className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-black transition-all ${
                    activeTab === 'progression'
                      ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-lg shadow-red-600/40'
                      : 'text-neutral-400 hover:text-white hover:bg-neutral-800'
                  }`}>
                  <TrendingUp size={16} /> Worm
                </button>
              </div>
            </div>
          </div>
        </section>

        {/* Quick Season Stats Bar */}
        {!loading && !error && (
          <section className="mb-8 grid grid-cols-2 md:grid-cols-4 gap-3">
            <div className="bg-neutral-900/50 backdrop-blur border border-neutral-800/60 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-yellow-500/10 border border-yellow-500/20 flex items-center justify-center">
                <Crown size={18} className="text-yellow-400" />
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Leader</span>
                <span className="font-black text-white text-sm block leading-tight">
                  {activeTab === 'drivers' ? (data.drivers[0]?.name || '-') : (data.teams[0]?.name || '-')}
                </span>
              </div>
            </div>
            <div className="bg-neutral-900/50 backdrop-blur border border-neutral-800/60 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center justify-center">
                <Star size={18} className="text-red-400" />
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Max Points</span>
                <span className="font-black text-white text-sm block">{activeTab === 'drivers' ? leaderDriverPoints : leaderTeamPoints} PTS</span>
              </div>
            </div>
            <div className="bg-neutral-900/50 backdrop-blur border border-neutral-800/60 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                <Trophy size={18} className="text-emerald-400" />
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Total Wins</span>
                <span className="font-black text-white text-sm block">{totalRaceWins}</span>
              </div>
            </div>
            <div className="bg-neutral-900/50 backdrop-blur border border-neutral-800/60 rounded-2xl p-4 flex items-center gap-3">
              <div className="w-10 h-10 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center">
                <Medal size={18} className="text-purple-400" />
              </div>
              <div>
                <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-widest">Total Podiums</span>
                <span className="font-black text-white text-sm block">{totalPodiums}</span>
              </div>
            </div>
          </section>
        )}

        {/* Search */}
        <div className="relative mb-8 max-w-lg group">
          <div className="absolute inset-0 bg-red-500/15 blur-xl rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity duration-500" />
          <input
            type="text"
            placeholder={activeTab === 'drivers' ? 'Search driver or team...' : 'Search constructor...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="relative w-full bg-neutral-900/80 backdrop-blur-md border border-neutral-700/50 rounded-xl py-3.5 pl-12 pr-4 text-white placeholder-neutral-500 text-sm focus:outline-none focus:border-red-500 focus:ring-2 focus:ring-red-500/50 transition-all font-bold shadow-xl"
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 group-focus-within:text-red-500 transition-colors" size={18} />
        </div>

        {/* Error */}
        {error && (
          <div className="bg-red-950/40 backdrop-blur border border-red-500/50 rounded-2xl p-8 text-center mb-8 max-w-lg mx-auto shadow-[0_0_30px_rgba(239,68,68,0.2)]">
            <AlertTriangle className="text-red-500 mx-auto mb-4" size={40} />
            <h3 className="font-black text-red-400 text-xl uppercase tracking-wider">Failed to load statistics</h3>
            <p className="text-neutral-300 text-base mt-2 mb-6">{error}</p>
            <button onClick={fetchStats}
              className="px-6 py-3 bg-red-600 hover:bg-red-500 text-white rounded-xl font-black text-sm inline-flex items-center gap-2 transition-all shadow-lg hover:shadow-red-500/50 hover:-translate-y-0.5">
              <Loader2 size={16} /> Retry Connection
            </button>
          </div>
        )}

        {/* Loading */}
        {loading ? (
          <div className="space-y-4 animate-pulse">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
              {[1, 2, 3].map(i => <div key={i} className="h-56 bg-neutral-900/40 border border-neutral-800 rounded-3xl" />)}
            </div>
            {[1, 2, 3, 4, 5].map(i => <div key={i} className="h-24 bg-neutral-900/40 border border-neutral-800 rounded-2xl" />)}
          </div>
        ) : (
          <div>
            {/* ==================== DRIVERS VIEW ==================== */}
            {activeTab === 'drivers' && (
              <div className="space-y-4">
                {/* Podium (Top 3) */}
                {podiumDrivers.length > 0 && (
                  <section className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles size={16} className="text-yellow-400" />
                      <h2 className="text-sm font-black text-neutral-400 uppercase tracking-widest">Championship Podium</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {podiumDrivers.map((driver, idx) => (
                        <PodiumCard key={driver.name} entry={driver} rank={idx} type="driver" maxPoints={maxDriverPoints} leaderPoints={leaderDriverPoints} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Rest of the field */}
                {restDrivers.length > 0 && (
                  <section>
                    {!searchTerm && (
                      <div className="flex items-center gap-2 mb-4">
                        <Shield size={16} className="text-neutral-500" />
                        <h2 className="text-sm font-black text-neutral-400 uppercase tracking-widest">Rest of the Field</h2>
                      </div>
                    )}
                    <div className="space-y-3">
                      {restDrivers.map((driver, idx) => (
                        <StandingRow key={driver.name} entry={driver} index={searchTerm ? idx : idx + 3} type="driver" maxPoints={maxDriverPoints} leaderPoints={leaderDriverPoints} searchTerm={searchTerm} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ==================== CONSTRUCTORS VIEW ==================== */}
            {activeTab === 'constructors' && (
              <div className="space-y-4">
                {/* Podium (Top 3) */}
                {podiumTeams.length > 0 && (
                  <section className="mb-6">
                    <div className="flex items-center gap-2 mb-4">
                      <Sparkles size={16} className="text-yellow-400" />
                      <h2 className="text-sm font-black text-neutral-400 uppercase tracking-widest">Constructor Podium</h2>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {podiumTeams.map((team, idx) => (
                        <PodiumCard key={team.name} entry={team} rank={idx} type="constructor" maxPoints={maxTeamPoints} leaderPoints={leaderTeamPoints} />
                      ))}
                    </div>
                  </section>
                )}

                {/* Rest */}
                {restTeams.length > 0 && (
                  <section>
                    {!searchTerm && (
                      <div className="flex items-center gap-2 mb-4">
                        <Shield size={16} className="text-neutral-500" />
                        <h2 className="text-sm font-black text-neutral-400 uppercase tracking-widest">Rest of the Grid</h2>
                      </div>
                    )}
                    <div className="space-y-3">
                      {restTeams.map((team, idx) => (
                        <StandingRow key={team.name} entry={team} index={searchTerm ? idx : idx + 3} type="constructor" maxPoints={maxTeamPoints} leaderPoints={leaderTeamPoints} searchTerm={searchTerm} />
                      ))}
                    </div>
                  </section>
                )}
              </div>
            )}

            {/* ==================== PROGRESSION WORM ==================== */}
            {activeTab === 'progression' && (
              <div className="space-y-4">
                <ChampionshipWorm sessionResults={data.session_results} drivers={data.drivers} teams={data.teams} />
              </div>
            )}
          </div>
        )}
      </main>
    </div>
  );
};

export default StatsPage;
