import { Flag, Thermometer } from 'lucide-react';
import { getTrackMap, getCountryCode } from '../../data/trackData';
import { CountryFlag } from './CountryFlag';

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
    'rounded-xl border border-neutral-800/80 bg-neutral-900/40 backdrop-blur-md p-5 sm:p-6',
    className,
  ].filter(Boolean).join(' ');

  return (
    <section className={sectionClasses}>
      <div className="absolute top-5 left-5 flex flex-col sm:flex-row items-start sm:items-center gap-2 z-10">
        <span className="text-neutral-500 font-black text-xs uppercase tracking-[0.25em]">Circuit Layout</span>
        {country && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-bold bg-neutral-800/90 text-neutral-300 border border-neutral-700/60 uppercase tracking-wider">
            <CountryFlag code={countryCode} alt="" className="w-4 h-auto shrink-0 rounded-[2px]" />
            {country}
          </span>
        )}
      </div>

      <div className="absolute top-5 right-5 flex flex-wrap justify-end items-center gap-2 z-10">
        {laps != null && laps > 0 && (
          <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-red-950/40 text-red-400 border border-red-800/40 uppercase tracking-wider">
            <Flag size={10} className="text-red-500" /> <span>{laps} LAPS</span>
          </span>
        )}
        {(trackTemp != null || airTemp != null) && (
          <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-bold bg-neutral-800/90 text-neutral-300 border border-neutral-700/60 uppercase tracking-wider">
            <Thermometer size={10} className="text-amber-500" />
            {trackTemp != null && <span>Track {Math.round(trackTemp)}°C</span>}
            {trackTemp != null && airTemp != null && <span className="text-neutral-500 mx-1">·</span>}
            {airTemp != null && <span>Air {Math.round(airTemp)}°C</span>}
          </span>
        )}
      </div>

      <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-56 bg-red-500/10 blur-[110px] pointer-events-none" aria-hidden="true" />

      <div className="relative flex items-center justify-center mt-8">
        {trackMapImg ? (
          <img
            src={trackMapImg}
            alt={`Track map for ${name}`}
            className="h-36 md:h-64 lg:h-72 object-contain drop-shadow-[0_0_24px_rgba(239,68,68,0.4)]"
          />
        ) : (
          <div className="w-64 h-36 sm:w-80 sm:h-44 rounded-full border border-dashed border-neutral-700/60 flex items-center justify-center">
            <span className="text-neutral-600 text-xs font-mono font-bold uppercase tracking-wider">no map asset</span>
          </div>
        )}
      </div>
    </section>
  );
}
