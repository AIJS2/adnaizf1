import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { teamLogos, teamColors } from '../../data/teamData';

const TeamCard = ({ team, index, maxPoints }) => {
  const logo = teamLogos[team.name];
  const color = teamColors[team.name] || '#EF4444';
  const teamId = team.id || team.name.toLowerCase().replace(/\s+/g, '_');
  const pct = maxPoints > 0 ? Math.max(8, (team.points / maxPoints) * 100) : 50;

  return (
    <Link
      to={`/team/${teamId}`}
      className="block group bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-2xl p-5 transition-all duration-300 hover:-translate-y-1 shadow-lg relative overflow-hidden cursor-pointer"
    >
      {/* Accent left color border */}
      <div className="absolute top-0 left-0 bottom-0 w-1.5" style={{ backgroundColor: color }} />

      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2.5">
          <span className="font-mono text-xs font-black text-neutral-500 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
            P{index + 1}
          </span>
          <span className="font-extrabold text-neutral-300 group-hover:text-red-400 transition-colors uppercase tracking-wider text-sm truncate max-w-[130px]">
            {team.name}
          </span>
        </div>
        {logo && <img src={logo} alt={team.name} className="h-5 w-auto object-contain opacity-90" />}
      </div>

      <div className="flex items-baseline justify-between mt-2">
        <p className="text-3xl sm:text-4xl font-black italic text-white tracking-tight font-mono">
          {parseInt(team.points, 10)} <span className="text-xs font-bold text-neutral-500 not-italic">PTS</span>
        </p>

        {team.points_last_race > 0 && (
          <div className="flex items-center gap-1 text-green-400 font-bold text-xs bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 font-mono">
            <ArrowUp size={12} strokeWidth={3} />
            <span>+{parseInt(team.points_last_race, 10)}</span>
          </div>
        )}
      </div>

      {/* Mini Progress Bar */}
      <div className="mt-3 w-full bg-neutral-950 rounded-full h-1 overflow-hidden">
        <div 
          className="h-full rounded-full transition-all duration-500" 
          style={{ width: `${pct}%`, backgroundColor: color }} 
        />
      </div>
    </Link>
  );
};
export default TeamCard;
