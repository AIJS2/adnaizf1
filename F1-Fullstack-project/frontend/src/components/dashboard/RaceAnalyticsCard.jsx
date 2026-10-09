import React from 'react';
import { Link } from 'react-router-dom';
import { Calendar, ChevronRight, Clock, MapPin, Trophy } from 'lucide-react';

const RaceAnalyticsCard = ({ races, year }) => (
  <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 h-full shadow-2xl flex flex-col">
    <div className="flex justify-between items-center mb-5 border-b border-neutral-800/80 pb-4">
      <div className="flex items-center gap-2.5">
        <div className="w-8 h-8 rounded-lg bg-red-600/10 border border-red-500/20 flex items-center justify-center text-red-500">
          <Calendar size={16} />
        </div>
        <h3 className="text-xl font-black uppercase tracking-tight text-white">Race Calendar & Results</h3>
      </div>
      <Link to="/races" className="text-xs font-bold uppercase tracking-wider text-red-500 hover:text-red-400 transition-colors flex items-center group">
        Full Season <ChevronRight size={14} className="ml-0.5 group-hover:translate-x-1 transition-transform" />
      </Link>
    </div>

    <div className="space-y-3 flex-grow">
      {races.map((race, index) => {
        const isFinished = race.status === 'Finished';
        const isUpcoming = race.status === 'Upcoming';
        const isOngoing = race.status === 'Ongoing';

        return (
          <Link
            key={race.name + index}
            to={`/race/${year}/${race.round}`}
            className="group block bg-neutral-950/60 hover:bg-neutral-900 border border-neutral-800/80 hover:border-neutral-700 rounded-2xl p-4 transition-all duration-200"
          >
            <div className="flex justify-between items-start mb-1.5">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-mono font-bold bg-neutral-900 text-neutral-400 border border-neutral-800 px-2 py-0.5 rounded uppercase">
                  Rnd {race.round}
                </span>
                <p className="font-extrabold text-white text-sm uppercase tracking-tight group-hover:text-red-400 transition-colors truncate">
                  {race.name}
                </p>
              </div>

              {isFinished && (
                <span className="text-[10px] font-bold text-neutral-400 bg-neutral-900 px-2 py-0.5 rounded border border-neutral-800">
                  FINISHED
                </span>
              )}
              {isOngoing && (
                <span className="text-[10px] font-bold text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded border border-amber-500/30 animate-pulse flex items-center gap-1">
                  <Clock size={10} /> ONGOING
                </span>
              )}
              {isUpcoming && (
                <span className="text-[10px] font-bold text-sky-400 bg-sky-500/10 px-2 py-0.5 rounded border border-sky-500/30">
                  UPCOMING
                </span>
              )}
            </div>

            <div className="flex items-center justify-between text-xs text-neutral-400 mt-2">
              <span className="flex items-center gap-1">
                <MapPin size={12} className="text-neutral-500" /> {race.location} &bull; {new Date(`${race.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
              </span>

              {isFinished && race.winner && (
                <div className="flex items-center gap-1.5 text-xs font-bold text-yellow-400">
                  <Trophy size={13} className="text-yellow-500" />
                  <span>{race.winner}</span>
                </div>
              )}
            </div>
          </Link>
        );
      })}
    </div>
  </div>
);
export default RaceAnalyticsCard;
