// Note: This is dead code, not routed. StatsPage is used instead.
// src/DriversPage - FIXED: shared teamData, config, dynamic year, improved error

import { DriverProfile } from '../types/f1';
import { useState, useEffect } from 'react';
import ErrorState from '../components/layout/ErrorState';
import { Search, ArrowUp, Trophy } from 'lucide-react';
import { API_URL } from '../config';
import { teamLogos, teamColors } from '../data/teamData';
import { safeMax, toNumber } from '../utils/data';

// --- ERROR STATE ---


function DriversPage() {
  const [drivers, setDrivers] = useState<DriverProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState('');

  // FIXED: pakai dinamis, bukan hardcode 2026
  const currentYear = new Date().getFullYear();

  const fetchChampionshipData = async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(`${API_URL}/api/championship/${currentYear}`);
      if (!response.ok) throw new Error(`Network error: ${response.status}`);
      const data = await response.json();

      if (data.error) setError(data.error);
      else if (data && data.drivers) setDrivers(data.drivers);
      else throw new Error("Invalid data structure from API.");
    } catch (err: unknown) {
      setError(`Failed to fetch data: ${(err instanceof Error ? err.message : String(err))}`);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchChampionshipData();
  }, [currentYear]);

  const filteredDrivers = drivers.filter(driver =>
    (driver.name ?? '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (driver.team ?? '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  const leaderPoints = safeMax(drivers.map(d => toNumber(d.points)), 0);

  if (loading) {
    return (
      <div className="bg-neutral-950 min-h-screen text-white font-sans">
        
        <main className="container mx-auto px-4 md:px-6 pt-28 pb-12">
          <div className="animate-pulse space-y-8 w-full">
            <div className="h-16 w-64 bg-neutral-900/60 border border-neutral-800 rounded-xl"></div>
            <div className="space-y-4">
              {[1, 2, 3, 4, 5, 6, 7, 8].map(i => (
                <div key={i} className="h-20 bg-neutral-900/60 border border-neutral-800 rounded-2xl w-full"></div>
              ))}
            </div>
          </div>
        </main>
      </div>
    );
  }

  if (error) return <ErrorState message={error} onRetry={fetchChampionshipData} />;

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans">
      
      <main className="container mx-auto px-4 md:px-6 pt-28 pb-12">
        <header className="mb-10">
          <h1 className="text-5xl md:text-6xl font-black tracking-tighter italic uppercase">
            Driver <span className="text-red-600">Standings</span>
          </h1>
          <p className="text-lg text-neutral-400 font-medium tracking-wide">{currentYear} Season Championship</p>
        </header>

        <div className="relative mb-10 max-w-xl">
          <input
            type="text"
            placeholder="Search by driver or team..."
            className="w-full bg-neutral-900/80 backdrop-blur-sm border border-neutral-800 rounded-sm py-4 pl-12 pr-4 text-white focus:outline-none focus:border-red-600 focus:ring-1 focus:ring-red-600 transition-all font-medium"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-500" size={22} />
        </div>

        <div className="space-y-4">
          {filteredDrivers.length > 0 ? (
            filteredDrivers.map((driver, index) => {
              const teamColor = teamColors[driver.team] || '#374151';
              const logo = teamLogos[driver.team];

              const isP1 = driver.position === 1;
              const animationDelay = `${index * 0.1}s`;
              const pointsGap = isP1 ? 'LEADER' : `-${leaderPoints - (driver.points ?? 0)}`;
              const dominancePercentage = leaderPoints > 0 ? ((driver.points ?? 0) / leaderPoints) * 100 : 0;

              return (
                <div key={driver.id} className="relative group animate-fade-in-up" style={{ animationFillMode: 'both', animationDelay }}>
                  <div className={`absolute inset-0 transition-opacity duration-500 blur-xl rounded-lg ${isP1 ? 'opacity-20 group-hover:opacity-40' : 'opacity-0 group-hover:opacity-20'}`} style={{ backgroundColor: teamColor }} />

                  <div className={`relative flex items-stretch bg-neutral-900/90 backdrop-blur-md border rounded-r-lg rounded-l-sm overflow-hidden transition-all duration-300 group-hover:border-neutral-500 ${isP1 ? 'border-yellow-500/50' : 'border-neutral-800'}`}>

                    {/* Dominance Bar */}
                    <div
                      className="absolute bottom-0 left-0 h-1 transition-all duration-1000 ease-out z-30"
                      style={{ width: `${dominancePercentage}%`, backgroundColor: teamColor, boxShadow: `0 0 10px ${teamColor}` }}
                    />

                    {/* Position Block */}
                    <div className="w-16 md:w-20 flex items-center justify-center flex-shrink-0 z-20 shadow-[5px_0_15px_rgba(0,0,0,0.5)]" style={{ backgroundColor: teamColor }}>
                      <span className="text-3xl md:text-4xl font-black italic text-neutral-950 tracking-tighter">{driver.position}</span>
                    </div>

                    {/* Driver Info */}
                    <div className="flex-grow flex items-center p-4 md:p-6 z-10 relative overflow-hidden">
                      {logo && <img src={logo} className="absolute -right-4 -bottom-6 h-32 md:h-40 opacity-5 pointer-events-none grayscale group-hover:grayscale-0 group-hover:opacity-10 transition-all duration-500 transform group-hover:scale-110" alt="" />}

                      <div className="flex flex-col gap-1.5 z-20">
                        <div className="flex items-center gap-3">
                          <h2 className="text-2xl md:text-3xl font-black uppercase tracking-tighter italic text-white group-hover:text-red-500 transition-colors">{driver.name}</h2>
                          <span className="hidden sm:inline-block text-xs font-mono font-bold bg-white/10 px-2 py-1 rounded-sm text-neutral-300">{driver.abbreviation}</span>
                          {isP1 && <Trophy size={24} className="text-yellow-400 fill-yellow-400/20 drop-shadow-[0_0_8px_rgba(250,204,21,0.5)] animate-pulse" />}
                        </div>
                        <div className="flex items-center gap-2">
                          {logo && <img src={logo} className="h-4 w-auto brightness-200 opacity-80" alt="" />}
                          <span className="text-xs md:text-sm font-bold text-neutral-400 uppercase tracking-widest">{driver.team}</span>
                        </div>
                      </div>
                    </div>

                    {/* Stats */}
                    <div className="flex items-center gap-6 md:gap-10 pr-4 md:pr-8 py-4 z-20 bg-gradient-to-l from-neutral-900 via-neutral-900/80 to-transparent pl-8">
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Wins</span>
                        <span className="text-xl font-bold text-neutral-300">{driver.wins}</span>
                      </div>
                      <div className="hidden sm:flex flex-col items-end">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Podiums</span>
                        <span className="text-xl font-bold text-neutral-300">{driver.podiums}</span>
                      </div>
                      <div className="flex flex-col items-end min-w-[70px] md:min-w-[90px]">
                        <span className="text-[10px] font-bold text-neutral-500 uppercase tracking-widest mb-1">Points</span>
                        <div className="flex flex-col items-end leading-none">
                          <div className="flex items-center gap-2">
                            <span className="text-4xl md:text-5xl font-black italic text-white tracking-tighter">{driver.points}</span>
                            {(driver.points_last_race ?? 0) > 0 && (
                              <span className="text-green-500 text-xs font-bold flex items-center gap-0.5 mt-2 bg-green-500/10 px-1.5 py-0.5 rounded-sm">
                                <ArrowUp size={12} strokeWidth={3} /> {driver.points_last_race}
                              </span>
                            )}
                          </div>
                          <span className={`text-xs font-bold mt-2 tracking-widest ${isP1 ? 'text-yellow-500' : 'text-neutral-500'}`}>
                            {pointsGap}
                          </span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          ) : (
            <div className="text-center p-12 bg-neutral-900/50 border border-neutral-800 rounded-lg">
              <span className="text-xl font-bold text-neutral-500 italic tracking-tighter uppercase">No Drivers Found</span>
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default DriversPage;
