import { Flag, Thermometer } from 'lucide-react';
import WorldFlag from 'react-world-flags';
import { getTrackMap, getCountryCode } from '../../data/trackData';

interface TrackMapProps {
  raceInfo?: { location?: string; country?: string; name?: string } | null;
  laps?: number | null;
  weatherInfo?: Array<{ track_temp?: number; air_temp?: number; TrackTemp?: number; AirTemp?: number }> | null;
  className?: string;
}

export function TrackMap({ raceInfo, laps, weatherInfo, className }: TrackMapProps) {
  const trackMapImg = getTrackMap(raceInfo);
  const country = raceInfo?.country;
  const name = raceInfo?.name || raceInfo?.location || 'Circuit';
  const countryCode = getCountryCode(raceInfo);

  const latestWeather = weatherInfo?.[weatherInfo.length - 1] || {};
  const trackTemp = latestWeather.track_temp ?? latestWeather.TrackTemp;
  const airTemp = latestWeather.air_temp ?? latestWeather.AirTemp;

  const sectionClasses = [
    'mb-10 flex flex-col items-center justify-center relative overflow-hidden',
    'rounded-xl border border-neutral-800/80 bg-neutral-900/40 backdrop-blur-md shadow-2xl p-6 sm:p-8',
    className,
  ].filter(Boolean).join(' ');

  const imgClasses = [
    'h-40 md:h-80 lg:h-96', 'object-contain', 'brightness-100 contrast-125',
    'drop-shadow-[0_0_24px_rgba(239,68,68,0.45)]', 'grayscale-0', 'transition-all duration-500',
    'group-hover:drop-shadow-[0_0_40px_rgba(239,68,68,0.7)]', 'group-hover:scale-105',
  ].join(' ');

  return (
    <section className={sectionClasses}>
      <div className="absolute top-6 left-6 flex flex-col sm:flex-row items-start sm:items-center gap-2 z-10">
        <span className="text-neutral-500 font-black text-xs uppercase tracking-[0.25em]">Circuit Layout</span>
        {country && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-800/90 text-neutral-300 border border-neutral-700/60 uppercase tracking-wider">
            {countryCode && <WorldFlag code={countryCode} alt="" className="w-4 h-auto shrink-0 rounded-[2px]" />}
            {country}
          </span>
        )}
      </div>

      <div className="absolute top-6 right-6 flex flex-wrap items-center gap-2 z-10">
        {laps != null && laps > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-red-950/40 text-red-400 border border-red-800/40 uppercase tracking-wider shadow-[0_0_12px_rgba(239,68,68,0.35)]">
            <Flag size={10} className="text-red-500" /> <span>{laps} LAPS</span>
          </span>
        )}
        {(trackTemp != null || airTemp != null) && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-neutral-800/90 text-neutral-300 border border-neutral-700/60 uppercase tracking-wider">
            <Thermometer size={10} className="text-amber-500" />
            {trackTemp != null && <span>Track {Math.round(trackTemp)}degC</span>}
            {trackTemp != null && airTemp != null && <span className="text-neutral-500 mx-1">dot</span>}
            {airTemp != null && <span>Air {Math.round(airTemp)}degC</span>}
          </span>
        )}
      </div>

      <div className="absolute inset-0 -z-10 bg-red-500/20 blur-[100px] rounded-full motion-safe:animate-pulse pointer-events-none"></div>
      <div className="absolute inset-0 -z-10 bg-purple-500/15 blur-[80px] rounded-full motion-safe:animate-[spin_10s_linear_infinite] pointer-events-none"></div>

      <div className="relative flex items-center justify-center mt-4 sm:mt-6 group transition-all duration-500">
        <div className="absolute inset-0 flex flex-col">
          <div className="flex-1 bg-red-500/10 border-b border-red-500/20" />
          <div className="flex-1 bg-amber-500/10 border-b border-amber-500/20" />
          <div className="flex-1 bg-purple-500/10 border-b border-purple-500/20" />
        </div>

        {trackMapImg ? (
          <img src={trackMapImg} alt={`Track map for ${name}`} className={imgClasses} />
        ) : (
          <div className="w-64 h-40 sm:w-80 sm:h-52 rounded-full border-4 border-neutral-700/50 relative flex items-center justify-center">
            <div className="absolute inset-0 border-2 border-dashed border-red-500/30 rounded-full motion-safe:animate-[dash_3s_linear_infinite]"></div>
            <div className="w-3 h-3 rounded-full bg-red-500 shadow-[0_0_12px_rgba(239,68,68,0.8)] animate-pulse absolute top-1/4 left-1/4"></div>
            <span className="text-neutral-500 text-xs font-mono font-bold uppercase tracking-wider opacity-60">no map asset</span>
          </div>
        )}

        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-red-500/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 h-full w-full skew-x-12 -translate-x-full group-hover:translate-x-full"></div>

        <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1.5">
          <div className="w-8 h-0.5 bg-red-500" />
          <span className="text-[10px] font-black text-red-400 uppercase tracking-widest">S/F</span>
          <div className="w-8 h-0.5 bg-red-500" />
        </div>

        <div className="absolute inset-0 pointer-events-none">
          <div className="absolute top-1/4 left-1/4 w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
          <div className="absolute top-1/4 right-1/4 w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" style={{ animationDelay: '200ms' }} />
          <div className="absolute bottom-1/4 left-1/4 w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" style={{ animationDelay: '400ms' }} />
          <div className="absolute bottom-1/4 right-1/4 w-1.5 h-1.5 rounded-full bg-red-500 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" style={{ animationDelay: '600ms' }} />
        </div>
      </div>

      <div className="absolute -right-6 -bottom-6 w-40 h-40 bg-red-500/10 blur-[90px] rounded-full pointer-events-none"></div>
    </section>
  );
}
