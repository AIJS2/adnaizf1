import { useState, type ReactNode } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { teamLogos, teamColors } from '../data/teamData';
import { Trophy, ArrowLeft, AlertTriangle, Users, TrendingUp, Flag, Zap } from 'lucide-react';
import { XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, AreaChart, Area } from 'recharts';
import { fetchDriverProfile } from '../services/api';
import type { DriverProfilePayload } from '../services/api';
import IncidentBreakdownModal from '../components/ui/IncidentBreakdownModal';
import { incidentBreakdownLabel, incidentTooltip } from '../utils/incidents';
import type { DriverProgressionEntry } from '../types/f1';

/** Total H2H count for one session, or null when the payload omits that split. */
const h2hTotal = (
  h2h?: { driver_ahead: number; teammate_ahead: number },
): number | null =>
  h2h ? h2h.driver_ahead + h2h.teammate_ahead : null;

/** Positions at or above this value are legacy "missing position" sentinels. */
const INVALID_POSITION_THRESHOLD = 90;

/** Never render the legacy 99 sentinel as "P99" — show "-" instead. */
const positionLabel = (position: number | string): string =>
  typeof position === 'number'
    ? position >= INVALID_POSITION_THRESHOLD
      ? '-'
      : `P${position}`
    : String(position);

/** One card of the Key Stats grid; DNF/DNS cards become clickable above zero. */
interface ProfileStatCard {
  label: string;
  value: ReactNode;
  color: string;
  tooltip?: string;
  sub?: string;
  onClick?: () => void;
  hoverClass?: string;
}

/** Badge text for a round that had a Sprint session, or null when it didn't. */
const sprintBadgeLabel = (row: DriverProgressionEntry): string | null => {
  const status = row.sprint_status;
  const position = row.sprint_position;
  if (position == null && (status == null || status === '')) return null;
  if (position === 'DNF') return 'SPRINT DNF';
  if (position === 'DNS') return 'SPRINT DNS';
  const posNum = Number(position);
  if (Number.isFinite(posNum) && posNum > 0 && posNum < INVALID_POSITION_THRESHOLD) {
    const pts = Number(row.sprint_points) || 0;
    return `SPRINT P${posNum}${pts > 0 ? ` (+${pts})` : ''}`;
  }
  return 'SPRINT';
};

const DriverProfilePage = () => {
  const { id } = useParams();
  const currentYear = new Date().getFullYear();

  // Cached + retried by react-query; `enabled` avoids firing for a missing id.
  const { data: profile, isLoading: loading, error } = useQuery<DriverProfilePayload | null>({
    queryKey: ['driverProfile', currentYear, id],
    queryFn: () => fetchDriverProfile(currentYear, id as string),
    enabled: !!id,
  });

  // Which incident breakdown modal is open ('dnf' / 'dns'), if any.
  const [incidentModal, setIncidentModal] = useState<'dnf' | 'dns' | null>(null);

  const teamColor = profile ? (teamColors[profile.team] || '#EF4444') : '#EF4444';
  const teamLogo = profile ? teamLogos[profile.team] : null;

  if (loading) {
    return (
      <div className="bg-neutral-950 min-h-screen text-white font-sans">
        
        <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-10 py-6 md:py-8 xl:py-10">
          <div className="motion-safe:animate-pulse space-y-8 w-full">
            <div className="h-64 md:h-80 bg-neutral-900/60 border border-neutral-800 rounded-lg w-full"></div>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div className="h-32 bg-neutral-900/60 border border-neutral-800 rounded-lg"></div>
              <div className="h-32 bg-neutral-900/60 border border-neutral-800 rounded-lg"></div>
              <div className="h-32 bg-neutral-900/60 border border-neutral-800 rounded-lg"></div>
              <div className="h-32 bg-neutral-900/60 border border-neutral-800 rounded-lg"></div>
            </div>
            <div className="h-96 bg-neutral-900/60 border border-neutral-800 rounded-lg w-full"></div>
          </div>
        </main>
      </div>
    );
  }

  if (error || !profile) {
    return (
      <div className="bg-neutral-950 min-h-screen text-white font-sans">
        
        <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-10 py-6 md:py-8 xl:py-10 text-center">
          <AlertTriangle className="text-red-500 mx-auto mb-4" size={48} />
          <h2 className="text-3xl font-black mb-2">Driver Not Found</h2>
          <p className="text-neutral-400 mb-6">{error?.message || "Could not load data for this driver."}</p>
          <Link to="/stats" state={{ tab: 'drivers' }} className="inline-flex items-center gap-2 px-6 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-full font-bold text-sm transition-colors">
            <ArrowLeft size={16} /> Back to Standings
          </Link>
        </main>
      </div>
    );
  }

  const tm = profile.teammate;
  const totalRacesH2H = h2hTotal(tm?.race_h2h);
  const raceH2HPct = totalRacesH2H && totalRacesH2H > 0 && tm?.race_h2h
    ? (tm.race_h2h.driver_ahead / totalRacesH2H) * 100 : 50;

  const totalQualiH2H = h2hTotal(tm?.quali_h2h);
  const qualiH2HPct = totalQualiH2H && totalQualiH2H > 0 && tm?.quali_h2h
    ? (tm.quali_h2h.driver_ahead / totalQualiH2H) * 100 : 50;

  const progression: DriverProgressionEntry[] = profile.progression ?? [];

  // Sprint-aware incident totals (Grand Prix + Sprint sessions combined).
  const dnfDetails = profile.dnf_details ?? [];
  const dnsDetails = profile.dns_details ?? [];
  const dnfTotal = Number(profile.dnfs) || 0;
  const dnsTotal = Number(profile.dnss) || 0;
  const stats: ProfileStatCard[] = [
    { label: 'Wins', value: profile.wins, color: 'text-yellow-400' },
    { label: 'Podiums', value: profile.podiums, color: 'text-white' },
    { label: 'Pole Positions', value: profile.poles, color: 'text-purple-400' },
    { label: 'Best Finish', value: profile.best_finish ? `P${profile.best_finish}` : '-', color: 'text-green-400' },
    { label: 'Avg. Finish', value: profile.avg_finish ? `P${profile.avg_finish}` : '-', color: 'text-neutral-300' },
    {
      label: 'DNFs',
      value: dnfTotal,
      color: 'text-red-500',
      tooltip: incidentTooltip(dnfDetails),
      sub: incidentBreakdownLabel(Number(profile.race_dnfs) || 0, Number(profile.sprint_dnfs) || 0),
      onClick: dnfTotal > 0 ? () => setIncidentModal('dnf') : undefined,
      hoverClass: 'hover:border-red-500/50',
    },
    {
      label: 'DNSs',
      value: dnsTotal,
      color: 'text-orange-500',
      tooltip: incidentTooltip(dnsDetails),
      sub: incidentBreakdownLabel(Number(profile.race_dnss) || 0, Number(profile.sprint_dnss) || 0),
      onClick: dnsTotal > 0 ? () => setIncidentModal('dns') : undefined,
      hoverClass: 'hover:border-orange-500/50',
    },
  ];

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans">
      
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-10 py-6 md:py-8 xl:py-10">
        
        {/* Back Link */}
        <Link to="/stats" state={{ tab: 'drivers' }} className="inline-flex items-center gap-2 text-sm text-neutral-400 hover:text-white transition-colors mb-6">
          <ArrowLeft size={16} /> Back to Championship Stats
        </Link>

        {/* Aggressive Hero Card */}
        <section className="relative rounded-lg p-8 md:p-12 mb-10 overflow-hidden bg-neutral-900/40 border border-neutral-800 backdrop-blur-md">
          {/* Neon Glow Effects based on Team Color */}
          <div 
            className="absolute top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full blur-[100px] opacity-20 pointer-events-none"
            style={{ backgroundColor: teamColor }}
          />
          <div 
            className="absolute bottom-[-20%] left-[-10%] w-[400px] h-[400px] rounded-full blur-[100px] opacity-10 pointer-events-none"
            style={{ backgroundColor: teamColor }}
          />
          
          {/* Watermark Driver Number */}
          <div className="absolute right-4 bottom-[-10%] text-[10rem] md:text-[20rem] font-black text-white/2 leading-none select-none pointer-events-none italic transform -skew-x-12">
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

          <div className="relative z-10 flex flex-col xl:flex-row justify-between items-start xl:items-center gap-8">
            <div className="flex-1">
              <div className="flex items-center gap-4 mb-4">
                {teamLogo && <img src={teamLogo} alt={profile.team} className="h-10 w-auto drop-shadow-xl" />}
                <div className="h-6 w-px bg-neutral-700"></div>
                <span className="text-sm font-black uppercase tracking-[0.3em] text-neutral-400">{profile.team}</span>
              </div>
              
              <h1 className="text-5xl md:text-7xl font-black tracking-tight text-white italic flex flex-wrap items-baseline gap-4">
                {profile.name}
                <span className="text-3xl md:text-5xl text-neutral-700">#{profile.driver_number}</span>
              </h1>
              
              <div className="mt-6 flex flex-wrap items-center gap-4">
                <span className="px-4 py-1.5 bg-neutral-800 text-neutral-200 text-xs font-bold tracking-normal rounded-full border border-neutral-700">
                  {currentYear} Season Driver
                </span>
                <span 
                  className="px-4 py-1.5 text-xs font-bold tracking-normal rounded-full border"
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
                <span className="text-[11px] uppercase font-bold text-neutral-500 tracking-[0.2em] mb-1">Position</span>
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
        <section className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-7 gap-4 mb-10">
          {stats.map((stat, idx) => {
            const cardClass = `bg-neutral-900/60 border-t border-l border-neutral-800 relative group overflow-hidden w-full text-left ${
              stat.onClick ? `cursor-pointer transition-colors ${stat.hoverClass ?? ''}` : ''
            }`;
            const cardStyle = {
              clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 15px), calc(100% - 15px) 100%, 0 100%)',
            } as const;
            const cardBody = (
              <>
                <div className="absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-300" style={{ backgroundColor: teamColor }} />
                {stat.onClick && (
                  <span className="absolute top-4 right-4 text-[11px] font-mono uppercase tracking-wider text-neutral-600 group-hover:text-white transition-colors">
                    Details →
                  </span>
                )}
                <div className="p-5 flex flex-col items-start relative z-10">
                  <span className="text-[11px] text-neutral-500 uppercase font-bold tracking-[0.2em] mb-2">{stat.label}</span>
                  <div className={`text-3xl lg:text-4xl font-black font-mono tracking-tighter ${stat.color} ${stat.tooltip ? 'cursor-help border-b border-dashed border-current' : ''}`}>
                    {stat.value}
                  </div>
                  {stat.sub && (
                    <span className="mt-1.5 text-[11px] font-mono font-bold uppercase tracking-wider text-neutral-500">
                      {stat.sub}
                    </span>
                  )}
                </div>
                <div className="absolute bottom-0 right-0 w-3 h-3 bg-neutral-800 group-hover:bg-current transition-colors duration-300" style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)', color: teamColor }} />
              </>
            );
            return stat.onClick ? (
              <button
                key={idx}
                type="button"
                title={stat.tooltip}
                onClick={stat.onClick}
                className={cardClass}
                style={cardStyle}
              >
                {cardBody}
              </button>
            ) : (
              <div key={idx} title={stat.tooltip} className={cardClass} style={cardStyle}>
                {cardBody}
              </div>
            );
          })}
        </section>

        {/* Teammate Head-to-Head */}
        {tm && (
          <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-lg p-6 md:p-8 shadow-2xl mb-8">
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
              <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-5">
                <div className="flex justify-between items-center text-sm font-bold mb-2">
                  <span style={{ color: teamColor }}>{profile.name} ({tm?.quali_h2h?.driver_ahead})</span>
                  <span className="text-neutral-500 uppercase text-xs tracking-wider">Qualifying</span>
                  <span className="text-neutral-400">({tm?.quali_h2h?.teammate_ahead}) {tm.name}</span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden flex">
                  <div className="h-full transition-[width] duration-500" style={{ width: `${qualiH2HPct}%`, backgroundColor: teamColor }}></div>
                  <div className="h-full bg-neutral-600 transition-[width] duration-500" style={{ width: `${100 - qualiH2HPct}%` }}></div>
                </div>
              </div>

              {/* Race H2H */}
              <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-lg p-5">
                <div className="flex justify-between items-center text-sm font-bold mb-2">
                  <span style={{ color: teamColor }}>{profile.name} ({tm?.race_h2h?.driver_ahead})</span>
                  <span className="text-neutral-500 uppercase text-xs tracking-wider">Race Finish</span>
                  <span className="text-neutral-400">({tm?.race_h2h?.teammate_ahead}) {tm.name}</span>
                </div>
                <div className="w-full bg-neutral-800 rounded-full h-3 overflow-hidden flex">
                  <div className="h-full transition-[width] duration-500" style={{ width: `${raceH2HPct}%`, backgroundColor: teamColor }}></div>
                  <div className="h-full bg-neutral-600 transition-[width] duration-500" style={{ width: `${100 - raceH2HPct}%` }}></div>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Points Progression Chart */}
        <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-lg p-6 md:p-8 shadow-2xl mb-8">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl md:text-2xl font-black tracking-tight flex items-center gap-3">
              <TrendingUp className="text-yellow-500" size={24} />
              Points Progression
            </h2>
            <span className="text-xs text-neutral-400 font-mono">Cumulative PTS by Round</span>
          </div>

          <div className="h-[320px] w-full min-w-0">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={progression} margin={{ top: 10, right: 20, left: 0, bottom: 10 }}>
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
                    return row ? `${row.race_name} (Finish: ${positionLabel(row.position)}, +${row.points} pts)` : loc;
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
        <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-lg overflow-hidden shadow-2xl">
          <div className="p-6 border-b border-neutral-800 flex items-center justify-between">
            <h2 className="text-xl font-black tracking-tight flex items-center gap-2">
              <Flag size={20} className="text-red-500" />
              Round-by-Round Results
            </h2>
            <span className="text-xs text-neutral-500 font-mono">{progression.length} Races Completed</span>
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
                {progression.map((row) => {
                  // Numeric fields arrive as NumericString; coerce once per row.
                  const posNum = Number(row.position);
                  const gridPos = Number(row.grid_position) || 0;
                  const racePts = Number(row.points) || 0;
                  const sprintLabel = sprintBadgeLabel(row);
                  const sprintIncident = row.sprint_position === 'DNF' || row.sprint_position === 'DNS';
                  return (
                  <tr key={row.round} className="hover:bg-neutral-800/30 transition-colors">
                    <td className="p-4 text-center font-mono font-bold text-neutral-500">{row.round}</td>
                    <td className="p-4 font-bold text-white">
                      <div>{row.race_name}</div>
                      <div className="text-xs text-neutral-500 font-normal">{row.location}</div>
                      {sprintLabel && (
                        <span className={`inline-flex items-center gap-1 mt-1.5 px-1.5 py-0.5 rounded text-[10px] font-black font-mono uppercase tracking-wider border ${
                          sprintIncident
                            ? 'bg-red-500/10 text-red-400 border-red-500/40'
                            : 'bg-orange-500/10 text-orange-400 border-orange-500/40'
                        }`}>
                          <Zap size={10} />
                          {sprintLabel}
                        </span>
                      )}
                    </td>
                    <td className="p-4 text-center">
                      <span title={`${positionLabel(row.position)} • Race: ${row.race_points} pts${sprintLabel ? ` | ${sprintLabel}` : ''} • Started ${gridPos > 0 ? 'P'+row.grid_position : 'Pitlane/DNS'} • ${row.status}`} className={`inline-block px-3 py-1 rounded-full text-xs font-black font-mono cursor-help ${
                        row.position === 1 ? 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/40' :
                        row.position === 2 ? 'bg-slate-300/20 text-slate-300 border border-slate-300/40' :
                        row.position === 3 ? 'bg-amber-600/20 text-amber-500 border border-amber-600/40' :
                        posNum <= 10 ? 'bg-green-500/10 text-green-400' :
                        row.position === 'DNF' ? 'bg-red-500/10 text-red-500' :
                        row.position === 'DNS' ? 'bg-orange-500/10 text-orange-500' : 'bg-neutral-800 text-neutral-400'
                      }`}>
                        {positionLabel(row.position)}
                      </span>
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-white">
                      {racePts > 0 ? `+${row.points}` : '0'}
                    </td>
                    <td className="p-4 text-right font-mono font-bold text-neutral-300">
                      {row.cumulative_points}
                    </td>
                    {tm && (
                      <td className="p-4 text-center font-mono text-neutral-400 text-xs">
                        {positionLabel(row.teammate_position ?? '—')}
                      </td>
                    )}
                  </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        {/* Incident breakdown modal (DNFs / DNSs) */}
        {incidentModal && (
          <IncidentBreakdownModal
            kind={incidentModal}
            incidents={incidentModal === 'dnf' ? dnfDetails : dnsDetails}
            onClose={() => setIncidentModal(null)}
            year={currentYear}
          />
        )}

      </main>
    </div>
  );
};

export default DriverProfilePage;
