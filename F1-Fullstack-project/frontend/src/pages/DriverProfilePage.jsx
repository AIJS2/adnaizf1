import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { API_URL } from '../config';
import { teamLogos, teamColors } from '../data/teamData';
import { Trophy, Award, Zap, ArrowLeft, RefreshCw, AlertTriangle, Users, TrendingUp, Flag } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';

const DriverProfilePage = () => {
  const { id } = useParams();
  const currentYear = new Date().getFullYear();

  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`${API_URL}/api/driver/${currentYear}/${id}`);
      if (!res.ok) throw new Error(`HTTP error: ${res.status}`);
      const data = await res.json();
      if (data.error) throw new Error(data.error);
      setProfile(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, [id, currentYear]);

  const teamColor = profile ? (teamColors[profile.team] || '#EF4444') : '#EF4444';
  const teamLogo = profile ? teamLogos[profile.team] : null;

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
          <h2 className="text-3xl font-black mb-2">Driver Not Found</h2>
          <p className="text-neutral-400 mb-6">{error || "Could not load data for this driver."}</p>
          <Link to="/stats" state={{ tab: 'drivers' }} className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-sm transition-colors">
            <ArrowLeft size={16} /> Back to Standings
          </Link>
        </main>
      </div>
    );
  }

  const tm = profile.teammate;
  const totalRacesH2H = tm ? (tm.race_h2h.driver_ahead + tm.race_h2h.teammate_ahead) : 0;
  const raceH2HPct = totalRacesH2H > 0 ? (tm.race_h2h.driver_ahead / totalRacesH2H) * 100 : 50;

  const totalQualiH2H = tm ? (tm.quali_h2h.driver_ahead + tm.quali_h2h.teammate_ahead) : 0;
  const qualiH2HPct = totalQualiH2H > 0 ? (tm.quali_h2h.driver_ahead / totalQualiH2H) * 100 : 50;

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans">
      
      <main className="container mx-auto px-4 md:px-6 pt-28 pb-16">
        
        {/* Back Link */}
        <Link to="/stats" state={{ tab: 'drivers' }} className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-6">
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
          
          {/* Watermark Driver Number */}
          <div className="absolute right-4 bottom-[-10%] text-[10rem] md:text-[20rem] font-black text-white/[0.02] leading-none select-none pointer-events-none italic transform -skew-x-12">
            {profile.driver_number}
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
                {teamLogo && <img src={teamLogo} alt={profile.team} className="h-10 w-auto drop-shadow-xl" />}
                <div className="h-6 w-px bg-neutral-700"></div>
                <span className="text-sm font-black uppercase tracking-[0.3em] text-neutral-400">{profile.team}</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-black tracking-tighter text-white uppercase italic transform -skew-x-6 flex flex-wrap items-baseline gap-4">
                {profile.name}
                <span className="text-3xl md:text-5xl text-neutral-700">#{profile.driver_number}</span>
              </h1>
              
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <span className="px-4 py-1.5 bg-neutral-800 text-neutral-200 text-xs font-bold uppercase tracking-widest rounded-full border border-neutral-700">
                  {currentYear} Season Driver
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
            <div className="relative group shrink-0">
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
        <section className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-10">
          {[
            { label: 'Wins', value: profile.wins, color: 'text-yellow-400' },
            { label: 'Podiums', value: profile.podiums, color: 'text-white' },
            { label: 'Pole Positions', value: profile.poles, color: 'text-purple-400' },
            { label: 'Best Finish', value: profile.best_finish ? `P${profile.best_finish}` : '-', color: 'text-green-400' },
            { label: 'Avg. Finish', value: profile.avg_finish ? `P${profile.avg_finish}` : '-', color: 'text-neutral-300' },
            { label: 'DNFs', value: profile.dnfs, color: 'text-red-500' }
          ].map((stat, idx) => (
            <div 
              key={idx}
              className="bg-neutral-900/60 border-t border-l border-neutral-800 relative group overflow-hidden"
              style={{ clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%)' }}
            >
              <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300" style={{ backgroundColor: teamColor }} />
              <div className="p-5 flex flex-col items-start relative z-10">
                <span className="text-[10px] text-neutral-500 uppercase font-bold tracking-[0.2em] mb-2">{stat.label}</span>
                <div className={`text-3xl lg:text-4xl font-black font-mono tracking-tighter ${stat.color}`}>
                  {stat.value}
                </div>
              </div>
              <div className="absolute bottom-0 right-0 w-3 h-3 bg-neutral-800 group-hover:bg-current transition-colors duration-300" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', color: teamColor }} />
            </div>
          ))}
        </section>

        {/* Teammate Head-to-Head */}
        {tm && (
          <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl mb-8">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-3">
                <Users className="text-red-500" size={24} />
                Teammate Head-to-Head Battle
              </h2>
              <span className="text-xs text-neutral-400 uppercase font-bold tracking-wider">
                vs {tm.name} (#{tm.driver_number})
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
              {/* Qualifying H2H */}
              <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-5">
                <div className="flex justify-between items-center text-sm font-bold mb-2">
                  <span style={{ color: teamColor }}>{profile.name} ({tm.quali_h2h.driver_ahead})</span>
                  <span className="text-neutral-500 uppercase text-xs tracking-wider">Qualifying</span>
                  <span className="text-neutral-400">({tm.quali_h2h.teammate_ahead}) {tm.name}</span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden flex">
                  <div className="h-full transition-all duration-500" style={{ width: `${qualiH2HPct}%`, backgroundColor: teamColor }}></div>
                  <div className="h-full bg-neutral-600 transition-all duration-500" style={{ width: `${100 - qualiH2HPct}%` }}></div>
                </div>
              </div>

              {/* Race H2H */}
              <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-5">
                <div className="flex justify-between items-center text-sm font-bold mb-2">
                  <span style={{ color: teamColor }}>{profile.name} ({tm.race_h2h.driver_ahead})</span>
                  <span className="text-neutral-500 uppercase text-xs tracking-wider">Race Finish</span>
                  <span className="text-neutral-400">({tm.race_h2h.teammate_ahead}) {tm.name}</span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden flex">
                  <div className="h-full transition-all duration-500" style={{ width: `${raceH2HPct}%`, backgroundColor: teamColor }}></div>
                  <div className="h-full bg-neutral-600 transition-all duration-500" style={{ width: `${100 - raceH2HPct}%` }}></div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Points Progression Chart */}
        <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-3">
              <TrendingUp className="text-yellow-500" size={24} />
              Points Progression
            </h2>
            <span className="text-xs text-neutral-400 font-mono">Cumulative PTS by Round</span>
          </div>

          <div className="h-[320px]">
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
                    return row ? `${row.race_name} (Finish: P${row.position}, +${row.points} pts)` : loc;
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
              Round-by-Round Results
            </h2>
            <span className="text-xs text-neutral-500 font-mono">{profile.progression.length} Races Completed</span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-neutral-950/80 text-neutral-400 text-xs uppercase font-semibold text-left">
                <tr>
                  <th className="p-4 w-12 text-center">Rnd</th>
                  <th className="p-4">Grand Prix</th>
                  <th className="p-4 text-center">Result</th>
                  <th className="p-4 text-right">Points</th>
                  <th className="p-4 text-right">Total</th>
                  {tm && <th className="p-4 text-center">Teammate ({tm.abbreviation})</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-neutral-800/60">
                {profile.progression.map((row) => (
                  <tr key={row.round} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="p-4 text-center font-mono font-bold text-neutral-500">{row.round}</td>
                    <td className="p-4 font-bold text-white">
                      <div>{row.race_name}</div>
                      <div className="text-xs text-neutral-500 font-normal">{row.location}</div>
                    </td>
                    <td className="p-4 text-center">
                      <span className={`inline-block px-3 py-1 rounded-full text-xs font-black font-mono ${
                        row.position === 1 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
                        row.position === 2 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/40' :
                        row.position === 3 ? 'bg-amber-600/20 text-amber-500 border border-amber-600/40' :
                        row.position <= 10 ? 'bg-green-500/10 text-green-400' :
                        row.position === 'DNF' ? 'bg-red-500/10 text-red-500' : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {typeof row.position === 'number' ? `P${row.position}` : row.position}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-white">
                      {row.points > 0 ? `+${row.points}` : '0'}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-neutral-300">
                      {row.cumulative_points}
                    </td>
                    {tm && (
                      <td className="p-4 text-center font-mono text-neutral-400 text-xs">
                        {typeof row.teammate_position === 'number' ? `P${row.teammate_position}` : row.teammate_position}
                      </td>
                    )}
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

export default DriverProfilePage;
