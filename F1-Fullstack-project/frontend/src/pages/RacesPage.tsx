import { Race } from '../types/f1';
import { useState, useEffect, useRef, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ErrorState from '../components/layout/ErrorState';
import { Calendar, Trophy, Clock, Info, MapPin, ChevronDown, Zap, ArrowDown, CheckCircle2, Timer } from 'lucide-react';
import { Link } from 'react-router-dom';
import { API_URL } from '../config';
import { getTrackMap } from '../data/trackData';
import { teamColors } from '../data/teamData';

const CURRENT_YEAR = new Date().getFullYear();

const countryCodeMapping: Record<string, string> = {
  'Australia': 'AU', 'Bahrain': 'BH', 'China': 'CN', 'Saudi Arabia': 'SA',
  'USA': 'US', 'United States': 'US', 'Japan': 'JP', 'Italy': 'IT',
  'Monaco': 'MC', 'Spain': 'ES', 'Canada': 'CA', 'Austria': 'AT',
  'UK': 'GB', 'Great Britain': 'GB', 'United Kingdom': 'GB', 'Hungary': 'HU',
  'Belgium': 'BE', 'Netherlands': 'NL', 'Azerbaijan': 'AZ', 'Singapore': 'SG',
  'Mexico': 'MX', 'Brazil': 'BR', 'Qatar': 'QA', 'United Arab Emirates': 'AE',
};

const MONTH_NAMES = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

// --- MINI COUNTDOWN ---
const MiniCountdown = ({ targetDate }: { targetDate: Date }) => {
  const [timeLeft, setTimeLeft] = useState({ days: 0, hours: 0, mins: 0 });

  useEffect(() => {
    const calcTime = () => {
      const now = new Date();
      const diff = targetDate.getTime() - now.getTime();
      if (diff <= 0) return { days: 0, hours: 0, mins: 0 };
      return {
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        mins: Math.floor((diff / (1000 * 60)) % 60),
      };
    };
    setTimeLeft(calcTime());
    const interval = setInterval(() => setTimeLeft(calcTime()), 60000);
    return () => clearInterval(interval);
  }, [targetDate]);

  return (
    <div className="flex items-center gap-1.5">
      <Timer size={12} className="text-red-400" />
      <div className="flex gap-1 text-[10px] font-mono font-bold tracking-wider">
        {timeLeft.days > 0 && (
          <span className="bg-red-500/20 text-red-400 px-1.5 py-0.5 rounded">{timeLeft.days}d</span>
        )}
        <span className="bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded">{timeLeft.hours}h</span>
        <span className="bg-neutral-800 text-neutral-300 px-1.5 py-0.5 rounded">{timeLeft.mins}m</span>
      </div>
    </div>
  );
};

// --- SEASON PROGRESS BAR ---
const SeasonProgress = ({ completed, total }: { completed: number; total: number }) => {
  const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
  return (
    <div className="flex items-center gap-4 w-full max-w-md">
      <div className="flex-1 h-2 bg-neutral-800 rounded-full overflow-hidden relative">
        <div
          className="h-full bg-gradient-to-r from-red-600 via-red-500 to-orange-400 rounded-full transition-all duration-1000 ease-out relative"
          style={{ width: `${pct}%` }}
        >
          <div className="absolute inset-0 bg-white/10 animate-pulse rounded-full" />
        </div>
      </div>
      <span className="text-xs font-mono font-bold text-neutral-400 whitespace-nowrap">
        {completed}/{total} <span className="text-neutral-600">RACES</span>
      </span>
    </div>
  );
};

// --- FILTER TABS ---
const FilterTabs = ({ active, onChange, counts }: { active: string; onChange: (key: string) => void; counts: any }) => {
  const tabs = [
    { key: 'all', label: 'All Races', icon: Calendar, count: counts.all },
    { key: 'completed', label: 'Completed', icon: CheckCircle2, count: counts.completed },
    { key: 'upcoming', label: 'Upcoming', icon: Clock, count: counts.upcoming },
  ];
  return (
    <div className="flex flex-wrap gap-2">
      {tabs.map(t => (
        <button key={t.key} onClick={() => onChange(t.key)}
          className={`group flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200
            ${active === t.key
              ? 'bg-red-600/90 text-white shadow-[0_0_20px_rgba(220,38,38,0.3)] border border-red-500'
              : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600'
            }`}>
          <t.icon size={14} className={active === t.key ? 'text-white' : 'text-neutral-500 group-hover:text-neutral-300'} />
          {t.label}
          <span className={`ml-1 px-1.5 py-0.5 rounded text-[10px] font-mono ${active === t.key ? 'bg-white/20 text-white' : 'bg-neutral-800 text-neutral-500'}`}>
            {t.count}
          </span>
        </button>
      ))}
    </div>
  );
};

// --- MONTH DIVIDER ---
const MonthDivider = ({ month, year, raceCount }: { month: string; year: number; raceCount: number }) => (
  <div className="col-span-full flex items-center gap-4 py-4">
    <div className="flex items-center gap-3">
      <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-red-600/20 to-red-900/20 border border-red-500/20 flex items-center justify-center">
        <Calendar size={18} className="text-red-500" />
      </div>
      <div>
        <h3 className="text-xl font-black text-white uppercase tracking-tight italic">{month}</h3>
        <span className="text-[10px] font-mono text-neutral-500 tracking-widest">{raceCount} RACE{raceCount > 1 ? 'S' : ''} · {year}</span>
      </div>
    </div>
    <div className="flex-1 h-px bg-gradient-to-r from-neutral-800 via-neutral-800 to-transparent" />
  </div>
);

// --- RACE CARD ---
const RaceCard = ({ race, isNextRace, index }: { race: Race | any; isNextRace: boolean; index: number }) => {
  const raceDate = new Date(race.date + 'T00:00:00');
  const formattedDate = raceDate.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' });
  const trackImage = getTrackMap(race);
  const flagCode = race.country ? countryCodeMapping[race.country.trim()] : undefined;
  const winnerTeamColor = race.winner_team ? (teamColors[race.winner_team] || '#666') : '#333';

  const getStatusConfig = (status: string) => {
    switch (status) {
      case 'Finished': return { classes: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30', label: 'COMPLETED', dot: 'bg-emerald-400' };
      case 'Ongoing':  return { classes: 'bg-red-500/20 text-red-400 border-red-500/50', label: 'LIVE', dot: 'bg-red-500 animate-pulse' };
      case 'Upcoming': return { classes: 'bg-neutral-800/60 text-neutral-500 border-neutral-700', label: 'UPCOMING', dot: 'bg-neutral-500' };
      default:         return { classes: 'bg-neutral-800/60 text-neutral-500 border-neutral-700', label: status, dot: 'bg-neutral-500' };
    }
  };

  const statusConfig = getStatusConfig(race.status);

  return (
    <Link to={`/race/${CURRENT_YEAR}/${race.round}`} className="block h-full group" data-race-round={race.round}>
      <div className={`relative bg-neutral-900/40 backdrop-blur-md border rounded-3xl p-6 flex flex-col justify-between h-full transition-all duration-300 transform group-hover:-translate-y-2 group-hover:shadow-[0_15px_40px_rgba(220,38,38,0.15)] overflow-hidden
        ${isNextRace
          ? 'border-red-500/50 ring-1 ring-red-500/20 shadow-[0_0_30px_rgba(220,38,38,0.12)]'
          : race.status === 'Ongoing'
            ? 'border-red-500/30'
            : 'border-neutral-800/80 group-hover:border-neutral-600'
        }`}
        style={{ animationDelay: `${index * 50}ms` }}
      >
        {/* Next Race Badge */}
        {isNextRace && (
          <div className="absolute top-0 right-0">
            <div className="bg-red-600 text-white text-[9px] font-black uppercase tracking-widest px-3 py-1 rounded-bl-xl rounded-tr-3xl flex items-center gap-1.5 shadow-[0_2px_10px_rgba(220,38,38,0.5)]">
              <Zap size={10} className="animate-pulse" /> NEXT RACE
            </div>
          </div>
        )}
        
        {/* Track Outline Watermark */}
        {trackImage && (
          <img src={trackImage} alt={`${race.location} track layout`}
            className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-4/5 h-auto opacity-[0.03] group-hover:opacity-10 group-hover:drop-shadow-[0_0_15px_rgba(255,255,255,0.4)] pointer-events-none transition-all duration-500 invert" 
          />
        )}
        
        {/* Glow behind card if finished and has winner */}
        {race.status === 'Finished' && (
          <div className="absolute -right-10 -bottom-10 w-40 h-40 rounded-full blur-[80px] opacity-10 pointer-events-none transition-opacity group-hover:opacity-30" style={{ backgroundColor: winnerTeamColor }} />
        )}

        {/* Next race glow */}
        {isNextRace && (
          <div className="absolute -left-5 -top-5 w-32 h-32 rounded-full blur-[60px] opacity-20 pointer-events-none bg-red-500 animate-pulse" />
        )}

        <div className="relative z-10 flex flex-col justify-between h-full">
          <div>
            {/* Header: Flag, Name, Round Badge */}
            <div className="flex justify-between items-start mb-5">
              <div className="max-w-[70%]">
                <div className="flex flex-wrap items-center gap-3 mb-2">
                  <div className="shadow-[0_0_10px_rgba(255,255,255,0.1)] rounded-sm overflow-hidden">
                    {flagCode ? (
                      <img
                        src={`https://flagcdn.com/w40/${flagCode.toLowerCase()}.png`}
                        alt={`${race.country} flag`}
                        className="w-8 h-auto"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-8 h-5 bg-neutral-800" />
                    )}
                  </div>
                  <h3 className="font-black text-white text-lg md:text-xl leading-tight uppercase italic tracking-tight group-hover:text-red-400 transition-colors">
                    {race.name}
                  </h3>
                </div>
                <div className="flex items-center gap-1.5 text-neutral-400 text-xs font-bold uppercase tracking-widest">
                  <MapPin size={12} /> {race.location}
                </div>
              </div>
              
              {/* Skewed Round Badge */}
              <div className="flex-shrink-0 bg-red-600 transform -skew-x-12 px-3 py-1.5 shadow-[0_0_15px_rgba(220,38,38,0.4)] border border-red-500">
                <div className="transform skew-x-12 text-white font-black text-xs uppercase tracking-widest">
                  R{String(race.round).padStart(2, '0')}
                </div>
              </div>
            </div>

            {/* Date & Status */}
            <div className="flex justify-between items-center border-y border-neutral-800/60 py-3 mb-5">
              <div className="flex items-center gap-2 text-white font-mono text-sm font-bold bg-neutral-950/50 px-3 py-1 rounded-lg">
                <Calendar size={14} className="text-red-500" />
                {formattedDate}
              </div>
              <div className={`px-3 py-1 text-[10px] font-black uppercase rounded-lg border flex items-center gap-1.5 tracking-widest ${statusConfig.classes}`}>
                <div className={`w-1.5 h-1.5 rounded-full ${statusConfig.dot}`} />
                <span>{statusConfig.label}</span>
              </div>
            </div>
          </div>

          <div className="flex flex-col gap-2 relative">
            {/* Small track icon right side */}
            {trackImage && (
              <img src={trackImage} alt="track" className="absolute -right-2 top-0 w-16 opacity-30 drop-shadow-md group-hover:opacity-50 transition-all invert" />
            )}
             
            {race.status === 'Finished' ? (
              race.winner ? (
                <>
                  <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-1">Race Winner</div>
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-yellow-500/20 to-yellow-700/20 border border-yellow-500/30 flex items-center justify-center">
                      <Trophy size={16} className="text-yellow-500 drop-shadow-[0_0_5px_rgba(234,179,8,0.5)]" />
                    </div>
                    <div className="flex flex-col">
                      <span className="font-black text-white text-base md:text-lg uppercase italic leading-none">{race.winner}</span>
                      <div className="flex items-center gap-1.5 mt-1">
                        <div className="w-2 h-2 rounded-full shadow-sm" style={{ backgroundColor: winnerTeamColor }} />
                        <span className="text-xs text-neutral-400 font-bold uppercase tracking-wider">{race.winner_team}</span>
                      </div>
                    </div>
                  </div>
                </>
              ) : (
                <div className="text-neutral-500 text-sm font-bold uppercase italic mt-2">Results Pending...</div>
              )
            ) : isNextRace ? (
              <div className="mt-1">
                <div className="text-[10px] text-neutral-500 font-bold uppercase tracking-widest mb-2">Race Starts In</div>
                <MiniCountdown targetDate={raceDate} />
              </div>
            ) : (
              <div className="text-neutral-600 text-xs font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
                <Clock size={12} /> Awaiting Race Day
              </div>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
};

// --- ERROR STATE ---


// --- LOADING SKELETON ---
const LoadingSkeleton = () => (
  <div className="bg-neutral-950 min-h-screen text-white font-sans relative">
    
    <main className="container mx-auto px-6 pt-28 pb-12 relative z-10">
      <div className="animate-pulse space-y-8">
        <div className="flex flex-col gap-4">
          <div className="h-16 w-96 bg-neutral-900/60 border border-neutral-800 rounded-2xl" />
          <div className="flex gap-3">
            <div className="h-10 w-28 bg-neutral-900/40 rounded-xl" />
            <div className="h-10 w-28 bg-neutral-900/40 rounded-xl" />
            <div className="h-10 w-28 bg-neutral-900/40 rounded-xl" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-8">
          {[1, 2, 3, 4, 5, 6].map(i => (
            <div key={i} className="h-72 bg-neutral-900/40 border border-neutral-800/50 rounded-3xl" />
          ))}
        </div>
      </div>
    </main>
  </div>
);

// =======================================================================
// --- KOMPONEN UTAMA RacesPage ---
// =======================================================================
const RacesPage = () => {
  const [filter, setFilter] = useState('all');
  const nextRaceRef = useRef(null);

  const { data: races = [], isLoading: loading, error, refetch: fetchAllRaces } = useQuery({
    queryKey: ['races', CURRENT_YEAR],
    queryFn: async () => {
      const response = await fetch(`${API_URL}/api/races/${CURRENT_YEAR}`);
      if (!response.ok) throw new Error(`Failed to fetch. Status: ${response.status}`);
      const data = await response.json();
      if (data.error) throw new Error(data.error);
      return data;
    }
  });

  // Find next upcoming race
  const nextRace = useMemo(() => {
    const now = new Date();
    return races.find((r: Race) => {
      const d = new Date(r.date + 'T00:00:00');
      return d >= now && r.status !== 'Finished';
    }) || races.find((r: Race) => r.status === 'Upcoming') || null;
  }, [races]);

  // Filter races
  const filteredRaces = useMemo(() => {
    switch (filter) {
      case 'completed': return races.filter((r: Race) => r.status === 'Finished');
      case 'upcoming': return races.filter((r: Race) => r.status === 'Upcoming' || r.status === 'Ongoing');
      default: return races;
    }
  }, [races, filter]);

  // Group by month
  const groupedRaces = useMemo(() => {
    const groups: { key: string; month: string; year: number; races: Race[] }[] = [];
    let currentMonth: string | null = null;
    filteredRaces.forEach((race: Race) => {
      const d = new Date(race.date + 'T00:00:00');
      const monthKey = `${d.getFullYear()}-${d.getMonth()}`;
      if (monthKey !== currentMonth) {
        currentMonth = monthKey;
        groups.push({
          key: monthKey,
          month: MONTH_NAMES[d.getMonth()],
          year: d.getFullYear(),
          races: [race]
        });
      } else {
        groups[groups.length - 1].races.push(race);
      }
    });
    return groups;
  }, [filteredRaces]);

  // Counts
  const counts = useMemo(() => ({
    all: races.length,
    completed: races.filter((r: Race) => r.status === 'Finished').length,
    upcoming: races.filter((r: Race) => r.status === 'Upcoming' || r.status === 'Ongoing').length,
  }), [races]);

  const scrollToNextRace = () => {
    if (nextRace) {
      const el = document.querySelector(`[data-race-round="${nextRace.round}"]`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        // Flash animation
        (el.firstChild as HTMLElement)?.classList.add('ring-2', 'ring-red-500');
        setTimeout(() => (el.firstChild as HTMLElement)?.classList.remove('ring-2', 'ring-red-500'), 2000);
      }
    }
  };

  if (loading) return <LoadingSkeleton />;
  if (error) return <ErrorState onRetry={fetchAllRaces} />;

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans relative">
      {/* Backgrounds */}
      <div className="fixed inset-0 bg-[url('https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat opacity-[0.10] pointer-events-none mix-blend-luminosity" />
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay" />
      <div className="fixed inset-0 bg-gradient-to-b from-red-900/10 via-neutral-950/80 to-neutral-950 pointer-events-none" />

      
      <main className="container mx-auto px-4 md:px-6 pt-28 pb-16 relative z-10">
        
        {/* Header Section */}
        <section className="mb-10 relative">
          <div className="absolute -left-10 -top-10 w-40 h-40 bg-red-500/20 blur-[70px] rounded-full pointer-events-none" />
          
          <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-6">
            <div>
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter flex items-center gap-4 italic transform -skew-x-6 text-white">
                <Calendar className="text-red-500 drop-shadow-[0_0_20px_rgba(239,68,68,0.6)]" size={56} />
                Race <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Calendar</span>
              </h1>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <span className="bg-neutral-900 border border-neutral-700 text-white font-mono font-bold px-4 py-1.5 rounded-lg shadow-inner">
                  SEASON {CURRENT_YEAR}
                </span>
                <SeasonProgress completed={counts.completed} total={counts.all} />
              </div>
            </div>

            {/* Jump to Next Race button */}
            {nextRace && filter === 'all' && (
              <button onClick={scrollToNextRace}
                className="flex items-center gap-2 px-5 py-2.5 bg-red-600/90 hover:bg-red-500 text-white text-sm font-bold uppercase tracking-wider rounded-xl border border-red-500 transition-all duration-200 hover:-translate-y-0.5 shadow-[0_0_15px_rgba(220,38,38,0.3)] hover:shadow-[0_0_25px_rgba(220,38,38,0.5)] whitespace-nowrap">
                <ArrowDown size={16} className="animate-bounce" />
                Jump to Next Race
              </button>
            )}
          </div>
        </section>

        {/* Filter Tabs */}
        <section className="mb-8">
          <FilterTabs active={filter} onChange={setFilter} counts={counts} />
        </section>

        {/* Next Race Hero Banner (only in "all" view) */}
        {nextRace && filter === 'all' && (
          <section className="mb-10" ref={nextRaceRef}>
            <div className="relative overflow-hidden rounded-3xl bg-gradient-to-r from-red-950/50 via-neutral-900/80 to-neutral-950/80 backdrop-blur-xl border border-red-500/20 p-6 md:p-8">
              {/* Track bg */}
              {getTrackMap(nextRace) && (
                <img src={getTrackMap(nextRace)} alt="" className="absolute right-4 top-1/2 -translate-y-1/2 w-48 md:w-64 opacity-[0.07] invert pointer-events-none" />
              )}
              <div className="absolute inset-0 bg-gradient-to-r from-red-600/5 to-transparent pointer-events-none" />
              
              <div className="relative z-10 flex flex-col md:flex-row md:items-center md:justify-between gap-6">
                <div className="flex items-center gap-5">
                  <div className="w-14 h-14 rounded-2xl bg-red-600/20 border border-red-500/30 flex items-center justify-center shrink-0">
                    <Zap size={24} className="text-red-500 animate-pulse" />
                  </div>
                  <div>
                    <div className="text-[10px] font-bold text-red-400 uppercase tracking-[0.2em] mb-1">Next Up · Round {nextRace.round}</div>
                    <h2 className="text-2xl md:text-3xl font-black text-white uppercase italic tracking-tight">{nextRace.name}</h2>
                    <div className="flex items-center gap-3 mt-1.5 text-neutral-400 text-sm">
                      <div className="flex items-center gap-1.5">
                        <MapPin size={13} /> {nextRace.location}
                      </div>
                      <span className="text-neutral-700">|</span>
                      <div className="flex items-center gap-1.5">
                        <Calendar size={13} />
                        {new Date(nextRace.date + 'T00:00:00').toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' })}
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="flex items-center gap-4">
                  <MiniCountdown targetDate={new Date(nextRace.date + 'T00:00:00')} />
                  <Link to={`/race/${CURRENT_YEAR}/${nextRace.round}`}
                    className="px-5 py-2.5 bg-red-600 hover:bg-red-500 text-white text-sm font-bold uppercase tracking-wider rounded-xl border border-red-500 transition-all hover:-translate-y-0.5 shadow-[0_0_15px_rgba(220,38,38,0.4)] whitespace-nowrap">
                    View Details →
                  </Link>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Race Cards Grid — Grouped by Month */}
        {groupedRaces.length > 0 ? (
          <div className="space-y-2">
            {groupedRaces.map(group => (
              <div key={group.key}>
                <MonthDivider month={group.month} year={group.year} raceCount={group.races.length} />
                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 md:gap-8">
                  {group.races.map((race: Race, idx: number) => (
                    <RaceCard
                      key={race.round}
                      race={race}
                      isNextRace={nextRace?.round === race.round}
                      index={idx}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-16 text-center flex flex-col items-center mt-8 shadow-2xl">
            <Info size={48} className="text-blue-500 mb-6 drop-shadow-[0_0_15px_rgba(59,130,246,0.5)]" />
            <h3 className="text-3xl font-black text-white mb-3 tracking-tight italic uppercase">
              {filter === 'all' ? 'Schedule Not Available' : `No ${filter === 'completed' ? 'Completed' : 'Upcoming'} Races`}
            </h3>
            <p className="text-neutral-400 max-w-md text-lg">
              {filter === 'all'
                ? `The race calendar for the ${CURRENT_YEAR} season has not been released or could not be loaded.`
                : `No ${filter === 'completed' ? 'completed' : 'upcoming'} races found for the ${CURRENT_YEAR} season.`
              }
            </p>
            {filter !== 'all' && (
              <button onClick={() => setFilter('all')} className="mt-6 px-6 py-2.5 bg-neutral-800 hover:bg-neutral-700 text-white text-sm font-bold rounded-xl transition-all border border-neutral-700">
                Show All Races
              </button>
            )}
          </div>
        )}

        {/* Back to Top */}
        <div className="flex justify-center mt-16">
          <button onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="flex items-center gap-2 text-neutral-600 hover:text-neutral-400 text-xs font-bold uppercase tracking-widest transition-colors">
            <ChevronDown size={14} className="rotate-180" /> Back to Top
          </button>
        </div>
      </main>
    </div>
  );
};

export default RacesPage;
