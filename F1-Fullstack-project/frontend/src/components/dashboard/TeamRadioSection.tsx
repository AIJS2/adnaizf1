import React, { useState, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { Play, Pause, AlertCircle, RefreshCw, Volume2, Search } from 'lucide-react';
import { API_URL } from '../../config';

// Custom types
interface TeamRadioResponse {
  status: string;
  source: string;
  warning?: string;
  data: TeamRadioItem[];
}

interface TeamRadioItem {
  session_key: number;
  meeting_key: number;
  date: string;
  driver_number: number;
  recording_url: string;
}

// 20 Active 2026 Drivers
const driverNames: Record<number, string> = {
  1: "Max Verstappen", 4: "Lando Norris", 
  5: "Gabriel Bortoleto", 10: "Pierre Gasly",
  12: "Kimi Antonelli", 14: "Fernando Alonso", 16: "Charles Leclerc",
  18: "Lance Stroll", 22: "Yuki Tsunoda", 23: "Alexander Albon", 
  27: "Nico Hulkenberg",
  30: "Liam Lawson", 31: "Esteban Ocon", 37: "Isack Hadjar", 43: "Franco Colapinto",
  44: "Lewis Hamilton", 55: "Carlos Sainz", 63: "George Russell",
  81: "Oscar Piastri", 87: "Oliver Bearman"
};

// Inline Error State
const InlineErrorState = ({ error, onRetry }: { error: string; onRetry: () => void }) => (
  <div className="flex flex-col items-center justify-center p-8 bg-neutral-900/50 border border-red-900/30 rounded-xl">
    <AlertCircle className="text-red-500 mb-3" size={32} />
    <h3 className="text-lg font-bold text-white mb-2">Gagal Memuat Radio Tim</h3>
    <p className="text-neutral-400 text-sm mb-4 text-center">{error}</p>
    <button 
      onClick={onRetry}
      className="flex items-center gap-2 px-4 py-2 bg-red-600/20 text-red-400 hover:bg-red-600 hover:text-white border border-red-500/30 rounded-lg transition-all"
    >
      <RefreshCw size={16} /> Coba Lagi
    </button>
  </div>
);

// Empty State
const EmptyState = ({ title, description }: { title: string; description: string }) => (
  <div className="flex flex-col items-center justify-center p-12 bg-neutral-900/30 border border-neutral-800 rounded-xl text-center">
    <Search className="text-neutral-600 mb-4" size={40} />
    <h3 className="text-xl font-bold text-neutral-300 mb-2">{title}</h3>
    <p className="text-neutral-500">{description}</p>
  </div>
);

// Skeleton Loading
const RadioSkeleton = () => (
  <div className="space-y-3">
    {[1, 2, 3].map(i => (
      <div key={i} className="h-20 bg-neutral-900/60 border border-neutral-800 rounded-xl animate-pulse"></div>
    ))}
  </div>
);

// Custom Audio Player Component
const AudioPlayer = ({ url, driver, date }: { url: string; driver: number; date: string }) => {
  const audioRef = useRef<HTMLAudioElement>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [hasError, setHasError] = useState(false);

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

  const handleTimeUpdate = () => {
    if (audioRef.current) {
      const prog = (audioRef.current.currentTime / audioRef.current.duration) * 100;
      setProgress(prog || 0);
    }
  };

  const handleEnded = () => {
    setIsPlaying(false);
    setProgress(0);
  };

  const driverName = driverNames[driver];

  return (
    <div className="flex items-center gap-4 p-4 bg-neutral-900 border border-neutral-800 rounded-xl hover:border-neutral-700 transition-all">
      <audio 
        ref={audioRef} 
        src={url} 
        onTimeUpdate={handleTimeUpdate}
        onEnded={handleEnded}
        onError={() => setHasError(true)}
      />
      
      <button 
        onClick={togglePlay}
        disabled={hasError}
        className={`w-12 h-12 flex-shrink-0 flex items-center justify-center rounded-full transition-colors ${hasError ? 'bg-neutral-800 text-neutral-600 cursor-not-allowed' : 'bg-red-600 hover:bg-red-500 text-white'}`}
      >
        {hasError ? <AlertCircle size={20} /> : isPlaying ? <Pause size={20} className="fill-current" /> : <Play size={20} className="fill-current ml-1" />}
      </button>

      <div className="flex-grow min-w-0">
        <div className="flex items-center justify-between mb-1.5">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white">{driverName}</span>
          </div>
          <span className="text-xs text-neutral-500 font-mono">
            {new Date(date).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
          </span>
        </div>
        
        {/* Progress Bar */}
        <div className="h-1.5 w-full bg-neutral-800 rounded-full overflow-hidden">
          <div 
            className="h-full bg-red-600 transition-all duration-100 ease-linear"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default function TeamRadioSection() {
  const [sessionFilter, setSessionFilter] = useState<'latest' | 'previous'>('latest');
  const [driverFilter, setDriverFilter] = useState<string>('all');

  const { data, isLoading, error, refetch } = useQuery<TeamRadioResponse, Error>({
    queryKey: ['teamRadio', driverFilter, sessionFilter],
    queryFn: async () => {
      let url = `${API_URL}/api/team_radio?session_key=${sessionFilter}`;
      if (driverFilter !== 'all') {
        url += `&driver_number=${driverFilter}`;
      }
      const response = await fetch(url);
      if (!response.ok) throw new Error("Network response was not ok");
      return response.json();
    },
    refetchInterval: sessionFilter === 'latest' ? 15000 : false,
  });

  // Filter local data strictly (no fake sentiment, only real drivers)
  const filteredData = data?.data?.filter(item => {
    // strict driver filtering: must be in the 20 active 2026 drivers
    return !!driverNames[item.driver_number];
  });

  return (
    <section className="w-full bg-neutral-950 p-6 rounded-2xl border border-neutral-800">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 mb-6">
        <div>
          <h2 className="text-2xl font-black italic uppercase flex items-center gap-2">
            <Volume2 className="text-red-500" /> Team <span className="text-red-500">Radio</span>
          </h2>
          <p className="text-sm text-neutral-400">Live communication from the pit wall</p>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          
          {/* Session Toggle */}
          <div className="flex bg-neutral-900 border border-neutral-800 rounded-lg p-1">
            <button
              onClick={() => setSessionFilter('latest')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${sessionFilter === 'latest' ? 'bg-red-600 text-white shadow-md' : 'text-neutral-500 hover:text-white'}`}
            >
              Live Race
            </button>
            <button
              onClick={() => setSessionFilter('previous')}
              className={`px-3 py-1.5 text-xs font-bold rounded-md transition-all ${sessionFilter === 'previous' ? 'bg-neutral-700 text-white shadow-md' : 'text-neutral-500 hover:text-white'}`}
            >
              Previous
            </button>
          </div>

          <select 
            value={driverFilter}
            onChange={(e) => setDriverFilter(e.target.value)}
            className="bg-neutral-900 border border-neutral-800 text-sm rounded-lg px-3 py-2 text-white outline-none focus:border-red-500"
          >
            <option value="all">All Drivers</option>
            {Object.entries(driverNames).map(([num, name]) => (
              <option key={num} value={num}>{name} ({num})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Content Area */}
      <div className="min-h-[200px]">
        {error ? (
          <InlineErrorState error={error.message} onRetry={refetch} />
        ) : isLoading && !data ? (
          <RadioSkeleton />
        ) : !filteredData || filteredData.length === 0 ? (
          <EmptyState 
            title="Tidak ada data radio otentik untuk sesi ini" 
            description="API OpenF1 tidak mengembalikan data. Coba sesuaikan filter driver atau tunggu beberapa saat jika sesi sedang berlangsung."
          />
        ) : (
          <div className="space-y-3">
            <AnimatePresence mode="popLayout">
              {filteredData.map((item) => (
                <motion.div
                  key={`${item.driver_number}-${item.date}`}
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
        )}
      </div>
    </section>
  );
}
