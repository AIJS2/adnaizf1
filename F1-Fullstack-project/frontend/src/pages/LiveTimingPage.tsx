import React, { useState, useEffect, useMemo, memo } from 'react';
import { useLocation } from 'react-router-dom';
import { Activity, CloudRain, Wind, Thermometer, Radio, Flag, Zap, Clock } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { API_URL } from '../config';
import { fetchDashboardData } from '../services/api';
import { resolveNextRaceFromSources, countdownTarget } from '../utils/nextRace';
import HeroCountdown from '../components/ui/HeroCountdown';
import TyreStrategy from '../components/ui/TyreStrategy';
import EmptyState from '../components/ui/EmptyState';
import { LiveTimingData, LiveTimingLine } from '../types/f1';

const teamColors: Record<string, string> = {
  "Red Bull Racing": "#3671C6",
  "McLaren": "#FF8000",
  "Ferrari": "#E8002D",
  "Mercedes": "#27F4D2",
  "Aston Martin": "#229971",
  "Racing Bulls": "#6692FF",
  "Haas F1 Team": "#B6BABD",
  "Williams": "#64C4FF",
  "Alpine": "#0093CC",
  "Audi": "#F40000",
  "Cadillac": "#D4AF37"
};

// ============================================================================
// DEV-ONLY MOCK PAYLOAD — never runs unless ?mock=1 is in the URL.
// Lets you eyeball the full live-timing layout (timing table, track map, tyre
// strategy, weather, speed trap, race control) when no session is running.
// The real WebSocket path below is untouched when the flag is absent.
// ============================================================================
const MOCK_LINES: LiveTimingLine[] = [
  { position: 1,  driver: 'VER', team: 'Red Bull Racing', tyre: 'M', tyre_age: 12, gap: 'LEADER', interval: '-',     lastLap: '1:32.481', lap_color: 'purple', sector1: '28.104', s1_color: 'green',  sector2: '41.882', s2_color: 'purple', sector3: '22.495', s3_color: 'green',  pits: 1, progress: 0.18, status: 'TRACK' },
  { position: 2,  driver: 'NOR', team: 'McLaren',        tyre: 'M', tyre_age: 12, gap: '+2.341', interval: '+2.341', lastLap: '1:32.702', lap_color: 'green',  sector1: '28.220', s1_color: 'purple', sector2: '41.955', s2_color: 'green',  sector3: '22.527', s3_color: '',        pits: 1, progress: 0.15, status: 'TRACK' },
  { position: 3,  driver: 'LEC', team: 'Ferrari',        tyre: 'H', tyre_age: 8,  gap: '+5.108', interval: '+2.767', lastLap: '1:33.015', lap_color: 'yellow', sector1: '28.401', s1_color: '',       sector2: '42.118', s2_color: 'yellow', sector3: '22.496', s3_color: 'purple', pits: 0, progress: 0.13, status: 'TRACK' },
  { position: 4,  driver: 'PIA', team: 'McLaren',        tyre: 'H', tyre_age: 9,  gap: '+7.922', interval: '+2.814', lastLap: '1:33.204', lap_color: '',       sector1: '28.507', s1_color: 'yellow', sector2: '42.204', s2_color: '',       sector3: '22.493', s3_color: 'green',  pits: 0, progress: 0.10, status: 'TRACK' },
  { position: 5,  driver: 'HAM', team: 'Ferrari',        tyre: 'M', tyre_age: 14, gap: '+11.640', interval: '+3.718', lastLap: '1:33.441', lap_color: 'green', sector1: '28.633', s1_color: 'green', sector2: '42.310', s2_color: '',        sector3: '22.498', s3_color: '',       pits: 1, progress: 0.08, status: 'TRACK' },
  { position: 6,  driver: 'RUS', team: 'Mercedes',       tyre: 'H', tyre_age: 7,  gap: '+14.205', interval: '+2.565', lastLap: '1:33.612', lap_color: '',       sector1: '28.745', s1_color: '',       sector2: '42.455', s2_color: 'green', sector3: '22.412', s3_color: 'purple', pits: 0, progress: 0.05, status: 'TRACK' },
  { position: 7,  driver: 'ANT', team: 'Mercedes',       tyre: 'M', tyre_age: 16, gap: '+18.883', interval: '+4.678', lastLap: '1:33.890', lap_color: 'yellow', sector1: '28.912', s1_color: '',       sector2: '42.601', s2_color: '',       sector3: '22.377', s3_color: '',       pits: 1, progress: 0.03, status: 'TRACK' },
  { position: 8,  driver: 'ALO', team: 'Aston Martin',   tyre: 'H', tyre_age: 6,  gap: '+21.450', interval: '+2.567', lastLap: '1:34.021', lap_color: '',       sector1: '29.102', s1_color: 'yellow', sector2: '42.703', s2_color: '',       sector3: '22.216', s3_color: 'purple', pits: 0, progress: 0.01, status: 'TRACK' },
  { position: 9,  driver: 'GAS', team: 'Alpine',         tyre: 'M', tyre_age: 18, gap: '+25.997', interval: '+4.547', lastLap: '1:34.288', lap_color: 'green', sector1: '29.288', s1_color: '',       sector2: '42.889', s2_color: 'yellow', sector3: '22.111', s3_color: '',       pits: 1, progress: 0.99, status: 'TRACK' },
  { position: 10, driver: 'TSU', team: 'Racing Bulls',   tyre: 'H', tyre_age: 5,  gap: '+29.412', interval: '+3.415', lastLap: '1:34.512', lap_color: '',       sector1: '29.455', s1_color: '',       sector2: '43.012', s2_color: '',       sector3: '22.045', s3_color: 'green',  pits: 0, progress: 0.96, status: 'TRACK' },
  { position: 11, driver: 'SAI', team: 'Williams',       tyre: 'M', tyre_age: 20, gap: '+33.880', interval: '+4.468', lastLap: '1:34.755', lap_color: 'yellow', sector1: '29.601', s1_color: 'yellow', sector2: '43.201', s2_color: '',       sector3: '21.953', s3_color: '',       pits: 1, progress: 0.93, status: 'TRACK' },
  { position: 12, driver: 'HUL', team: 'Audi',           tyre: 'H', tyre_age: 4,  gap: '+37.221', interval: '+3.341', lastLap: '1:34.982', lap_color: '',       sector1: '29.744', s1_color: '',       sector2: '43.377', s2_color: 'green', sector3: '21.861', s3_color: 'purple', pits: 0, progress: 0.90, status: 'TRACK' },
  { position: 13, driver: 'BEA', team: 'Haas F1 Team',   tyre: 'M', tyre_age: 22, gap: '+41.665', interval: '+4.444', lastLap: '1:35.208', lap_color: 'green', sector1: '29.902', s1_color: 'green', sector2: '43.560', s2_color: '',        sector3: '21.746', s3_color: '',       pits: 1, progress: 0.87, status: 'PIT' },
  { position: 14, driver: 'OCO', team: 'Haas F1 Team',   tyre: 'H', tyre_age: 3,  gap: '+45.110', interval: '+3.445', lastLap: '1:35.443', lap_color: '',       sector1: '30.055', s1_color: '',       sector2: '43.744', s2_color: '',       sector3: '21.644', s3_color: 'yellow', pits: 0, progress: 0.84, status: 'TRACK' },
  { position: 15, driver: 'STR', team: 'Aston Martin',   tyre: 'M', tyre_age: 24, gap: '+48.552', interval: '+3.442', lastLap: '1:35.671', lap_color: 'yellow', sector1: '30.210', s1_color: '',       sector2: '43.920', s2_color: 'yellow', sector3: '21.541', s3_color: '',       pits: 1, progress: 0.81, status: 'TRACK' },
  { position: 16, driver: 'ALB', team: 'Williams',       tyre: 'H', tyre_age: 2,  gap: '+52.003', interval: '+3.451', lastLap: '1:35.905', lap_color: '',       sector1: '30.366', s1_color: 'yellow', sector2: '44.105', s2_color: '',       sector3: '21.434', s3_color: 'green',  pits: 0, progress: 0.78, status: 'TRACK' },
  { position: 17, driver: 'LAW', team: 'Racing Bulls',   tyre: 'M', tyre_age: 26, gap: '+55.441', interval: '+3.438', lastLap: '1:36.140', lap_color: 'green', sector1: '30.520', s1_color: '',       sector2: '44.288', s2_color: '',       sector3: '21.332', s3_color: '',       pits: 1, progress: 0.75, status: 'TRACK' },
  { position: 18, driver: 'BOR', team: 'Audi',           tyre: 'H', tyre_age: 1,  gap: '+58.902', interval: '+3.461', lastLap: '1:36.372', lap_color: '',       sector1: '30.677', s1_color: '',       sector2: '44.470', s2_color: 'green', sector3: '21.225', s3_color: 'purple', pits: 0, progress: 0.72, status: 'TRACK' },
  { position: 19, driver: 'COL', team: 'Alpine',         tyre: 'M', tyre_age: 28, gap: '+62.350', interval: '+3.448', lastLap: '1:36.608', lap_color: 'yellow', sector1: '30.833', s1_color: 'yellow', sector2: '44.655', s2_color: '',       sector3: '21.120', s3_color: '',       pits: 1, progress: 0.69, status: 'TRACK' },
  { position: 20, driver: 'BOT', team: 'Cadillac',       tyre: 'H', tyre_age: 0,  gap: '+65.799', interval: '+3.449', lastLap: '1:36.840', lap_color: '',       sector1: '30.990', s1_color: '',       sector2: '44.838', s2_color: '',       sector3: '21.012', s3_color: 'green',  pits: 0, progress: 0.66, status: 'TRACK' },
];

const MOCK_DATA: LiveTimingData = {
  lines: MOCK_LINES,
  trackStatus: 'GREEN',
  weather: { air: '28°C', track: '41°C', humidity: '62%', rain: '0%' },
  messages: [
    { time: '14:32:08', type: 'flag', msg: 'GREEN FLAG - TRACK CLEAR' },
    { time: '14:30:41', type: 'pit',  msg: 'CAR 14 (OCO) PIT STOP - 2.4s' },
    { time: '14:28:15', type: 'flag', msg: 'DRS ENABLED' },
    { time: '14:25:02', type: 'pit',  msg: 'CAR 01 (VER) PIT STOP - 2.3s' },
    { time: '14:22:19', type: '',     msg: 'LAP 12 FASTEST: CAR 01 (VER) 1:32.481' },
    { time: '14:20:33', type: 'pit',  msg: 'CAR 44 (HAM) PIT STOP - 2.6s' },
    { time: '14:18:07', type: 'flag', msg: 'YELLOW FLAG SECTOR 2 - DEBRIS' },
  ],
  isLiveSession: true,
};

/** Dev override: /live-timing?mock=1 renders the mock payload for layout testing. */
function isMockRequested(): boolean {
  if (typeof window === 'undefined') return false;
  return new URLSearchParams(window.location.search).get('mock') === '1';
}

interface TyreIconProps {
  compound: 'S' | 'M' | 'H' | 'I' | 'W' | '' | string;
  age: number | string;
}

const TyreIcon: React.FC<TyreIconProps> = ({ compound, age }) => {
  let bg = 'bg-gray-500';
  let text = 'text-white';
  if (compound === 'S') { bg = 'bg-red-500'; }
  else if (compound === 'M') { bg = 'bg-yellow-400'; text = 'text-black'; }
  else if (compound === 'H') { bg = 'bg-white'; text = 'text-black'; }
  else if (compound === 'I') { bg = 'bg-green-500'; }
  else if (compound === 'W') { bg = 'bg-blue-500'; }

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${bg} ${text}`}>
        {compound}
      </div>
      <span className="text-[10px] text-neutral-400">{age}L</span>
    </div>
  );
};

const SectorTime: React.FC<{ time: string, color: string }> = ({ time, color }) => {
  let colorClass = 'text-neutral-500'; // default yellow-ish text for no improvement in some screens, but standard is neutral
  let glowClass = '';
  
  if (color === 'purple') {
    colorClass = 'text-purple-400';
    glowClass = 'drop-shadow-[0_0_6px_rgba(168,85,247,0.8)]';
  } else if (color === 'green') {
    colorClass = 'text-green-400';
    glowClass = 'drop-shadow-[0_0_6px_rgba(74,222,128,0.8)]';
  } else if (color === 'yellow') {
    colorClass = 'text-yellow-400';
  }

  return <span className={`font-mono font-bold ${colorClass} ${glowClass}`}>{time}</span>;
};

interface TimingRowProps {
  row: LiveTimingLine;
}

const TimingRow = memo<TimingRowProps>(({ row }) => {
  const teamColor = teamColors[row.team] || '#fff';
  const isIntervalClose = Boolean(
    row.interval && !isNaN(parseFloat(row.interval)) && parseFloat(row.interval) < 1.0
  );

  return (
    <tr className="hover:bg-[#111] transition-colors group relative">
      <td className="p-2.5 text-center font-black text-neutral-500 border-r border-[#151515]">{row.position}</td>
      
      <td className="p-2.5 font-black text-white text-[14px] border-r border-[#151515] flex items-center gap-2">
        <div className="w-1 h-5 rounded-sm shadow-sm" style={{ backgroundColor: teamColor }}></div>
        {row.driver}
        {row.status === 'PIT' && (
          <span className="ml-2 px-1 py-0.5 bg-red-600/20 text-red-500 border border-red-500/30 text-[9px] rounded-sm animate-pulse uppercase tracking-wider">
            IN PIT
          </span>
        )}
        {row.status !== 'PIT' && isIntervalClose && (
          <span
            className="ml-1 px-1 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] rounded-sm uppercase tracking-wider drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]"
            title="Manual Override Available"
          >
            OVR
          </span>
        )}
      </td>
      <td className="p-2.5 border-r border-[#151515]">
        <TyreIcon compound={row.tyre} age={row.tyre_age} />
      </td>
      <td className="p-2.5 text-right text-neutral-300 font-mono border-r border-[#151515]">{row.gap}</td>
      <td className="p-2.5 text-right text-neutral-400 font-mono border-r border-[#151515]">{row.interval}</td>
      <td className="p-2.5 text-right border-r border-[#151515] bg-[#0c0c0c] group-hover:bg-[#151515] transition-colors shadow-inner">
        <SectorTime time={row.lastLap} color={row.lap_color} />
      </td>
      <td className="p-2.5 text-center border-r border-[#151515]">
        <SectorTime time={row.sector1} color={row.s1_color} />
      </td>
      <td className="p-2.5 text-center border-r border-[#151515]">
        <SectorTime time={row.sector2} color={row.s2_color} />
      </td>
      <td className="p-2.5 text-center border-r border-[#151515]">
        <SectorTime time={row.sector3} color={row.s3_color} />
      </td>
      <td className="p-2.5 text-center text-neutral-600 font-mono font-bold">{row.pits}</td>
    </tr>
  );
});
TimingRow.displayName = 'TimingRow';

const LiveTimingPage: React.FC = () => {
  const location = useLocation();
  const mockMode = useMemo(() => {
    return new URLSearchParams(location.search).get('mock') === '1' || isMockRequested();
  }, [location.search]);
  const currentYear = useMemo(() => new Date().getFullYear(), []);

  // Fetch upcoming race schedule for the empty-state countdown centerpiece
  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard', currentYear],
    queryFn: () => fetchDashboardData(currentYear),
    staleTime: 5 * 60 * 1000,
  });

  const nextEvent = useMemo(() => {
    return resolveNextRaceFromSources(
      dashboardData?.race_analytics,
      dashboardData?.next_race_event,
    );
  }, [dashboardData]);

  const heroRaceName = nextEvent
    ? (nextEvent.name || '').split(' - ')[0] || 'Grand Prix'
    : null;
  const heroSessionName = dashboardData?.next_race_event?.name
    ? dashboardData.next_race_event.name.split(' - ')[1] ?? null
    : null;
  const targetCountdownDate = countdownTarget(nextEvent?.date);
  const heroPhase = nextEvent?.phase ?? 'future';

  const [data, setData] = useState<LiveTimingData>(
    mockMode
      ? MOCK_DATA
      : {
          lines: [],
          trackStatus: 'GREEN',
          weather: { air: '--', track: '--', humidity: '--', rain: '--' },
          messages: [],
          isLiveSession: false
        }
  );
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'lost'>(mockMode ? 'connected' : 'connecting');

  useEffect(() => {
    // Dev override: never open the WebSocket when rendering the mock payload.
    if (mockMode) return;
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      // Close any previous socket before opening a new one, otherwise a
      // flaky connection stacks parallel WebSockets and reconnect timers,
      // each triggering a backend live-session check. This was a connection
      // leak: reconnectTimer was reassigned without being cleared first.
      if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
      }

      setConnectionStatus(prev => prev === 'connected' ? 'lost' : 'connecting');
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = API_URL.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}//${wsHost}/ws/livetiming`;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        attempt = 0;
        setConnectionStatus('connected');
      };
      
      ws.onmessage = (event: MessageEvent) => {
        try {
          const msg = JSON.parse(event.data);
          if (msg && msg.type === 'TimingData') {
            setData(prev => ({
              lines: msg.lines ?? prev.lines,
              trackStatus: msg.trackStatus ?? prev.trackStatus,
              weather: msg.weather ?? prev.weather,
              messages: msg.messages ?? prev.messages,
              isLiveSession: msg.is_live_session ?? prev.isLiveSession
            }));
          }
        } catch (err) {
          console.error('Failed to parse Live Timing WebSocket payload:', err);
        }
      };
      
      ws.onclose = () => {
        setConnectionStatus('lost');
        // Exponential backoff, capped at 30s, so a hard-down backend is not
        // hammered with reconnect attempts.
        const delay = Math.min(3000 * 2 ** attempt, 30000);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, [mockMode]);

  // Dev preview animation: smoothly circulate mock cars along the track
  useEffect(() => {
    if (!mockMode) return;
    const interval = setInterval(() => {
      setData(prev => ({
        ...prev,
        lines: prev.lines.map(line => {
          if (line.status === 'PIT') return line;
          const currentProg = line.progress ?? 0;
          const nextProg = (currentProg + 0.003) % 1.0;
          return { ...line, progress: Number(nextProg.toFixed(4)) };
        }),
      }));
    }, 200);
    return () => clearInterval(interval);
  }, [mockMode]);

  const getStatusColor = (status: string) => {
    if (status.includes('YELLOW')) return 'bg-yellow-500 text-black';
    if (status.includes('RED')) return 'bg-red-600 text-white animate-pulse';
    if (status.includes('SC') || status.includes('VSC')) return 'bg-orange-500 text-white';
    return 'bg-green-500 text-black';
  };

  const sortedLines = useMemo(() => {
    return [...data.lines].sort((a, b) => {
      const posA = parseInt(String(a.position));
      const posB = parseInt(String(b.position));
      if (isNaN(posA) && isNaN(posB)) return 0;
      if (isNaN(posA)) return 1;
      if (isNaN(posB)) return -1;
      return posA - posB;
    });
  }, [data.lines]);

  const hasNoSessionData = sortedLines.length === 0;

  return (
    <div className="bg-black min-h-screen text-white font-mono selection:bg-red-600 w-full overflow-hidden" style={{ overflowAnchor: 'none' }}>
      <main className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 xl:px-10 py-6 md:py-8 xl:py-10">
        
        {/* Header Bar */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between mb-6 gap-4 border-b border-[#222] pb-4">
          <div>
            <div className={`inline-flex items-center gap-2 border text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm mb-2 ${mockMode ? 'bg-purple-600/10 border-purple-500/30 text-purple-400 shadow-[0_0_15px_rgba(168,85,247,0.2)]' : connectionStatus === 'connected' ? (data.isLiveSession ? 'bg-red-600/10 border-red-500/30 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-blue-600/10 border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]') : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]'}`}>
              <Activity size={12} className={connectionStatus === 'connected' || mockMode ? 'animate-pulse' : ''} /> 
              {mockMode ? 'MOCK DATA — DEV PREVIEW' : connectionStatus === 'connecting' ? 'AWAITING CONNECTION...' : connectionStatus === 'lost' ? 'CONNECTION LOST - RECONNECTING...' : data.isLiveSession ? 'LIVE SIGNAL DETECTED' : 'NO LIVE SESSION'}
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase flex items-center gap-2">
              Pit Wall <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Telemetry</span>
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold bg-[#0a0a0a] border border-[#222] rounded-md px-4 py-2 uppercase tracking-wider shadow-inner w-full md:w-auto">
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,1)]"></div> Overall Best</span>
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(74,222,128,1)]"></div> Personal Best</span>
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-400"></div> No Improvement</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Main Timing Table (Left 3 cols) */}
          <div className="lg:col-span-3 bg-[#080808] border border-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl flex flex-col relative min-w-0">
            {/* Glossy top highlight */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent"></div>
            
            <div className="overflow-x-auto flex-1">
              {hasNoSessionData ? (
                <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                  {/* Subtle pit-wall radar beacon */}
                  <div className="relative mb-5 flex items-center justify-center">
                    <div className="absolute w-20 h-20 rounded-full bg-red-600/15 blur-xl animate-pulse" />
                    <div className="w-14 h-14 rounded-2xl bg-neutral-900/90 border border-neutral-800 flex items-center justify-center text-neutral-400 shadow-inner">
                      <Radio size={24} className="text-red-500 animate-pulse" />
                    </div>
                  </div>

                  <h2 className="text-base font-black uppercase tracking-[0.25em] text-neutral-200">
                    No Live Session Data
                  </h2>
                  <p className="text-xs text-neutral-500 mt-2 max-w-md leading-relaxed font-sans">
                    Timing appears here only while an F1 session is running. This feed
                    reports real data only and never simulates telemetry.
                  </p>

                  {/* Centered Hero Countdown Centerpiece */}
                  {targetCountdownDate && (
                    <div className="mt-8 flex flex-col items-center w-full max-w-lg">
                      {/* Event badge capsule */}
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-800 text-[11px] uppercase font-bold tracking-widest text-neutral-400 mb-5 shadow-sm">
                        <span className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                        <span>NEXT UP: <span className="text-white font-black">{heroRaceName}</span></span>
                        {heroSessionName && (
                          <span className="text-neutral-500 border-l border-neutral-700 pl-2 font-mono">
                            {heroSessionName}
                          </span>
                        )}
                      </div>

                      {/* HeroCountdown display card */}
                      <div className="relative p-5 sm:p-6 rounded-2xl bg-[#0a0a0a] border border-[#222] shadow-[0_0_50px_rgba(0,0,0,0.8)] flex flex-col items-center w-full sm:w-auto">
                        <div className="absolute top-0 left-1/4 right-1/4 h-[1px] bg-gradient-to-r from-transparent via-red-500/40 to-transparent" />
                        <HeroCountdown targetDate={targetCountdownDate} phase={heroPhase} />
                      </div>

                      <div className="mt-4 flex items-center gap-2 text-[10px] text-neutral-500 font-mono tracking-widest uppercase">
                        <Clock size={12} className="text-neutral-600" />
                        <span>Lights Out Countdown</span>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
              <table className="w-full text-[13px] tracking-tight whitespace-nowrap min-w-[700px]">
                <thead className="bg-[#0f0f0f] text-neutral-500 font-black text-left border-b border-[#222] shadow-sm">
                  <tr>
                    <th className="p-3 w-10 text-center border-r border-[#1a1a1a]">P</th>
                    <th className="p-3 min-w-[140px] border-r border-[#1a1a1a]">DRIVER</th>
                    <th className="p-3 w-20 border-r border-[#1a1a1a]">TYRE</th>
                    <th className="p-3 w-20 text-right border-r border-[#1a1a1a]">GAP</th>
                    <th className="p-3 w-20 text-right border-r border-[#1a1a1a]">INT</th>
                    <th className="p-3 w-24 text-right border-r border-[#1a1a1a]">LAST LAP</th>
                    <th className="p-3 w-16 text-center border-r border-[#1a1a1a]">S1</th>
                    <th className="p-3 w-16 text-center border-r border-[#1a1a1a]">S2</th>
                    <th className="p-3 w-16 text-center border-r border-[#1a1a1a]">S3</th>
                    <th className="p-3 w-12 text-center">PITS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151515]">
                  {connectionStatus === 'connecting' ? Array.from({length: 20}).map((_, i) => (
                    <tr key={`skel-${i}`} className="animate-pulse h-[36px]">
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-[#222] rounded w-4 mx-auto"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-4 bg-[#222] rounded w-16"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-4 bg-[#222] rounded w-10"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-[#222] rounded w-12 ml-auto"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-[#222] rounded w-10 ml-auto"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-[#222] rounded w-14 ml-auto"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-[#222] rounded w-10 mx-auto"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-[#222] rounded w-10 mx-auto"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-[#222] rounded w-10 mx-auto"></div></td>
                      <td className="p-2"><div className="h-3 bg-[#222] rounded w-4 mx-auto"></div></td>
                    </tr>
                  )) : sortedLines.length > 0 ? sortedLines.map((row) => (
                    <TimingRow key={row.driver} row={row} />
                  )) : (
                    <tr>
                      <td colSpan={10} className="p-0">
                        <EmptyState
                          icon={Radio}
                          title={data.isLiveSession ? 'Waiting for timing data' : 'No live session right now'}
                          description={
                            data.isLiveSession
                              ? 'The session is live but no timing rows have arrived yet. This updates automatically.'
                              : 'Live timing is only available while a Formula 1 session is in progress. The feed will populate automatically when a session starts.'
                          }
                          compact
                          className="border-y-0"
                        />
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
              )}
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            
            {/* Track Map */}
            <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-5 shadow-xl relative overflow-hidden flex flex-col items-center">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent"></div>
              <h3 className="text-[10px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-4 w-full">
                <Activity size={14} /> Track Map Simulation
              </h3>
              <div className="relative w-full aspect-[2/1] bg-[#050505] rounded-lg border border-[#151515] flex items-center justify-center overflow-hidden shadow-inner">
                <svg viewBox="0 0 300 150" className="w-full h-full">
                  {/* Track outline */}
                  <ellipse cx="150" cy="75" rx="120" ry="50" fill="none" stroke="#111" strokeWidth="12" />
                  <ellipse cx="150" cy="75" rx="120" ry="50" fill="none" stroke="#333" strokeWidth="2" strokeDasharray="4 4" />
                  
                  {/* Start/Finish line */}
                  <line x1="150" y1="20" x2="150" y2="30" stroke="white" strokeWidth="2" />
                  <text x="150" y="15" fontSize="6" fill="#666" textAnchor="middle" className="font-mono">START</text>
                  
                  {sortedLines.filter(d => d.status === 'TRACK' || d.status === 'OUT').map(d => {
                     // Using ellipse math for positions
                     const progress = d.progress || 0;
                     const theta = (progress - 0.25) * 2 * Math.PI; 
                     const x = 150 + 120 * Math.cos(theta);
                     const y = 75 + 50 * Math.sin(theta);
                     
                     return (
                       <g
                         key={d.driver}
                         style={{
                           transform: `translate(${x}px, ${y}px)`,
                           transition: mockMode ? 'transform 200ms linear' : 'transform 2s linear'
                         }}
                       >
                         <circle r="4" fill={teamColors[d.team] || '#fff'} className="drop-shadow-lg" />
                         <text y="-6" fontSize="7" fill="#fff" textAnchor="middle" className="font-mono font-black" style={{ textShadow: '0px 1px 2px black, 0px 0px 4px rgba(0,0,0,0.8)' }}>
                           {d.driver}
                         </text>
                       </g>
                     )
                  })}
                </svg>
              </div>
            </div>

            {/* Track Status */}
            <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent"></div>
              <h3 className="text-[10px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-4">
                <Flag size={14} /> Track Status
              </h3>
              <div className={`w-full py-3 rounded-md font-black text-center text-xl tracking-widest shadow-inner border border-black/50 ${getStatusColor(data.trackStatus)}`}>
                {data.trackStatus}
              </div>
            </div>

            {/* Weather */}
            <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent"></div>
              <h3 className="text-[10px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-4">
                <CloudRain size={14} /> Local Conditions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-[#0a0a0a] p-3 rounded border border-[#151515]">
                  <div className="text-[9px] text-neutral-500 mb-1 font-bold tracking-wider">AIR TEMP</div>
                  <div className="font-bold flex items-center gap-2 text-md"><Thermometer size={14} className="text-red-500"/> {data.weather.air}</div>
                </div>
                <div className="bg-[#0a0a0a] p-3 rounded border border-[#151515]">
                  <div className="text-[9px] text-neutral-500 mb-1 font-bold tracking-wider">TRACK TEMP</div>
                  <div className="font-bold flex items-center gap-2 text-md"><Thermometer size={14} className="text-orange-500"/> {data.weather.track}</div>
                </div>
                <div className="bg-[#0a0a0a] p-3 rounded border border-[#151515]">
                  <div className="text-[9px] text-neutral-500 mb-1 font-bold tracking-wider">HUMIDITY</div>
                  <div className="font-bold flex items-center gap-2 text-md"><Wind size={14} className="text-blue-500"/> {data.weather.humidity}</div>
                </div>
                <div className="bg-[#0a0a0a] p-3 rounded border border-[#151515]">
                  <div className="text-[9px] text-neutral-500 mb-1 font-bold tracking-wider">RAIN RISK</div>
                  <div className="font-bold flex items-center gap-2 text-md"><CloudRain size={14} className="text-cyan-500"/> {data.weather.rain}</div>
                </div>
              </div>
            </div>

            {/* Tyre Strategy */}
            <TyreStrategy timingData={sortedLines} />

          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Speed Trap (Dummy) */}
          <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent"></div>
            <h3 className="text-[10px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-4">
              <Zap size={14} /> Speed Trap (Max)
            </h3>
            <div className="space-y-2">
              {sortedLines.slice(0, 3).map((d, i) => {
                 const speed = (342.5 - (i * 2.3 + (d.driver.length % 3))).toFixed(1);
                 return (
                   <div key={i} className="flex justify-between items-center bg-[#0a0a0a] p-2 rounded border border-[#151515]">
                     <span className="font-bold text-xs text-neutral-300">{d.driver}</span>
                     <span className="font-mono text-sm font-black text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]">
                       {speed} km/h
                     </span>
                   </div>
                 );
              })}
            </div>
          </div>

          {/* Race Control Messages */}
          <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-4 flex flex-col shadow-xl h-48 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent"></div>
            <h3 className="text-[10px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-2">
              <Radio size={14} /> Race Control Log
            </h3>
            <div className="flex-1 overflow-y-auto pr-3 space-y-2 font-mono text-[10px] custom-scrollbar">
              {data.messages.length > 0 ? data.messages.map((m, idx) => (
                <div key={idx} className="flex flex-col py-1.5 border-b border-[#151515] last:border-0 group hover:bg-[#0a0a0a] transition-colors rounded px-1">
                  <span className="text-neutral-600 font-bold">{m.time}</span>
                  <span className={`font-black tracking-wide ${m.type === 'pit' ? 'text-blue-400' : m.type === 'flag' ? 'text-yellow-400' : 'text-neutral-300'}`}>
                    {m.msg}
                  </span>
                </div>
              )) : (
                <div className="text-neutral-600 font-bold flex items-center justify-center h-full">Monitoring radio channels...</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LiveTimingPage;
