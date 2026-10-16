import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { AlertTriangle, Ban, ChevronRight, X } from 'lucide-react';
import type { IncidentDetail } from '../../types/f1';

interface IncidentBreakdownModalProps {
  /** Which incident list is being shown — drives copy + accent colours. */
  kind: 'dnf' | 'dns';
  incidents: IncidentDetail[];
  onClose: () => void;
  /** Season used to build the race-detail links. Defaults to the current year. */
  year?: number;
  /** Show which driver of the team was involved (used by the team profile). */
  showDriver?: boolean;
}

/**
 * Dark pit-wall modal listing every DNF/DNS incident of a driver or team,
 * covering both Grand Prix (`Race`) and Sprint sessions. Each row links to
 * `/race/{year}/{round}`.
 */
const IncidentBreakdownModal = ({
  kind,
  incidents,
  onClose,
  year = new Date().getFullYear(),
  showDriver = false,
}: IncidentBreakdownModalProps) => {
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [onClose]);

  const isDnf = kind === 'dnf';
  const title = isDnf ? 'DNF Breakdown' : 'DNS Breakdown';
  const subtitle = isDnf ? 'Did Not Finish incidents' : 'Did Not Start incidents';
  const Icon = isDnf ? AlertTriangle : Ban;
  const accentText = isDnf ? 'text-red-500' : 'text-orange-500';
  const accentBorder = isDnf ? 'border-red-500/40' : 'border-orange-500/40';
  const accentBg = isDnf ? 'bg-red-500/10' : 'bg-orange-500/10';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label={title}
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[80vh] flex flex-col bg-neutral-950 border border-neutral-800 rounded-3xl overflow-hidden shadow-[0_25px_80px_rgba(0,0,0,0.85)]"
        onClick={(event) => event.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between gap-4 p-5 md:p-6 border-b border-neutral-800 bg-neutral-900/60">
          <div className="flex items-center gap-3 min-w-0">
            <span className={`p-2.5 rounded-xl border ${accentBorder} ${accentBg} ${accentText} shrink-0`}>
              <Icon size={20} />
            </span>
            <div className="min-w-0">
              <h3 className="text-lg md:text-xl font-black tracking-tight text-white uppercase italic">
                {title}
              </h3>
              <p className="text-xs text-neutral-500 font-mono uppercase tracking-wider">
                {subtitle} • {incidents.length} {incidents.length === 1 ? 'incident' : 'incidents'}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close breakdown"
            className="p-2 rounded-xl text-neutral-500 hover:text-white hover:bg-neutral-800 transition-colors shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        {/* Incident list */}
        <div className="overflow-y-auto divide-y divide-neutral-800/60">
          {incidents.map((incident, index) => (
            <Link
              key={`${incident.round}-${incident.session_type}-${incident.driver_abbreviation ?? ''}-${index}`}
              to={`/race/${year}/${incident.round}`}
              onClick={onClose}
              className="group flex items-center gap-4 p-4 md:px-6 hover:bg-neutral-900/70 transition-colors"
            >
              {/* Round badge */}
              <span className="w-12 h-12 shrink-0 flex flex-col items-center justify-center rounded-xl bg-neutral-900 border border-neutral-800">
                <span className="text-[9px] uppercase font-bold text-neutral-500 tracking-wider">Rnd</span>
                <span className="text-lg font-black font-mono leading-none text-white">{incident.round}</span>
              </span>

              {/* Race name + location */}
              <div className="flex-1 min-w-0">
                <div className="font-bold text-white truncate group-hover:text-red-400 transition-colors">
                  {incident.race_name}
                </div>
                <div className="flex flex-wrap items-center gap-x-2 text-xs text-neutral-500">
                  {incident.location && <span>{incident.location}</span>}
                  {showDriver && incident.driver_name && (
                    <span className="text-neutral-300 font-mono">
                      {incident.driver_abbreviation ? `${incident.driver_abbreviation} · ` : ''}
                      {incident.driver_name}
                    </span>
                  )}
                </div>
              </div>

              {/* Session badge + status + grid */}
              <div className="flex items-center gap-3 shrink-0">
                {incident.session_type === 'Sprint' ? (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-orange-500/15 text-orange-400 border border-orange-500/40">
                    Sprint
                  </span>
                ) : (
                  <span className="px-2 py-0.5 rounded text-[10px] font-black uppercase tracking-wider bg-red-500/15 text-red-400 border border-red-500/40">
                    Grand Prix
                  </span>
                )}
                <div className="text-right min-w-[74px]">
                  <div className={`text-xs font-bold ${accentText}`}>
                    {incident.status || incident.position_text}
                  </div>
                  <div className="text-[10px] text-neutral-500 font-mono uppercase">
                    Grid {incident.grid ? `P${incident.grid}` : '—'}
                  </div>
                </div>
                <ChevronRight size={16} className="text-neutral-600 group-hover:text-neutral-300 transition-colors" />
              </div>
            </Link>
          ))}
        </div>

        {/* Footer hint */}
        <div className="p-3 md:px-6 border-t border-neutral-800 bg-neutral-900/40 text-center">
          <span className="text-[10px] text-neutral-600 font-mono uppercase tracking-widest">
            Click an incident to open the race detail
          </span>
        </div>
      </div>
    </div>
  );
};

export default IncidentBreakdownModal;
