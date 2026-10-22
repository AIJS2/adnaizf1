import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp } from 'lucide-react';
import { teamLogos, getTeamColor } from '../../data/teamData';

export interface TeamStanding {
  id?: string;
  name: string;
  points: number | string;
  wins?: number | string;
  points_last_race?: number | string;
}

interface TeamCardProps {
  team: TeamStanding;
  index: number;
  maxPoints: number;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, index, maxPoints }) => {
  const logo = teamLogos[team.name];
  const color = getTeamColor(team.name);
  const teamId = team.id || team.name.toLowerCase().replace(/\s+/g, '_');
  const pointsNum = typeof team.points === 'string' ? parseFloat(team.points) : team.points;
  const pct = maxPoints > 0 ? Math.max(8, (pointsNum / maxPoints) * 100) : 50;

  return (
    <Link
      to={`/team/${teamId}`}
      className="block group bg-neutral-900/60 hover:bg-neutral-900 border border-neutral-800 hover:border-neutral-700 rounded-lg p-5 transition-ui duration-300 shadow-lg relative overflow-hidden cursor-pointer"
    >
      {/* Accent left color border */}
      <div className="absolute top-0 left-0 bottom-0 w-1.5" style={{ backgroundColor: color }} />

      <div className="flex justify-between items-start mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <span className="font-mono text-xs font-black text-neutral-500 bg-neutral-950 px-2 py-0.5 rounded-sm border border-neutral-800 shrink-0">
            P{index + 1}
          </span>
          <span className="font-extrabold text-neutral-300 group-hover:text-red-400 transition-colors uppercase tracking-wider text-sm truncate">
            {team.name}
          </span>
        </div>
        {logo && (
          <img
            src={logo}
            alt={team.name}
            className={`h-5 w-auto object-contain opacity-90 shrink-0 ml-2 ${/audi/i.test(team.name || '') ? 'brightness-0 invert' : ''}`}
          />
        )}
      </div>

      <div className="flex items-baseline justify-between mt-2">
        <div>
          <p className="text-3xl sm:text-4xl font-black italic text-white tracking-tight font-mono">
            {parseInt(String(team.points), 10)} <span className="text-xs font-bold text-neutral-500 not-italic">PTS</span>
          </p>
          <p className="text-xs font-bold text-neutral-400 font-mono mt-0.5">
            {team.wins !== undefined ? `${team.wins} WINS` : '0 WINS'}
          </p>
        </div>

        {team.points_last_race && parseInt(String(team.points_last_race), 10) > 0 && (
          <div className="flex items-center gap-1 text-green-400 font-bold text-xs bg-green-500/10 px-2 py-0.5 rounded-full border border-green-500/20 font-mono">
            <ArrowUp size={12} strokeWidth={3} />
            <span>+{parseInt(String(team.points_last_race), 10)}</span>
          </div>
        )}
      </div>

      {/* Mini Progress Bar */}
      <div className="mt-3 w-full bg-neutral-950 rounded-full h-1 overflow-hidden">
        <div 
          className="h-full rounded-full transition-ui duration-500" 
          style={{ width: `${pct}%`, backgroundColor: color }} 
        />
      </div>
    </Link>
  );
};
export default TeamCard;
