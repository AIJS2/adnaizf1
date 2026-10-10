import { Link } from 'react-router-dom';
import type { ReactNode } from 'react';
import { teamLogos } from '../../data/teamData';

/** The session-result fields a summary card reads to render its highlight. */
export interface SummaryCardData {
  full_name?: string;
  team_name?: string;
  time?: string;
  lap_time?: string;
  lap_number?: number | string;
}

interface SummaryCardProps {
  title: string;
  icon: ReactNode;
  data?: SummaryCardData | null;
}

// =======================================================================

const SummaryCard = ({ title, icon, data }: SummaryCardProps) => (
  <div className="bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-2xl p-6 h-full shadow-[0_8px_30px_rgb(0,0,0,0.4)] hover:shadow-[0_8px_30px_rgba(255,0,0,0.1)] hover:border-neutral-700 transition-all duration-500 group relative overflow-hidden">
    <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-3xl -mr-16 -mt-16 group-hover:bg-red-500/10 transition-colors"></div>
    <div className="flex justify-between items-center text-neutral-400 text-sm relative z-10">
      <span className="font-semibold uppercase tracking-wider">{title}</span>
      <span className="text-neutral-500 group-hover:text-red-500 transition-colors">{icon}</span>
    </div>
    {data && data.full_name ? (
      <div className="mt-5 relative z-10">
        <p className="text-2xl font-black text-white flex items-center gap-3 tracking-tight">
          {data.team_name && teamLogos[data.team_name] && (
            <Link to={`/team/${data.team_name.toLowerCase().replace(/\s+/g, '_')}`}>
              <img src={teamLogos[data.team_name]} alt={data.team_name} className="h-6 w-auto drop-shadow-md hover:opacity-80 transition-opacity" />
            </Link>
          )}
          <Link to={`/driver/${data.full_name.toLowerCase().replace(/\s+/g, '_')}`} className="hover:text-red-400 transition-colors">
            {data.full_name}
          </Link>
        </p>
        {title === 'Fastest Lap' && data.lap_number ? (
          <p className="font-mono text-red-400 mt-2 text-sm font-bold bg-red-500/10 inline-block px-2 py-1 rounded">Lap {data.lap_number} <span className="text-neutral-300 ml-2">{data.lap_time}</span></p>
        ) : (
          <p className="font-mono text-neutral-300 mt-2 font-bold text-lg">{data.time || data.lap_time}</p>
        )}
      </div>
    ) : (
      <p className="mt-5 text-neutral-500 text-sm italic relative z-10">Race not run yet.</p>
    )}
  </div>
);

// =======================================================================
export { SummaryCard };
