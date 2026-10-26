import React, { useEffect, useMemo, useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, AlertCircle, RefreshCw, Volume2, Search, Radio } from 'lucide-react';
import { API_URL } from '../../config';
import { getDriverColor } from '../../data/teamData';
import { LiveTimingRadioItem } from '../../types/f1';
import {
  LIVE_TIMING_UNAVAILABLE_TITLE,
  LIVE_TIMING_UNAVAILABLE_MESSAGE,
} from '../../utils/liveTimingCopy';

// Custom types
interface TeamRadioResponse {
  status: string;
  source: string;
  warning?: string;
  detail?: string;
  fallback?: boolean;
  session_title?: string;
  data: TeamRadioItem[];
}

interface TeamRadioItem {
  session_key?: number | string | null;
  meeting_key?: number | string | null;
  date: string;
  driver_number: number;
  recording_url: string;
}

export interface TeamRadioSectionProps {
  /** Real team-radio captures from the live SignalR feed. */
  liveRadio?: LiveTimingRadioItem[];
  /** Wire status from `/ws/livetiming` (`live`, `no_session`, ...). */
  liveStatus?: string;
  connectionStatus?: 'connecting' | 'connected' | 'lost';
  /** Optional controlled session filter: 'latest' (Live) or 'previous'. */
  sessionMode?: 'latest' | 'previous';
  onSessionModeChange?: (mode: 'latest' | 'previous') => void;
}

export interface DriverRadioInfo {
  name: string;
  team: string;
  code: string;
}

// 2026 Grid Driver Mapping
export const driverRadioData: Record<number, DriverRadioInfo> = {
  1: { name: "Lando Norris", team: "McLaren", code: "NOR" },
  3: { name: "Max Verstappen", team: "Red Bull Racing", code: "VER" },
  4: { name: "Lando Norris", team: "McLaren", code: "NOR" },
  5: { name: "Gabriel Bortoleto", team: "Audi", code: "BOR" },
  6: { name: "Isack Hadjar", team: "Red Bull Racing", code: "HAD" },
  10: { name: "Pierre Gasly", team: "Alpine", code: "GAS" },
  11: { name: "Sergio Perez", team: "Cadillac", code: "PER" },
  12: { name: "Kimi Antonelli", team: "Mercedes", code: "ANT" },
  14: { name: "Fernando Alonso", team: "Aston Martin", code: "ALO" },
  16: { name: "Charles Leclerc", team: "Ferrari", code: "LEC" },
  18: { name: "Lance Stroll", team: "Aston Martin", code: "STR" },
  22: { name: "Yuki Tsunoda", team: "Racing Bulls", code: "TSU" },
  23: { name: "Alexander Albon", team: "Williams", code: "ALB" },
  27: { name: "Nico Hulkenberg", team: "Audi", code: "HUL" },
  30: { name: "Liam Lawson", team: "Racing Bulls", code: "LAW" },
  31: { name: "Esteban Ocon", team: "Haas F1 Team", code: "OCO" },
  37: { name: "Isack Hadjar", team: "Red Bull Racing", code: "HAD" },
  41: { name: "Arvid Lindblad", team: "Racing Bulls", code: "LIN" },
  43: { name: "Franco Colapinto", team: "Alpine", code: "COL" },
  44: { name: "Lewis Hamilton", team: "Ferrari", code: "HAM" },
  55: { name: "Carlos Sainz", team: "Williams", code: "SAI" },
  63: { name: "George Russell", team: "Mercedes", code: "RUS" },
  77: { name: "Valtteri Bottas", team: "Cadillac", code: "BOT" },
  81: { name: "Oscar Piastri", team: "McLaren", code: "PIA" },
  87: { name: "Oliver Bearman", team: "Haas F1 Team", code: "BEA" },
};

// Helper name lookup
export const driverNames: Record<number, string> = Object.fromEntries(
  Object.entries(driverRadioData).map(([num, info]) => [Number(num), info.name])
);

const formatAudioTime = (seconds: number) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
};

// Inline Error State
const InlineErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center p-8 bg-neutral-900/50 border border-red-900/30 rounded-md">
    <AlertCircle className="text-red-500 mb-3" size={32} />
    <h3 className="text-lg font-bold text-white mb-2">Gagal Memuat Radio Tim</h3>
    <p className="text-neutral-400 text-sm mb-4 text-center">{error}</p>
    <button
      onClick={onRetry}
      className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/30 rounded-lg transition-ui"
    >
      <RefreshCw size={16} /> Coba Lagi
    </button>
  </div>
);

// Empty State
const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center p-12 bg-neutral-900/30 border border-neutral-800 rounded-md text-center">
    <Search className="text-neutral-600 mb-4" size={40} />
    <h3 className="text-xl font-bold text-neutral-300 mb-2">{title}</h3>
    <p className="text-neutral-500 text-sm">{description}</p>
  </div>
);

// Paywall / unavailable state. Same copy as the live-timing table so both
// panels explain the missing paid feed instead of looking silently broken.
const UnavailableState = () => (
  <div className="flex flex-col items-center justify-center p-12 bg-amber-950/20 border border-amber-900/30 rounded-md text-center">
    <Radio className="text-amber-400 mb-4" size={40} />
    <h3 className="text-xl font-black uppercase tracking-widest text-amber-300 mb-2">
      {LIVE_TIMING_UNAVAILABLE_TITLE}
    </h3>
    <p className="text-neutral-400 text-sm max-w-md leading-relaxed">
      {LIVE_TIMING_UNAVAILABLE_MESSAGE}
    </p>
  </div>
);

const RadioSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-20 bg-neutral-900/60 border border-neutral-800 rounded-md motion-safe:animate-pulse"></div>
    ))}
  </div>
);

// Custom Audio Player Component with Animated Waveform & Seekable Progress
const AudioPlayer = ({ url, driver, date }: { url: string; driver: number; date: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [hasError, setHasError] = useState(false);
  const [playbackRate, setPlaybackRate] = useState(1);

  const togglePlay = () => {
    if (audioRef.current && !hasError) {
      if (isPlaying) {
        audioRef.current.pause();
        setIsPlaying(false);
      } else {
        audioRef.current.play().then(() => {
          setIsPlaying(true);
        }).catch(err => {
          console.error("Failed to play audio:", err);
          setIsPlaying(false);
          setHasError(true);
        });
      }
    }
  };

  const cyclePlaybackRate = () => {
    const rates = [1, 1.25, 1.5, 2];
    const currentIndex = rates.indexOf(playbackRate);
    const nextRate = rates[(currentIndex + 1) % rates.length];
    setPlaybackRate(nextRate);
    if (audioRef.current) {
      audioRef.current.playbackRate = nextRate;
    }
  };

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const cur = audioRef.current.currentTime;
      const dur = audioRef.current.duration;
      setCurrentTime(cur);
      if (dur && !isNaN(dur)) {
        setDuration(dur);
        setProgress((cur / dur) * 100);
      }
    }
  };

  const handleLoadedMetadata = () => {
    if (audioRef.current && audioRef.current.duration) {
      setDuration(audioRef.current.duration);
      audioRef.current.playbackRate = playbackRate;
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
    setCurrentTime(0);
  };

  const handleProgressSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    if (audioRef.current && duration > 0) {
      const rect = e.currentTarget.getBoundingClientRect();
      const clickX = e.clientX - rect.left;
      const pct = Math.max(0, Math.min(1, clickX / rect.width));
      audioRef.current.currentTime = pct * duration;
      setProgress(pct * 100);
      setCurrentTime(pct * duration);
    }
  };

  const meta = driverRadioData[driver];
  const driverName = meta?.name || driverNames[driver] || `Car #${driver}`;
  const teamColor = meta ? getDriverColor(meta.code, meta.team) : '#EF4444';

  return (
    <div className="flex items-center gap-4 p-4 bg-neutral-900/90 border border-neutral-800 rounded-md hover:border-neutral-700 transition-ui shadow-md group">
      <audio
        ref={audioRef}
        src={url}
        onTimeUpdate={handleTimeUpdate}
        onLoadedMetadata={handleLoadedMetadata}
        onEnded={handleEnded}
        onError={() => setHasError(true)}
      />

      <div className="flex flex-col gap-2">
        <button
          onClick={togglePlay}
          disabled={hasError}
          aria-label={isPlaying ? 'Pause team radio' : 'Play team radio'}
          className={`w-12 h-12 shrink-0 flex items-center justify-center rounded-xl transition-ui shadow-lg ${
            hasError
              ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
              : isPlaying
              ? 'bg-red-600 text-white ring-2 ring-red-500/50 scale-105'
              : 'bg-neutral-800 hover:bg-red-600 text-white'
          }`}
        >
          {hasError ? (
            <AlertCircle size={20} />
          ) : isPlaying ? (
            <Pause size={20} className="fill-current" />
          ) : (
            <Play size={20} className="fill-current ml-0.5" />
          )}
        </button>

        {/* Playback Speed Control */}
        <button
          onClick={cyclePlaybackRate}
          disabled={hasError}
          className="w-12 h-6 shrink-0 flex items-center justify-center rounded-md bg-neutral-800 hover:bg-neutral-700 text-white text-[11px] font-bold font-mono transition-ui disabled:opacity-30"
          title="Cycle playback speed"
        >
          {playbackRate}x
        </button>
      </div>

      <div className="grow min-w-0">
        <div className="flex items-center justify-between gap-2 mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {/* Driver Number Badge with Team Color */}
            <span
              className="font-mono text-xs font-black px-2 py-0.5 rounded-sm border shrink-0"
              style={{
                borderColor: `${teamColor}60`,
                backgroundColor: `${teamColor}18`,
                color: teamColor
              }}
            >
              #{driver} {meta?.code}
            </span>
            <span className="font-bold text-white text-sm truncate">{driverName}</span>
            {meta?.team && (
              <span className="text-[11px] text-neutral-500 hidden sm:inline truncate">
                • {meta.team}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 shrink-0">
            {/* Waveform Equalizer Animation */}
            {isPlaying && (
              <div className="flex items-center gap-1.5 px-1 bg-red-950/40 border border-red-500/30 rounded-sm px-1.5 py-0.5" title="Transmission Active">
                <Radio size={11} className="text-red-400" />
                <div className="flex items-end gap-0.5 h-3">
                  <span className="w-1 rounded-full bg-red-500 motion-safe:animate-pulse h-2" style={{ animationDuration: '450ms' }} />
                  <span className="w-1 rounded-full bg-red-400 motion-safe:animate-pulse h-3" style={{ animationDuration: '300ms' }} />
                  <span className="w-1 rounded-full bg-red-500 motion-safe:animate-pulse h-1.5" style={{ animationDuration: '550ms' }} />
                  <span className="w-1 rounded-full bg-red-400 motion-safe:animate-pulse h-2.5" style={{ animationDuration: '350ms' }} />
                </div>
              </div>
            )}

            <span className="text-xs text-neutral-500 font-mono">
              {new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
            </span>
          </div>
        </div>

        {/* Interactive Seekable Progress Bar */}
        <div
          onClick={handleProgressSeek}
          className="h-2 w-full bg-neutral-800 rounded-full overflow-hidden cursor-pointer relative group/bar"
          title="Click to seek"
        >
          <div
            className="h-full bg-linear-to-r from-red-600 to-red-500 rounded-full transition-ui duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>

        <div className="flex justify-between items-center text-[11px] text-neutral-500 font-mono mt-1">
          <span>{formatAudioTime(currentTime)}</span>
          <span>{duration > 0 ? formatAudioTime(duration) : '--:--'}</span>
        </div>
      </div>
    </div>
  );
};

const RadioList = ({ items }: { items: TeamRadioItem[] }) => (
  <div className="space-y-3 max-h-[500px] overflow-y-auto pr-1 custom-scrollbar">
    <AnimatePresence mode="popLayout">
      {items.map((item) => (
        <motion.div
          key={`${item.driver_number}-${item.date}-${item.recording_url}`}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95 }}
          transition={{ duration: 0.2 }}
        >
          <AudioPlayer
            url={item.recording_url}
            driver={item.driver_number}
            date={item.date}
          />
        </motion.div>
      ))}
    </AnimatePresence>
  </div>
);

export default function TeamRadioSection({
  liveRadio = [],
  liveStatus,
  connectionStatus = 'connected',
  sessionMode,
  onSessionModeChange,
}: TeamRadioSectionProps) {
  const [internalSessionFilter, setInternalSessionFilter] = useState<'latest' | 'previous'>('latest');
  const sessionFilter = sessionMode !== undefined ? sessionMode : internalSessionFilter;

  const handleSessionChange = (mode: 'latest' | 'previous') => {
    if (sessionMode === undefined) {
      setInternalSessionFilter(mode);
    }
    onSessionModeChange?.(mode);
  };

  const [driverFilter, setDriverFilter] = useState<string>('all');

  const isLiveFeed = liveStatus === 'live' && sessionFilter === 'latest';
  const isWireUnavailable = liveStatus === 'unavailable_subscription';
  const hasLiveRadio = liveRadio.length > 0;
  // A lost WebSocket is not a live feed: let the REST fallback try while the
  // page reconnects. "connecting" stays disabled so the panel does not fire a
  // request before the first status message arrives.
  const queryEnabled =
    connectionStatus !== 'connecting' && !isLiveFeed && !isWireUnavailable;

  const { data, isLoading, error, refetch } = useQuery<TeamRadioResponse, Error>({
    queryKey: ['teamRadio', sessionFilter],
    queryFn: async () => {
      const response = await fetch(
        `${API_URL}/api/team_radio?session_key=${sessionFilter}`,
      );
      if (!response.ok) throw new Error("Network response was not ok");
      return response.json();
    },
    enabled: queryEnabled,
    refetchInterval: queryEnabled && sessionFilter === 'latest' ? 15000 : false,
  });

  const apiRadio = data?.data ?? [];
  const isCachedFallback = data?.source === 'signalr_cache' || data?.fallback === true;
  // Prefer the free SignalR captures while a session is live. On the Previous
  // tab they are a safety net: use them when OpenF1 failed, is paywalled, or
  // explicitly returned the backend's own SignalR cache.
  const useLiveFallback =
    !isLiveFeed &&
    hasLiveRadio &&
    (Boolean(error) || isWireUnavailable || isCachedFallback);
  const sourceData: TeamRadioItem[] = isLiveFeed
    ? liveRadio
    : apiRadio.length > 0
      ? apiRadio
      : useLiveFallback
        ? liveRadio
        : [];

  const isPaywalled =
    !isLiveFeed &&
    !hasLiveRadio &&
    (isWireUnavailable || data?.status === 'unavailable_subscription');

  // Filter local data strictly (no fake sentiment, only real drivers). The
  // live feed is authoritative, so show every capture it sends; historical
  // REST rows and SignalR cache rows keep only known 2026 grid numbers.
  const filteredData = sourceData.filter(item => {
    const matchesDriver =
      driverFilter === 'all' || String(item.driver_number) === driverFilter;
    const knownDriver = !!driverNames[item.driver_number];
    return (
      matchesDriver &&
      (isLiveFeed || isCachedFallback || useLiveFallback || knownDriver)
    );
  });

  // Only offer drivers that actually have a clip in this session. The old
  // static list showed all 26 grid entries even for a single-driver session.
  const availableDriverNumbers = useMemo(() => {
    const numbers = new Set<number>();
    sourceData.forEach(item => {
      const num = Number(item.driver_number);
      if (Number.isFinite(num) && driverRadioData[num]) {
        numbers.add(num);
      }
    });
    return Array.from(numbers).sort((a, b) => a - b);
  }, [sourceData]);

  useEffect(() => {
    if (
      driverFilter !== 'all' &&
      !availableDriverNumbers.includes(Number(driverFilter))
    ) {
      setDriverFilter('all');
    }
  }, [availableDriverNumbers, driverFilter]);

  const friendlyError =
    error?.message === 'Failed to fetch'
      ? 'Relay radio tidak dapat dijangkau. Periksa koneksi lalu coba lagi.'
      : error?.message || 'Gagal menghubungi OpenF1 Audio Relay';

  let content: React.ReactNode;
  if (isPaywalled) {
    content = <UnavailableState />;
  } else if (isLiveFeed) {
    content = filteredData.length === 0 ? (
      <EmptyState
        title="Menunggu Radio Tim"
        description="Sesi sedang live. Siaran radio akan muncul di sini saat tim berbicara di radio."
      />
    ) : (
      <RadioList items={filteredData} />
    );
  } else if (connectionStatus === 'connecting' || isLoading) {
    content = <RadioSkeleton />;
  } else if (error && !hasLiveRadio) {
    content = (
      <InlineErrorState
        error={friendlyError}
        onRetry={() => refetch()}
      />
    );
  } else if (filteredData.length === 0) {
    content = (
      <EmptyState
        title="Tidak Ada Siaran Radio Ditemukan"
        description="API OpenF1 tidak mengembalikan data untuk sesi ini. Coba ubah filter atau beralih ke sesi sebelumnya."
      />
    );
  } else {
    content = <RadioList items={filteredData} />;
  }

  return (
    <section className="w-full bg-neutral-950 p-6 rounded-lg border border-neutral-800 shadow-xl">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black italic uppercase flex items-center gap-2 text-white">
            <Volume2 className="text-red-500" /> Team <span className="text-red-500">Radio</span>
            {isLiveFeed && (
              <span className="ml-1 px-2 py-0.5 text-[10px] font-black tracking-widest bg-red-600/20 border border-red-500/40 text-red-400 rounded-xs uppercase motion-safe:animate-pulse">
                Live
              </span>
            )}
          </h2>
          <p className="text-sm text-neutral-400">
            {isLiveFeed
              ? 'Live radio from the official timing feed'
              : isCachedFallback
                ? 'Latest SignalR captures (OpenF1 fallback)'
                : 'Live communication from the pit wall'}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {/* Session Toggle */}
          <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-1">
            <button
              onClick={() => handleSessionChange('latest')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-ui ${
                sessionFilter === 'latest'
                  ? 'bg-red-600 text-white shadow-md'
                  : 'text-neutral-500 hover:text-white'
              }`}
            >
              Live Race
            </button>
            <button
              onClick={() => handleSessionChange('previous')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-ui ${
                sessionFilter === 'previous'
                  ? 'bg-neutral-700 text-white shadow-md'
                  : 'text-neutral-500 hover:text-white'
              }`}
            >
              Previous
            </button>
          </div>

          <select
            aria-label="Filter radio by driver"
            value={driverFilter}
            onChange={(e) => setDriverFilter(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 text-sm rounded-lg px-3 py-2 text-white focus:outline-hidden focus:border-red-500 font-medium"
          >
            <option value="all">All Drivers ({availableDriverNumbers.length})</option>
            {availableDriverNumbers.map((num) => {
              const info = driverRadioData[num];
              return (
                <option key={num} value={num}>
                  #{num} {info.name} ({info.code})
                </option>
              );
            })}
          </select>
        </div>
      </div>

      <div>
        {(isCachedFallback || (error && hasLiveRadio)) && (
          <div className="mb-3 rounded-md border border-amber-500/20 bg-amber-500/5 px-3 py-2 text-[11px] font-bold uppercase tracking-wider text-amber-200/80">
            {isCachedFallback
              ? 'SignalR cache — OpenF1 sedang tidak tersedia.'
              : 'Relay radio tidak dapat dijangkau — menampilkan tangkapan SignalR terakhir.'}
          </div>
        )}
        {content}
      </div>
    </section>
  );
}
