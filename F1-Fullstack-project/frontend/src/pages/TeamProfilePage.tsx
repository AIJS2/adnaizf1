import { DriverProfile, TeamProfile, TeamProgressionEntry } from '../types/f1';
import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_URL } from '../config';
import { teamLogos, teamColors } from '../data/teamData';
import { Trophy, Award, ArrowLeft, AlertTriangle, Users, TrendingUp, Flag, ChevronRight, PieChart } from 'lucide-react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';

const TeamProfilePage = () => {
  const { id } = useParams();
  const currentYear = new Date().getFullYear();

  const [profile, setProfile] = useState<TeamProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/team/${currentYear}/${id}`);
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProfile(data);
    } catch (err: unknown) {
      setError((err instanceof Error ? err.message : String(err)));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id, currentYear]);

  const teamColor = profile ? (teamColors[profile.name] || '#EF4444') : '#EF4444';
  const teamLogo = profile ? teamLogos[profile.name] : null;

  if (loading) {
    return (
      <div className="bg-neutral-950 min-h-screen text-white font-sans">
        
        <main className="container mx-auto px-4 md:px-6 pt-28 pb-16">
          <div className="animate-pulse space-y-8 w-full">
            <div className="h-64 md:h-80 bg-neutral-900/60 border border-neutral-800 rounded-3xl w-full"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="h-32 bg-neutral-900/60 border border-neutral-800 rounded-2xl"></div>
              <div className="h-32 bg-neutral-900/60 border border-neutral-800 rounded-2xl"></div>
              <div className="h-32 bg-neutral-900/60 border border-neutral-800 rounded-2xl"></div>
              <div className="h-32 bg-neutral-900/60 border border-neutral-800 rounded-2xl"></div>
            </div>
            <div className="h-96 bg-neutral-900/60 border border-neutral-800 rounded-3xl w-full"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-neutral-950 min-h-screen text-white font-sans">
        
        <main className="container mx-auto px-6 pt-28 pb-16 text-center">
          <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-3xl font-black mb-2">Team Not Found</h2>
          <p className="text-neutral-400 mb-6">{error || "Could not load data for this team."}</p>
          <Link to="/stats" state={{ tab: 'constructors' }} className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-sm transition-colors">
            <ArrowLeft size={16} /> Back to Standings
          </Link>
        </main>
      </div>
    );
  }

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans">
      
      <main className="container mx-auto px-4 md:px-6 pt-28 pb-16">
        
        {/* Back Link */}
        <Link to="/stats" state={{ tab: 'constructors' }} className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-6">
          <ArrowLeft size={16} /> Back to Championship Stats
        </Link>

        {/* Aggressive Hero Card */}
        <section className="relative rounded-3xl p-8 md:p-12 mb-10 overflow-hidden bg-neutral-900/40 border border-neutral-800 backdrop-blur-md">
          {/* Neon Glow Effects based on Team Color */}
          <div 
            className="absolute -top-[20%] -right-[10%] w-[500px] h-[500px] rounded-full blur-[100px] opacity-20 pointer-events-none"
            style={{ backgroundColor: teamColor }}
          />
          <div 
            className="absolute -bottom-[20%] -left-[10%] w-[400px] h-[400px] rounded-full blur-[100px] opacity-10 pointer-events-none"
            style={{ backgroundColor: teamColor }}
          />
          
          {/* Watermark Team Initial */}
          <div className="absolute right-4 bottom-[-10%] text-[10rem] md:text-[18rem] font-black text-white/[0.02] leading-none select-none pointer-events-none italic transform -skew-x-12 whitespace-nowrap">
            {profile.name.substring(0, 3).toUpperCase()}
          </div>
          
          {/* Techy background pattern */}
          <div 
            className="absolute inset-0 opacity-[0.03] pointer-events-none"
            style={{
              backgroundImage: 'linear-gradient(45deg, #ffffff 1px, transparent 1px)',
              backgroundSize: '20px 20px'
            }}
          />

          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                {teamLogo && <img src={teamLogo} alt={profile.name} className="h-12 w-auto drop-shadow-xl" />}
                <div className="h-6 w-px bg-neutral-700"></div>
                <span className="text-sm font-black uppercase tracking-[0.3em] text-neutral-400">Constructor</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white uppercase italic transform -skew-x-6 flex flex-wrap items-baseline gap-4">
                {profile.name}
              </h1>
              
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <span className="px-4 py-1.5 bg-neutral-800 text-neutral-200 text-xs font-bold uppercase tracking-widest rounded-full border border-neutral-700">
                  {currentYear} FIA F1 World Championship
                </span>
                <span 
                  className="px-4 py-1.5 text-xs font-bold uppercase tracking-widest rounded-full border"
                  style={{ borderColor: `${teamColor}40`, color: teamColor, backgroundColor: `${teamColor}10` }}
                >
                  {profile.points} Points
                </span>
              </div>
            </div>

            {/* Championship Position Badge */}
            <div className="relative group shrink-0 mt-6 md:mt-0">
              <div 
                className="absolute inset-0 blur-xl opacity-30 group-hover:opacity-60 transition-opacity duration-500 rounded-full"
                style={{ backgroundColor: profile.position === 1 ? '#eab308' : teamColor }}
              />
              <div className="relative flex flex-col items-center justify-center w-36 h-36 bg-neutral-900 border border-neutral-700 rounded-full shadow-2xl">
                <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-[0.2em] mb-1">Position</span>
                <div className="text-5xl font-black text-white font-mono leading-none tracking-tighter">
                  P{profile.position}
                </div>
                {profile.position === 1 && (
                  <Trophy size={16} className="text-yellow-500 mt-2 absolute bottom-4" />
                )}
              </div>
            </div>
          </div>
        </section>

        {/* Key Stats Grid */}
        <section className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
          {[
            { label: 'Championship Rank', value: `P${profile.position}`, icon: Trophy, color: profile.position === 1 ? 'text-yellow-500' : 'text-white' },
            { label: 'Total Points', value: profile.points, icon: PieChart, color: 'text-white' },
            { label: 'Race Wins', value: profile.wins, icon: Flag, color: 'text-yellow-400' },
            { label: 'Podium Finishes', value: profile.podiums, icon: Award, color: 'text-slate-300' }
          ].map((stat, i) => (
            <div key={i} className="group relative bg-neutral-900/40 border border-neutral-800 rounded-2xl p-6 overflow-hidden hover:bg-neutral-900/80 transition-colors">
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity">
                <stat.icon size={80} />
              </div>
              <div className="flex items-center gap-3 mb-3">
                <stat.icon size={16} className="text-neutral-500" />
                <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500">{stat.label}</span>
              </div>
              <div className={`text-4xl font-black font-mono tracking-tighter ${stat.color}`}>
                {stat.value}
              </div>
            </div>
          ))}
        </section>

        {/* Driver Lineup & Points Distribution */}
        {profile.drivers && profile.drivers.length > 0 && (
          <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-3">
                <Users className="text-red-500" size={24} />
                Driver Lineup & Points Contribution
              </h2>
              <span className="text-xs text-neutral-400 font-mono">
                {profile.drivers.length} Drivers Active
              </span>
            </div>

            {/* Split Bar */}
            {profile.drivers.length === 2 && (
              <div className="mb-6">
                <div className="flex justify-between items-center text-xs font-mono text-neutral-400 mb-2">
                  <span>{profile.drivers[0].name} ({profile.drivers[0].points_share}%)</span>
                  <span>{profile.drivers[1].name} ({profile.drivers[1].points_share}%)</span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden flex">
                  <div 
                    className="h-full transition-all duration-500" 
                    style={{ width: `${profile.drivers[0].points_share}%`, backgroundColor: teamColor }}
                  />
                  <div 
                    className="h-full bg-neutral-600 transition-all duration-500" 
                    style={{ width: `${profile.drivers[1].points_share}%` }}
                  />
                </div>
              </div>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {profile.drivers.map((dr: DriverProfile) => (
                <Link
                  key={dr.driverId || dr.id}
                  to={`/driver/${dr.driverId || dr.id}`}
                  className="group bg-neutral-950/60 hover:bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700 rounded-2xl p-5 transition-all flex items-center justify-between"
                >
                  <div className="flex items-center gap-4">
                    <div 
                      className="w-12 h-12 rounded-xl flex items-center justify-center font-mono font-black text-lg text-white"
                      style={{ backgroundColor: `${teamColor}33`, border: `1px solid ${teamColor}66` }}
                    >
                      #{dr.driver_number}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-white text-lg group-hover:text-red-400 transition-colors">
                          {dr.name}
                        </h3>
                        <span className="text-xs font-mono font-bold text-neutral-400">
                          ({dr.abbreviation})
                        </span>
                      </div>
                      <div className="text-xs text-neutral-400 mt-1 flex items-center gap-3">
                        <span>Rank: <strong className="text-white">P{dr.position}</strong></span>
                        <span>&bull;</span>
                        <span>Share: <strong className="text-white">{dr.points_share}%</strong></span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-3">
                    <div className="text-right">
                      <div className="text-2xl font-black font-mono text-white">
                        {dr.points}
                      </div>
                      <span className="text-[10px] text-neutral-500 uppercase font-bold">PTS</span>
                    </div>
                    <ChevronRight size={18} className="text-neutral-600 group-hover:text-white transition-colors" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Team Points Progression Chart */}
        <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-3">
              <TrendingUp className="text-yellow-500" size={24} />
              Constructors Points Progression
            </h2>
            <span className="text-xs text-neutral-400 font-mono">Cumulative PTS by Round</span>
          </div>

          <div className="h-[320px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={profile.progression} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
                <defs>
                    <linearGradient id="colorPts" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor={teamColor} stopOpacity={0.6}/>
                      <stop offset="95%" stopColor={teamColor} stopOpacity={0}/>
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                <XAxis dataKey="location" stroke="#666" tick={{ fill: '#888', fontSize: 12 }} tickLine={false} axisLine={false} />
                <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 12 }} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'rgba(15,15,15,0.95)', border: '1px solid #333', borderRadius: '12px', color: '#fff' }}
                  formatter={(val) => [`${val} PTS`, 'Cumulative Points']}
                  labelFormatter={(loc, items) => {
                    const row = items?.[0]?.payload;
                    return row ? `${row.race_name} (+${row.points} pts)` : loc;
                  }}
                />
                <Area 
                    type="monotone" 
                    dataKey="cumulative_points" 
                    stroke={teamColor} 
                    strokeWidth={4} 
                    fillOpacity={1}
                    fill="url(#colorPts)"
                    activeDot={{ r: 8, stroke: '#111', strokeWidth: 2, fill: teamColor }} 
                  />
                </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>

        {/* Round by Round Results Table */}
        <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
              <Flag size={20} className="text-red-500" />
              Round-by-Round Team Performance
            </h2>
            <span className="text-xs text-neutral-500 font-mono">{profile.progression?.length || 0} Races Scored</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-950/80 text-neutral-400 text-xs uppercase font-semibold text-left">
                <tr>
                  <th className="p-4 w-12 text-center">Rnd</th>
                  <th className="p-4">Grand Prix</th>
                  <th className="p-4 text-right">Points Scored</th>
                  <th className="p-4 text-right">Cumulative Total</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {profile.progression && profile.progression.map((row: TeamProgressionEntry) => (
                  <tr key={row.round} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="p-4 text-center font-mono font-bold text-neutral-500">{row.round}</td>
                    <td className="p-4 font-bold text-white">
                      <div>{row.race_name}</div>
                      <div className="text-xs text-neutral-500 font-normal">{row.location}</div>
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-white">
                      {row.points > 0 ? `+${row.points}` : '0'}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-neutral-300">
                      {row.cumulative_points}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

      </main>
    </div>
  );
};

export default TeamProfilePage;
