import React, { useState, useEffect, useMemo, useRef, memo } from 'react';
import { Activity, CloudRain, Wind, Thermometer, Radio, Flag, Clock } from 'lucide-react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { API_URL, webSocketUrl } from '../config';
import { fetchDashboardData } from '../services/api';
import { resolveNextRaceFromSources, countdownTarget } from '../utils/nextRace';
import HeroCountdown from '../components/ui/HeroCountdown';
import TyreStrategy from '../components/ui/TyreStrategy';
import EmptyState from '../components/ui/EmptyState';
import TeamRadioSection from '../components/dashboard/TeamRadioSection';
import { LiveTimingCircuit, LiveTimingData, LiveTimingLine } from '../types/f1';
import {
  LIVE_TIMING_UNAVAILABLE_TITLE,
  LIVE_TIMING_UNAVAILABLE_MESSAGE,
  REAL_DATA_ONLY_NOTE,
} from '../utils/liveTimingCopy';
import { getDriverColor } from '../data/teamData';

const LiveTimingPage: React.FC = () => {
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

  const [data, setData] = useState<LiveTimingData>({
    lines: [],
    trackStatus: 'GREEN',
    weather: { air: '--', track: '--', humidity: '--', rain: '--' },
    messages: [],
    radio: [],
    status: 'no_session',
    isLiveSession: false,
    session_state: 'no_session',
    session_title: '',
    circuit: null,
    lap: null,
    total_laps: null,
    last_session: null,
  });
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'lost'>('connecting');

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
      }

      setConnectionStatus(prev => prev === 'connected' ? 'lost' : 'connecting');
      const wsUrl = webSocketUrl('/ws/livetiming');

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
              radio: msg.radio ?? prev.radio,
              status: msg.status ?? prev.status,
              reason: msg.reason ?? prev.reason,
              isLiveSession: msg.is_live_session ?? prev.isLiveSession,
              session_state: 'session_state' in msg ? msg.session_state : prev.session_state,
              session_title: 'session_title' in msg ? msg.session_title : prev.session_title,
              session_status: 'session_status' in msg ? msg.session_status : prev.session_status,
              archive_status: 'archive_status' in msg ? msg.archive_status : prev.archive_status,
              circuit: 'circuit' in msg ? msg.circuit : prev.circuit,
              lap: 'lap' in msg ? msg.lap : prev.lap,
              total_laps: 'total_laps' in msg ? msg.total_laps : prev.total_laps,
              last_session: 'last_session' in msg ? msg.last_session : prev.last_session,
            }));
          }
        } catch (err) {
          console.error('Failed to parse Live Timing WebSocket payload:', err);
        }
      };

      ws.onclose = () => {
        setConnectionStatus('lost');
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
  }, []);

  const getStatusColor = (status: string) => {
    if (status.includes('YELLOW')) return 'bg-yellow-500 text-black';
    if (status.includes('RED')) return 'bg-red-600 text-white motion-safe:animate-pulse';
    if (status.includes('SC') || status.includes('VSC')) return 'bg-orange-500 text-white';
    return 'bg-green-500 text-black';
  };

  const [sessionView, setSessionView] = useState<'latest' | 'previous'>('latest');

  const hasEmbeddedPreviousLines = Boolean(
    data.last_session?.lines && data.last_session.lines.length > 0
  );

  const { data: remotePrevious } = useQuery({
    queryKey: ['livetiming', 'previous'],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/livetiming/previous`);
      if (!res.ok) throw new Error('Failed to fetch previous session telemetry');
      return res.json();
    },
    enabled: sessionView === 'previous' && !hasEmbeddedPreviousLines,
    staleTime: 60 * 1000,
  });

  const activePreviousSession = useMemo(() => {
    if (data.last_session && data.last_session.lines && data.last_session.lines.length > 0) {
      return data.last_session;
    }
    if (remotePrevious && (remotePrevious.lines || remotePrevious.session_title)) {
      return remotePrevious;
    }
    return data.last_session ?? null;
  }, [data.last_session, remotePrevious]);

  const isViewingPrevious = sessionView === 'previous' && Boolean(activePreviousSession);

  const activeData = useMemo<LiveTimingData>(() => {
    if (isViewingPrevious && activePreviousSession) {
      const prevLines = activePreviousSession.lines ?? [];
      return {
        ...data,
        session_title: activePreviousSession.session_title || data.session_title,
        session_state: 'finished',
        isLiveSession: false,
        status: 'live',
        circuit: activePreviousSession.circuit ?? data.circuit ?? null,
        lap: activePreviousSession.lap ?? null,
        total_laps: activePreviousSession.total_laps ?? null,
        lines: prevLines,
        weather: activePreviousSession.weather ?? { air: '--', track: '--', humidity: '--', rain: '--' },
        trackStatus: activePreviousSession.trackStatus ?? activePreviousSession.track_status ?? 'FINISH',
        messages: activePreviousSession.messages ?? [],
        radio: activePreviousSession.radio && activePreviousSession.radio.length > 0
          ? activePreviousSession.radio
          : data.radio,
        last_session: activePreviousSession,
      };
    }
    return data;
  }, [isViewingPrevious, activePreviousSession, data]);

  const sortedLines = useMemo(() => {
    return [...activeData.lines].sort((a, b) => {
      const posA = parseInt(String(a.position));
      const posB = parseInt(String(b.position));
      if (isNaN(posA) && isNaN(posB)) return 0;
      if (isNaN(posA)) return 1;
      if (isNaN(posB)) return -1;
      return posA - posB;
    });
  }, [activeData.lines]);

  const hasNoSessionData = sortedLines.length === 0;
  const isUnavailable = !isViewingPrevious && activeData.status === 'unavailable_subscription';
  const isFinished = activeData.session_state === 'finished';
  const isNoSession = activeData.session_state === 'no_session';
  const sessionSubBadge = activeData.session_title
    ? activeData.session_title.replace(' — ', ' • ')
    : '';
  const trackStatusClass = isFinished
    ? 'bg-linear-to-r from-neutral-100 via-amber-200 to-neutral-100 text-black border-amber-400/70 text-sm sm:text-base'
    : isNoSession
      ? 'bg-neutral-900 text-neutral-400 border-neutral-700 text-sm sm:text-base'
      : `border-black/50 text-xl ${getStatusColor(activeData.trackStatus)}`;

  return (
    <div className="bg-black min-h-screen text-white font-mono selection:bg-red-600 w-full overflow-hidden" style={{ overflowAnchor: 'none' }}>
      <main className="w-full max-w-[1920px] mx-auto px-4 sm:px-6 xl:px-10 py-6 md:py-8 xl:py-10">

        {/* Header Bar */}
        <div className="flex flex-col xl:flex-row xl:items-end justify-between mb-6 gap-4 border-b border-[#222] pb-4">
          <div>
            <div className="flex flex-wrap items-center gap-2 mb-2">
              <div className={`inline-flex items-center gap-2 border text-[11px] font-bold uppercase tracking-widest px-3 py-1 rounded-xs ${
                connectionStatus === 'connected'
                  ? isViewingPrevious
                    ? 'bg-amber-400/10 border-amber-400/40 text-amber-300'
                    : isFinished
                      ? 'bg-amber-400/10 border-amber-400/40 text-amber-300'
                      : isUnavailable
                        ? 'bg-amber-500/10 border-amber-500/30 text-amber-400'
                        : activeData.isLiveSession
                          ? 'bg-red-600/10 border-red-500/30 text-red-500'
                          : 'bg-blue-600/10 border-blue-500/30 text-blue-400'
                  : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500'
              }`}>
                <Activity size={12} />
                {connectionStatus === 'connecting'
                  ? 'AWAITING CONNECTION…'
                  : connectionStatus === 'lost'
                    ? 'CONNECTION LOST - RECONNECTING…'
                    : isViewingPrevious
                      ? '🏁 PREVIOUS SESSION — FINAL CLASSIFICATION'
                      : isFinished
                        ? '🏁 SESSION FINISHED — FINAL CLASSIFICATION'
                        : isUnavailable
                          ? 'LIVE TIMING UNAVAILABLE'
                          : activeData.isLiveSession
                            ? 'LIVE SIGNAL DETECTED'
                            : 'NO LIVE SESSION'}
              </div>
              {(isFinished || isViewingPrevious) && sessionSubBadge && (
                <div className="inline-flex items-center gap-2 border border-amber-500/20 bg-amber-500/5 text-[10px] font-bold uppercase tracking-[0.2em] text-amber-200/80 px-3 py-1 rounded-xs">
                  {sessionSubBadge}
                </div>
              )}
            </div>
            <h1 className="text-4xl font-black tracking-tight flex items-center gap-2">
              Pit Wall <span className=" text-chalk">Telemetry</span>
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            {/* Live / Previous Session Toggle Button */}
            <div className="flex bg-neutral-900 border border-neutral-800 rounded-md p-1 shadow-inner">
              <button
                type="button"
                onClick={() => setSessionView('latest')}
                className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-ui flex items-center gap-1.5 cursor-pointer ${
                  sessionView === 'latest'
                    ? 'bg-red-600 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span className={`w-2 h-2 rounded-full ${data.isLiveSession ? 'bg-green-400 motion-safe:animate-pulse' : 'bg-neutral-500'}`} />
                Live Race
              </button>
              <button
                type="button"
                onClick={() => setSessionView('previous')}
                className={`px-3 py-1.5 text-xs font-bold rounded-sm transition-ui flex items-center gap-1.5 cursor-pointer ${
                  sessionView === 'previous'
                    ? 'bg-neutral-700 text-white shadow-sm'
                    : 'text-neutral-400 hover:text-white'
                }`}
              >
                <span>🏁</span>
                Previous
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-4 text-[11px] font-bold bg-tarmac border border-[#222] rounded-md px-4 py-2 uppercase tracking-wider shadow-inner w-full md:w-auto">
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500 "></div> Overall Best</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 "></div> Personal Best</span>
              <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-400"></div> No Improvement</span>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">

          {/* Main Timing Table (Left 3 cols) */}
          <div className="lg:col-span-3 bg-tarmac border border-[#1a1a1a] rounded-md overflow-hidden shadow-2xl flex flex-col relative min-w-0">
            {/* Glossy top highlight */}
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-neutral-500/20 to-transparent"></div>

            {isViewingPrevious && (
              <div className="bg-amber-500/10 border-b border-amber-500/30 px-4 py-2.5 text-xs font-bold text-amber-300 flex items-center justify-between z-20">
                <div className="flex items-center gap-2">
                  <span>🏁</span>
                  <span>VIEWING PREVIOUS RACE TELEMETRY: <span className="text-white">{activeData.session_title}</span></span>
                </div>
                <button
                  type="button"
                  onClick={() => setSessionView('latest')}
                  className="text-[11px] text-amber-400 hover:text-amber-200 underline font-mono cursor-pointer"
                >
                  Return to Live feed →
                </button>
              </div>
            )}

            <div className="overflow-auto flex-1 max-h-[calc(100vh-280px)]" style={{ overflowAnchor: 'none' }}>
              {hasNoSessionData ? (
                isUnavailable ? (
                  <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                    <div className="relative mb-5 flex items-center justify-center">
                      <div className="w-14 h-14 rounded-lg bg-neutral-900/90 border border-neutral-800 flex items-center justify-center text-neutral-400 shadow-inner">
                        <Radio size={24} className="text-amber-400" />
                      </div>
                    </div>

                    <h2 className="text-base font-black uppercase tracking-[0.25em] text-amber-300">
                      {LIVE_TIMING_UNAVAILABLE_TITLE}
                    </h2>
                    <p className="text-xs text-neutral-400 mt-3 max-w-md leading-relaxed font-sans">
                      {LIVE_TIMING_UNAVAILABLE_MESSAGE}
                    </p>
                    <p className="text-[11px] text-neutral-600 mt-2 max-w-md leading-relaxed font-sans">
                      {REAL_DATA_ONLY_NOTE}
                    </p>
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center text-center py-16 px-6">
                  {/* Subtle pit-wall radar beacon */}
                  <div className="relative mb-5 flex items-center justify-center">
                    <div className="w-14 h-14 rounded-lg bg-neutral-900/90 border border-neutral-800 flex items-center justify-center text-neutral-400 shadow-inner">
                      <Radio size={24} className="text-red-500" />
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
                      <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-neutral-900/90 border border-neutral-800 text-[11px] uppercase font-bold tracking-widest text-neutral-400 mb-5 shadow-xs">
                        <span className="w-2 h-2 rounded-full bg-red-500 motion-safe:animate-ping" />
                        <span>NEXT UP: <span className="text-white font-black">{heroRaceName}</span></span>
                        {heroSessionName && (
                          <span className="text-neutral-500 border-l border-neutral-700 pl-2 font-mono">
                            {heroSessionName}
                          </span>
                        )}
                      </div>

                      {/* HeroCountdown display card */}
                      <div className="relative p-5 sm:p-6 rounded-lg bg-tarmac border border-[#222] flex flex-col items-center w-full sm:w-auto">
                        <div className="absolute top-0 left-1/4 right-1/4 h-px bg-linear-to-r from-transparent via-red-500/40 to-transparent" />
                        <HeroCountdown targetDate={targetCountdownDate} phase={heroPhase} />
                      </div>

                      <div className="mt-4 flex items-center gap-2 text-[11px] text-neutral-500 font-mono tracking-widest uppercase">
                        <Clock size={12} className="text-neutral-600" />
                        <span>Lights Out Countdown</span>
                      </div>
                    </div>
                  )}

                  {/* Last completed session, when the backend still remembers it */}
                  {data.last_session && (
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setSessionView('previous')}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          setSessionView('previous');
                        }
                      }}
                      className="mt-6 w-full max-w-lg rounded-lg border border-neutral-800 bg-neutral-900/40 p-4 text-left cursor-pointer hover:border-amber-400/50 hover:bg-neutral-900/70 transition-colors group"
                    >
                      <div className="flex items-center justify-between mb-1">
                        <div className="text-[10px] uppercase tracking-[0.25em] text-neutral-500 font-black">
                          Last Completed Session
                        </div>
                        <span className="text-[10px] uppercase font-bold text-amber-400/80 group-hover:text-amber-300">
                          View Session Telemetry →
                        </span>
                      </div>
                      <div className="text-sm font-bold text-neutral-200">
                        {data.last_session.session_title}
                      </div>
                      <div className="text-[11px] text-neutral-500 mt-1 font-sans">
                        {data.last_session.circuit?.name}
                        {data.last_session.lap && data.last_session.total_laps
                          ? ` • ${data.last_session.lap}/${data.last_session.total_laps} laps`
                          : ''}
                        {data.last_session.leader ? ` • Winner: ${data.last_session.leader}` : ''}
                      </div>
                    </div>
                  )}

                  <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
                    <button
                      type="button"
                      onClick={() => setSessionView('previous')}
                      className="inline-flex items-center gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-amber-300 hover:bg-amber-500/20 hover:border-amber-400 transition-ui cursor-pointer"
                    >
                      <Flag size={13} className="text-amber-400" /> View Previous Race Telemetry
                    </button>
                    <Link
                      to="/races"
                      className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-neutral-200 hover:border-red-500/60 hover:text-white transition-ui"
                    >
                      <Flag size={13} className="text-red-500" /> View Race Archive
                    </Link>
                    <Link
                      to="/simulator"
                      className="inline-flex items-center gap-2 rounded-md border border-neutral-700 bg-neutral-900 px-4 py-2 text-[11px] font-black uppercase tracking-widest text-neutral-200 hover:border-red-500/60 hover:text-white transition-ui"
                    >
                      <Activity size={13} className="text-red-500" /> Open Simulator
                    </Link>
                  </div>
                  </div>
                )
              ) : (
              <table className="w-full text-[13px] tracking-tight whitespace-nowrap min-w-[700px]">
                <thead className="bg-neutral-950 text-neutral-500 font-black text-left border-b border-[#222] shadow-xs sticky top-0 z-10">
                  <tr>
                    <th className="p-3 w-10 text-center border-r border-[#1a1a1a] sticky left-0 bg-neutral-950 z-20">P</th>
                    <th className="p-3 min-w-[140px] border-r border-[#1a1a1a] sticky left-10 bg-neutral-950 z-20">DRIVER</th>
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
                    <tr key={`skel-${i}`} className="motion-safe:animate-pulse h-[36px]">
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-neutral-850 rounded-sm w-4 mx-auto"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-4 bg-neutral-850 rounded-sm w-16"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-4 bg-neutral-850 rounded-sm w-10"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-neutral-850 rounded-sm w-12 ml-auto"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-neutral-850 rounded-sm w-10 ml-auto"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-neutral-850 rounded-sm w-14 ml-auto"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-neutral-850 rounded-sm w-10 mx-auto"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-neutral-850 rounded-sm w-10 mx-auto"></div></td>
                      <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-neutral-850 rounded-sm w-10 mx-auto"></div></td>
                      <td className="p-2"><div className="h-3 bg-neutral-850 rounded-sm w-4 mx-auto"></div></td>
                    </tr>
                  )) : sortedLines.length > 0 ? sortedLines.map((row) => (
                    <TimingRow key={row.driver} row={row} />
                  )) : (
                    <tr>
                      <td colSpan={10} className="p-0">
                        <EmptyState
                          icon={Radio}
                          title={activeData.isLiveSession ? 'Waiting for timing data' : 'No live session right now'}
                          description={
                            activeData.isLiveSession
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
            <div className="bg-tarmac border border-[#1a1a1a] rounded-md p-5 shadow-xl relative overflow-hidden flex flex-col items-center">
              <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-neutral-500/20 to-transparent"></div>
              <h3 className="text-[11px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-4 w-full">
                <Activity size={14} /> {activeData.circuit ? `${activeData.circuit.name.toUpperCase()} — TRACK MAP` : 'TRACK MAP'}
              </h3>
              <div className="relative w-full aspect-square bg-tarmac rounded-lg border border-[#151515] flex items-center justify-center overflow-hidden shadow-inner">
                {activeData.circuit ? (
                  <CircuitTrackMap circuit={activeData.circuit} lines={sortedLines} />
                ) : (
                  <div className="flex flex-col items-center justify-center h-full px-6 text-center">
                    <Activity size={28} className="text-neutral-700 mb-2" />
                    <p className="text-[11px] text-neutral-500 font-bold uppercase tracking-wider leading-relaxed">
                      {isNoSession
                        ? 'No active session — track map unavailable.'
                        : isUnavailable
                          ? 'Live track map unavailable — requires the paid data feed.'
                          : 'Track map unavailable for this circuit.'}
                    </p>
                  </div>
                )}
                {isUnavailable && activeData.circuit && (
                  <div className="absolute inset-0 bg-black/70 flex items-center justify-center p-4">
                    <p className="text-[11px] text-neutral-300 font-bold uppercase tracking-wider text-center leading-relaxed">
                      Live track map unavailable — requires the paid data feed.
                    </p>
                  </div>
                )}
              </div>
              {activeData.circuit && (
                <div className="mt-2 flex w-full items-center justify-between text-[9px] uppercase tracking-widest text-neutral-600">
                  <span>{activeData.circuit.location}</span>
                  <span>{activeData.circuit.country}</span>
                </div>
              )}
            </div>

            {/* Track Status */}
            <div className="bg-tarmac border border-[#1a1a1a] rounded-md p-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-neutral-500/20 to-transparent"></div>
              <h3 className="text-[11px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-4">
                <Flag size={14} /> Track Status
              </h3>
              <div className={`w-full py-3 rounded-md font-black text-center tracking-widest shadow-inner border ${trackStatusClass}`}>
                {isFinished
                  ? '🏁 CHEQUERED FLAG (SESSION ENDED)'
                  : isNoSession
                    ? 'NO SESSION'
                    : activeData.trackStatus}
              </div>
            </div>

            {/* Weather */}
            <div className="bg-tarmac border border-[#1a1a1a] rounded-md p-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-neutral-500/20 to-transparent"></div>
              <h3 className="text-[11px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-4">
                <CloudRain size={14} /> Local Conditions
              </h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="bg-tarmac p-3 rounded-sm border border-[#151515]">
                  <div className="text-[11px] text-neutral-500 mb-1 font-bold tracking-wider">AIR TEMP</div>
                  <div className="font-bold flex items-center gap-2 text-md"><Thermometer size={14} className="text-red-500"/> {activeData.weather.air}</div>
                </div>
                <div className="bg-tarmac p-3 rounded-sm border border-[#151515]">
                  <div className="text-[11px] text-neutral-500 mb-1 font-bold tracking-wider">TRACK TEMP</div>
                  <div className="font-bold flex items-center gap-2 text-md"><Thermometer size={14} className="text-orange-500"/> {activeData.weather.track}</div>
                </div>
                <div className="bg-tarmac p-3 rounded-sm border border-[#151515]">
                  <div className="text-[11px] text-neutral-500 mb-1 font-bold tracking-wider">HUMIDITY</div>
                  <div className="font-bold flex items-center gap-2 text-md"><Wind size={14} className="text-blue-500"/> {activeData.weather.humidity}</div>
                </div>
                <div className="bg-tarmac p-3 rounded-sm border border-[#151515]">
                  <div className="text-[11px] text-neutral-500 mb-1 font-bold tracking-wider">RAIN RISK</div>
                  <div className="font-bold flex items-center gap-2 text-md"><CloudRain size={14} className="text-cyan-500"/> {activeData.weather.rain}</div>
                </div>
              </div>
            </div>

            {/* Tyre Strategy */}
            <TyreStrategy timingData={sortedLines} />

          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Race Control Messages */}
          <div className="bg-tarmac border border-[#1a1a1a] rounded-md p-4 flex flex-col shadow-xl min-h-[300px] relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-px bg-linear-to-r from-transparent via-neutral-500/20 to-transparent"></div>
            <h3 className="text-[11px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-2">
              <Radio size={14} /> Race Control Log
            </h3>
            <div className="flex-1 overflow-y-auto pr-3 space-y-2 font-mono text-[11px] custom-scrollbar">
              {isUnavailable ? (
                <div className="text-neutral-500 font-bold flex items-center justify-center h-full text-center px-6 leading-relaxed">
                  Live race control is unavailable — real-time messages require a paid data feed that isn't connected yet.
                </div>
              ) : activeData.messages.length > 0 ? activeData.messages.map((m, idx) => (
                <div key={idx} className="flex flex-col py-1.5 border-b border-[#151515] last:border-0 group hover:bg-tarmac transition-colors rounded-sm px-1">
                  <span className="text-neutral-600 font-bold">{m.time}</span>
                  <span className={`font-black tracking-wide ${m.type === 'pit' ? 'text-blue-400' : m.type === 'flag' ? 'text-yellow-400' : 'text-neutral-300'}`}>
                    {m.msg}
                  </span>
                </div>
              )) : (
                <div className="text-neutral-600 font-bold flex items-center justify-center h-full">Monitoring radio channels…</div>
              )}
            </div>
          </div>

          {/* Pit Wall Team Radio Comms */}
          <TeamRadioSection
            liveRadio={activeData.radio}
            liveStatus={activeData.status}
            connectionStatus={connectionStatus}
            sessionMode={sessionView}
            onSessionModeChange={setSessionView}
          />
        </div>
      </main>
    </div>
  );
};

interface CircuitTrackMapProps {
  circuit: LiveTimingCircuit;
  lines: LiveTimingLine[];
}

interface TrackMapPoint {
  driver: string;
  team: string;
  x: number;
  y: number;
  color: string;
}

/**
 * Draws the real circuit outline bundled by the backend and places every
 * running car on it with SVGPathElement.getPointAtLength(). The leader sits at
 * the start/finish point; the rest are spread by their gap in seconds.
 */
const CircuitTrackMap = memo<CircuitTrackMapProps>(({ circuit, lines }) => {
  const pathRef = useRef<SVGPathElement | null>(null);
  const [points, setPoints] = useState<TrackMapPoint[]>([]);

  useEffect(() => {
    const path = pathRef.current;
    if (
      !path ||
      typeof path.getTotalLength !== 'function' ||
      typeof path.getPointAtLength !== 'function'
    ) {
      setPoints([]);
      return;
    }

    let total = 0;
    try {
      total = path.getTotalLength();
    } catch {
      total = 0;
    }
    if (!Number.isFinite(total) || total <= 0) {
      setPoints([]);
      return;
    }

    const next: TrackMapPoint[] = [];
    lines
      .filter((line) => line.status === 'TRACK' || line.status === 'OUT')
      .forEach((line, index) => {
        const rawProgress =
          typeof line.progress === 'number' && Number.isFinite(line.progress)
            ? line.progress
            : index === 0
              ? 0
              : index * 0.02;
        const progress = Math.max(0, Math.min(rawProgress, 0.98));
        try {
          const point = path.getPointAtLength(progress * total);
          next.push({
            driver: line.driver,
            team: line.team,
            x: point.x,
            y: point.y,
            color: getDriverColor(line.driver, line.team),
          });
        } catch {
          // Ignore a malformed point; the remaining drivers still render.
        }
      });

    setPoints(next);
  }, [circuit.path, lines]);

  return (
    <svg
      viewBox={circuit.viewBox || '0 0 500 500'}
      className="w-full h-full p-2"
      role="img"
      aria-label={`${circuit.name} track map`}
      data-testid="circuit-track-map"
    >
      <path
        d={circuit.path}
        fill="none"
        stroke="#080808"
        strokeWidth="18"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        d={circuit.path}
        fill="none"
        stroke="#3b3b3b"
        strokeWidth="5"
        strokeLinejoin="round"
        strokeLinecap="round"
      />
      <path
        ref={pathRef}
        d={circuit.path}
        fill="none"
        stroke="transparent"
        strokeWidth="1"
      />
      {points.map((point) => (
        <g
          key={point.driver}
          style={{
            transform: `translate(${point.x}px, ${point.y}px)`,
            transition: 'transform 2s linear',
          }}
        >
          <circle
            r="6"
            fill={point.color}
            stroke="#000"
            strokeWidth="1.5"
            className="drop-shadow-lg"
          />
          <text
            y="-9"
            fontSize="9"
            fill="#fff"
            textAnchor="middle"
            className="font-mono font-black"
            style={{ paintOrder: 'stroke', stroke: '#000', strokeWidth: 2 }}
          >
            {point.driver}
          </text>
        </g>
      ))}
    </svg>
  );
});
CircuitTrackMap.displayName = 'CircuitTrackMap';

interface TimingRowProps {
  row: LiveTimingLine;
}

const TimingRow = memo<TimingRowProps>(({ row }) => {
  const teamColor = getDriverColor(row.driver, row.team);
  const isIntervalClose = Boolean(
    row.interval && !isNaN(parseFloat(row.interval)) && parseFloat(row.interval) < 1.0
  );

  return (
    <tr className="hover:bg-neutral-950 transition-colors group relative">
      <td className="p-2.5 text-center font-black text-neutral-500 border-r border-[#151515] sticky left-0 bg-tarmac group-hover:bg-neutral-950 z-10 tabular-nums">{row.position}</td>

      <td className="p-2.5 font-black text-white text-[14px] border-r border-[#151515] flex items-center gap-2 sticky left-10 bg-tarmac group-hover:bg-neutral-950 z-10">
        <div className="w-1 h-5 rounded-xs shadow-xs" style={{ backgroundColor: teamColor }}></div>
        {row.driver}
        {row.status === 'PIT' && (
          <span className="ml-2 px-1 py-0.5 bg-red-600/20 text-red-500 border border-red-500/30 text-[11px] rounded-xs motion-safe:animate-pulse uppercase tracking-wider">
            IN PIT
          </span>
        )}
        {row.status !== 'PIT' && isIntervalClose && (
          <span
            className="ml-1 px-1 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[11px] rounded-xs uppercase tracking-wider "
            title="Manual Override Available"
          >
            OVR
          </span>
        )}
      </td>
      <td className="p-2.5 border-r border-[#151515]">
        <TyreIcon compound={row.tyre} age={row.tyre_age} />
      </td>
      <td className="p-2.5 text-right text-neutral-300 font-mono border-r border-[#151515] tabular-nums">{row.gap}</td>
      <td className="p-2.5 text-right text-neutral-400 font-mono border-r border-[#151515] tabular-nums">{row.interval}</td>
      <td className="p-2.5 text-right border-r border-[#151515] bg-tarmac group-hover:bg-neutral-950 transition-colors shadow-inner">
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
      <td className="p-2.5 text-center text-neutral-600 font-mono font-bold tabular-nums">{row.pits}</td>
    </tr>
  );
});
TimingRow.displayName = 'TimingRow';

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
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[11px] font-black ${bg} ${text}`}>
        {compound}
      </div>
      <span className="text-[11px] text-neutral-400">{age}L</span>
    </div>
  );
};

const SectorTime: React.FC<{ time: string, color: string }> = ({ time, color }) => {
  let colorClass = 'text-neutral-500';
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

export default LiveTimingPage;
