import React from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Trophy } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
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
  isChampion?: boolean;
  isEliminated?: boolean;
}

const TeamCard: React.FC<TeamCardProps> = ({ team, index, maxPoints, isChampion, isEliminated }) => {
  const shouldReduceMotion = useReducedMotion();
  const logo = teamLogos[team.name];
  const color = getTeamColor(team.name);
  const teamId = team.id || team.name.toLowerCase().replace(/\s+/g, '_');
  const pointsNum = typeof team.points === 'string' ? parseFloat(team.points) : team.points;
  const pct = maxPoints > 0 ? Math.max(8, (pointsNum / maxPoints) * 100) : 50;

  return (
    <motion.div
      initial={shouldReduceMotion ? { opacity: 1 } : { opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{
        duration: shouldReduceMotion ? 0 : 0.35,
        delay: shouldReduceMotion ? 0 : index * 0.05,
        ease: [0.2, 0.8, 0.2, 1],
      }}
      className="h-full"
    >
      <Link
        to={`/team/${teamId}`}
        className={`block group bg-neutral-900/60 hover:bg-neutral-900 border rounded-lg p-5 transition-ui duration-300 shadow-lg relative overflow-hidden cursor-pointer h-full ${
          isChampion
            ? 'border-yellow-400/60 bg-gradient-to-br from-yellow-950/25 via-neutral-900/80 to-neutral-950 hover:border-yellow-400 shadow-[0_10px_30px_-10px_rgba(250,204,21,0.22)]'
            : 'border-neutral-800 hover:border-neutral-700'
        }`}
      >
        {/* Accent left color border */}
        <div
          className="absolute top-0 left-0 bottom-0 w-1.5"
          style={{
            background: isChampion
              ? `linear-gradient(180deg, #FACC15 0%, ${color} 100%)`
              : color,
          }}
        />
        {isChampion && (
          <div
            className="pointer-events-none absolute -top-10 -right-10 h-28 w-28 rounded-full bg-yellow-400/15 blur-2xl"
            aria-hidden="true"
          />
        )}

        <div className="flex justify-between items-start mb-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <span className={`font-mono text-xs font-black px-2 py-0.5 rounded-sm border shrink-0 ${
              isChampion
                ? 'bg-yellow-500/20 text-yellow-300 border-yellow-500/40'
                : 'text-neutral-500 bg-neutral-950 border-neutral-800'
            }`}>
              P{index + 1}
            </span>
            <span className="font-extrabold text-neutral-300 group-hover:text-red-400 transition-colors uppercase tracking-wider text-sm truncate">
              {team.name}
            </span>
            {isChampion ? (
              <span className="inline-flex items-center gap-1 bg-yellow-500/20 text-yellow-300 border border-yellow-400/50 text-[10px] font-black px-1.5 py-0.5 rounded-sm uppercase tracking-wider shrink-0">
                <Trophy size={10} /> WCC
              </span>
            ) : isEliminated ? (
              <span className="bg-neutral-950 text-neutral-500 border border-neutral-800 text-[9px] font-bold px-1.5 py-0.5 rounded-sm uppercase shrink-0">
                OUT
              </span>
            ) : null}
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
    </motion.div>
  );
};
export default TeamCard;
