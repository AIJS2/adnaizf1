import React from 'react';
import { Link } from 'react-router-dom';
import { Trophy, ChevronRight, Crown } from 'lucide-react';
import { teamLogos, teamColors } from '../../data/teamData';

export interface DriverStanding {
  id?: string;
  name: string;
  team: string;
  points: string | number;
}

interface DriverStandingsListProps {
  drivers: DriverStanding[];
}

const DriverStandingsList: React.FC<DriverStandingsListProps> = ({ drivers }) => (
  <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 h-full shadow-2xl flex flex-col relative overflow-hidden">
    <div className="absolute top-0 right-0 w-64 h-64 bg-red-600/5 rounded-full blur-3xl pointer-events-none -translate-y-1/2 translate-x-1/4" />
    <div className="flex justify-between items-center mb-5 border-b border-neutral-800/80 pb-4 relative z-10">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500">
          <Trophy size={16} />
        </div>
        <h3 className="text-xl font-black uppercase tracking-tight text-white">Driver Standings</h3>
      </div>
      <Link to="/stats" className="text-xs font-bold uppercase tracking-wider text-red-500 hover:text-red-400 transition-colors flex items-center group">
        View All <ChevronRight size={14} className="ml-0.5 group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>

    <div className="space-y-1.5 flex-grow relative z-10">
      {drivers.map((driver, index) => {
        const logo = teamLogos[driver.team];
        const teamColor = teamColors[driver.team] || '#EF4444';
        const driverId = driver.id || driver.name.toLowerCase().replace(/\s+/g, '_');
        const isLeader = index === 0;

        // Custom background for top 3
        const bgClass = index === 0 
          ? 'bg-yellow-500/5 border-yellow-500/20 hover:bg-yellow-500/10 hover:border-yellow-500/40' 
          : index === 1 
          ? 'bg-slate-400/5 border-slate-400/20 hover:bg-slate-400/10 hover:border-slate-400/40'
          : index === 2
          ? 'bg-amber-600/5 border-amber-600/20 hover:bg-amber-600/10 hover:border-amber-600/40'
          : 'border-transparent hover:border-neutral-700 hover:bg-neutral-800/60';

        return (
          <Link 
            key={driver.name} 
            to={`/driver/${driverId}`}
            className={`flex items-center justify-between text-sm py-2.5 px-3 rounded-xl border transition-all group cursor-pointer ${bgClass}`}
          >
            <div className="flex items-center gap-3 min-w-0">
              <span className={`font-mono font-black text-xs w-5 text-center ${
                index === 0 ? 'text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.5)]' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-amber-600' : 'text-neutral-500'
              }`}>
                {index + 1}
              </span>
              <span className="w-1.5 h-4 rounded-full flex-shrink-0" style={{ backgroundColor: teamColor, boxShadow: `0 0 8px ${teamColor}80` }} />
              {logo ? <img src={logo} alt={driver.team} className="h-3.5 w-auto object-contain flex-shrink-0 opacity-90 group-hover:opacity-100" /> : <div className="w-3.5" />}
              <span className="font-bold text-white group-hover:text-red-400 uppercase tracking-tight transition-colors truncate">
                {driver.name}
              </span>
              {isLeader && (
                <span className="hidden sm:inline-block bg-yellow-500/20 text-yellow-400 text-[9px] font-black px-1.5 py-0.5 rounded border border-yellow-500/40 uppercase shadow-[0_0_10px_rgba(250,204,21,0.2)]">
                  <Crown size={10} className="inline-block mr-1 -mt-0.5" />P1
                </span>
              )}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0 font-mono">
              <span className="font-extrabold text-white text-base">{parseInt(String(driver.points), 10)}</span>
              <span className="text-[10px] text-neutral-500 uppercase font-sans font-bold">PTS</span>
              <ChevronRight size={14} className="text-neutral-600 group-hover:text-white transition-colors ml-1" />
            </div>
          </Link>
        );
      })}
    </div>
  </div>
);
export default DriverStandingsList;
