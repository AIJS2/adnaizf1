import React, { useEffect, useMemo, useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Activity,
  ArrowLeft,
  Check,
  CloudRain,
  Copy,
  Flag,
  MonitorPlay,
  Radio,
  Thermometer,
  Wind,
} from 'lucide-react';
import { useLiveTimingFeed } from '../hooks/useLiveTimingFeed';
import { fetchDashboardData } from '../services/api';
import { resolveNextRaceFromSources } from '../utils/nextRace';
import { getCircuitGeometry } from '../data/circuitPaths';
import { buildPreviewCircuit } from '../utils/liveCircuit';
import { getDriverColor } from '../data/teamData';
import { LiveCircuitMap } from '../components/ui/LiveCircuitMap';
import { Track3D } from '../components/ui/Track3D';
import type { LiveTimingData, LiveTimingLine } from '../types/f1';

const TYRE_STYLE: Record<string, { background: string; color: string }> = {
  S: { background: '#ef4444', color: '#ffffff' },
  M: { background: '#facc15', color: '#111111' },
  H: { background: '#f8fafc', color: '#111111' },
  I: { background: '#22c55e', color: '#052e16' },
  W: { background: '#3b82f6', color: '#ffffff' },
};

function sortLines(lines: LiveTimingLine[]): LiveTimingLine[] {
  return [...lines].sort((a, b) => {
    const posA = parseInt(String(a.position), 10);
    const posB = parseInt(String(b.position), 10);
    if (Number.isNaN(posA) && Number.isNaN(posB)) return 0;
    if (Number.isNaN(posA)) return 1;
    if (Number.isNaN(posB)) return -1;
    return posA - posB;
  });
}

function tyreStyle(compound: string) {
  return TYRE_STYLE[compound] ?? { background: '#525252', color: '#ffffff' };
}

function trackStatusLabel(data: LiveTimingData): string {
  if (data.session_state === 'finished') return 'CHEQUERED FLAG';
  if (data.status === 'unavailable_subscription') return 'FEED UNAVAILABLE';
  if (!data.isLiveSession) return 'NO LIVE SESSION';
  return data.trackStatus || 'GREEN';
}

function trackStatusTone(data: LiveTimingData): string {
  if (data.session_state === 'finished') {
    return 'border-amber-300/50 bg-amber-300/15 text-amber-200';
  }
  if (data.status === 'unavailable_subscription') {
    return 'border-amber-500/40 bg-amber-500/10 text-amber-300';
  }
  if (!data.isLiveSession) {
    return 'border-white/15 bg-white/5 text-white/55';
  }
  const status = (data.trackStatus || '').toUpperCase();
  if (status.includes('RED')) return 'border-red-400/60 bg-red-600/20 text-red-200';
  if (status.includes('YELLOW')) return 'border-yellow-400/60 bg-yellow-400/15 text-yellow-200';
  if (status.includes('SC') || status.includes('VSC')) {
    return 'border-orange-400/60 bg-orange-500/15 text-orange-200';
  }
  return 'border-emerald-400/50 bg-emerald-500/15 text-emerald-200';
}

function WeatherStat({
  icon,
  label,
  value,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-center gap-[0.7vh] rounded-full border border-white/10 bg-black/35 px-[1.1vh] py-[0.45vh]">
      <span className="text-white/45">{icon}</span>
      <span className="text-[0.95vh] font-black uppercase tracking-[0.18em] text-white/40">
        {label}
      </span>
      <span className="text-[1.25vh] font-black tabular-nums text-white/90">{value}</span>
    </div>
  );
}

function DriverRow({ row, leader }: { row: LiveTimingLine; leader: boolean }) {
  const teamColor = getDriverColor(row.driver, row.team);
  const tyre = tyreStyle(row.tyre);
  const isOut =
    row.retired === true ||
    row.status === 'OUT' ||
    ['OUT', 'RET', 'STOP', 'DNF'].includes((row.gap || '').toUpperCase()) ||
    ['OUT', 'RET', 'STOP', 'DNF'].includes((row.lastLap || '').toUpperCase());
  const position = parseInt(String(row.position), 10);

  return (
    <div
      className={`grid grid-cols-[2.6vh_minmax(0,1fr)_auto] items-center gap-[0.9vh] border-b border-white/5 px-[1.1vh] ${
        leader ? 'bg-white/[0.055]' : position <= 3 ? 'bg-white/[0.025]' : ''
      } ${isOut ? 'opacity-45' : ''}`}
      style={{ minHeight: '3.15vh' }}
    >
      <span
        className={`text-center text-[1.35vh] font-black tabular-nums ${
          leader ? 'text-red-300' : 'text-white/45'
        }`}
      >
        {row.position}
      </span>

      <div className="flex min-w-0 items-center gap-[0.8vh]">
        <span
          className="h-[2.05vh] w-[0.32vh] shrink-0 rounded-full"
          style={{ background: teamColor }}
        />
        <span className="shrink-0 text-[1.55vh] font-black tracking-[0.06em] text-white">
          {row.driver}
        </span>
        <span className="truncate text-[1vh] font-bold uppercase tracking-[0.12em] text-white/32">
          {row.team}
        </span>
        {row.status === 'PIT' && (
          <span className="shrink-0 rounded-sm border border-red-400/40 bg-red-600/20 px-[0.45vh] py-[0.1vh] text-[0.85vh] font-black uppercase tracking-[0.16em] text-red-300">
            Pit
          </span>
        )}
        {isOut && (
          <span className="shrink-0 rounded-sm border border-white/15 bg-white/5 px-[0.45vh] py-[0.1vh] text-[0.85vh] font-black uppercase tracking-[0.16em] text-white/50">
            Out
          </span>
        )}
      </div>

      <div className="flex items-center justify-end gap-[1vh]">
        <span
          className="flex h-[2vh] w-[2vh] shrink-0 items-center justify-center rounded-full text-[1.05vh] font-black"
          style={tyre}
          title={`${row.tyre || '?'} · ${row.tyre_age ?? 0} laps`}
        >
          {row.tyre || '·'}
        </span>
        <span className="w-[6.2vh] text-right text-[1.35vh] font-black tabular-nums text-white/85">
          {row.gap || '—'}
        </span>
      </div>
    </div>
  );
}

const OverlayLivePage: React.FC = () => {
  const [searchParams] = useSearchParams();
  const previewBackground = searchParams.get('preview') === '1';
  const { data, connectionStatus, gaveUp } = useLiveTimingFeed();
  const [controlsVisible, setControlsVisible] = useState(previewBackground);
  const [copied, setCopied] = useState(false);
  const [showCorners, setShowCorners] = useState(true);
  const [satelliteView, setSatelliteView] = useState(false);

  const currentYear = useMemo(() => new Date().getFullYear(), []);
  const { data: dashboardData } = useQuery({
    queryKey: ['dashboard', currentYear],
    queryFn: () => fetchDashboardData(currentYear),
    staleTime: 5 * 60 * 1000,
  });

  const nextEvent = useMemo(
    () => resolveNextRaceFromSources(dashboardData?.race_analytics, dashboardData?.next_race_event),
    [dashboardData],
  );

  const previewCircuit = useMemo(() => {
    if (data.circuit || !nextEvent) return null;
    const geom = getCircuitGeometry({
      round: nextEvent.round,
      name: nextEvent.name,
      location: nextEvent.location,
    });
    return geom ? buildPreviewCircuit(geom) : null;
  }, [data.circuit, nextEvent]);

  const trackCircuit = data.circuit ?? previewCircuit;
  const sortedLines = useMemo(() => sortLines(data.lines), [data.lines]);
  const latestMessage = data.messages.length > 0 ? data.messages[data.messages.length - 1] : null;

  const sessionTitle =
    data.session_title?.replace(' — ', ' · ') ||
    (nextEvent?.name ? nextEvent.name.split(' - ')[0] : 'Formula 1');

  const lapLabel =
    data.lap && data.total_laps
      ? `LAP ${data.lap} / ${data.total_laps}`
      : data.lap
        ? `LAP ${data.lap}`
        : 'LIVE TIMING';

  // The overlay must be transparent inside OBS. A normal browser tab keeps its
  // own background; ?preview=1 paints a studio backdrop for configuration.
  useEffect(() => {
    const html = document.documentElement;
    const body = document.body;
    const previousHtml = html.style.background;
    const previousBody = body.style.background;
    html.style.background = 'transparent';
    body.style.background = 'transparent';
    return () => {
      html.style.background = previousHtml;
      body.style.background = previousBody;
    };
  }, []);

  useEffect(() => {
    if (!previewBackground || !controlsVisible) return;
    const timer = setTimeout(() => setControlsVisible(false), 9000);
    return () => clearTimeout(timer);
  }, [previewBackground, controlsVisible]);

  const handleMouseMove = () => {
    if (previewBackground && !controlsVisible) setControlsVisible(true);
  };

  const copyObsUrl = async () => {
    const url = `${window.location.origin}/overlay/live`;
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2200);
    } catch {
      setCopied(false);
    }
  };

  return (
    <div
      className="relative h-screen w-full overflow-hidden font-mono text-white"
      onMouseMove={handleMouseMove}
    >
      {previewBackground && (
        <div
          className="absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 18% 0%, rgba(220,38,38,0.18), transparent 42%), radial-gradient(ellipse at 88% 12%, rgba(14,165,233,0.12), transparent 38%), linear-gradient(160deg, #0b0d12 0%, #050608 55%, #0a0b0f 100%)',
          }}
          aria-hidden="true"
        >
          <div
            className="absolute inset-0 opacity-[0.16]"
            style={{
              backgroundImage:
                'linear-gradient(rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.08) 1px, transparent 1px)',
              backgroundSize: '4.5vh 4.5vh',
            }}
          />
        </div>
      )}

      <div className="relative z-10 flex h-full flex-col gap-[1.5vh] p-[2.1vh]">
        <header className="flex shrink-0 items-start justify-between gap-[2vh]">
          <div className="flex min-w-0 items-center gap-[1.2vh]">
            <div className="h-[5.4vh] w-[0.45vh] shrink-0 rounded-full bg-red-600 shadow-[0_0_18px_rgba(220,38,38,0.65)]" />
            <div className="min-w-0">
              <div className="flex items-center gap-[0.8vh] text-[1vh] font-black uppercase tracking-[0.38em] text-red-400">
                <span className="relative flex h-[0.75vh] w-[0.75vh]">
                  {data.isLiveSession && (
                    <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-70" />
                  )}
                  <span
                    className={`relative inline-flex h-[0.75vh] w-[0.75vh] rounded-full ${
                      data.isLiveSession ? 'bg-red-500' : 'bg-white/30'
                    }`}
                  />
                </span>
                Pit Wall · Live Timing
                {previewBackground && (
                  <span className="rounded-sm border border-white/15 bg-white/5 px-[0.55vh] py-[0.15vh] text-[0.8vh] tracking-[0.22em] text-white/45">
                    Preview
                  </span>
                )}
              </div>
              <h1 className="truncate text-[2.5vh] font-black leading-tight tracking-tight">
                {sessionTitle}
              </h1>
              <div className="mt-[0.35vh] flex items-center gap-[1.2vh] text-[1vh] font-bold uppercase tracking-[0.2em] text-white/35">
                <span>{trackCircuit?.name ?? 'Awaiting circuit'}</span>
                <span className="h-[0.9vh] w-px bg-white/15" />
                <span className="tabular-nums text-white/55">{lapLabel}</span>
              </div>
            </div>
          </div>

          <div className="flex shrink-0 flex-wrap items-center justify-end gap-[0.8vh]">
            <div
              className={`flex items-center gap-[0.7vh] rounded-full border px-[1.2vh] py-[0.5vh] text-[1.05vh] font-black uppercase tracking-[0.18em] ${trackStatusTone(data)}`}
            >
              <Flag size={12} />
              {trackStatusLabel(data)}
            </div>
            <WeatherStat
              icon={<Thermometer size={12} />}
              label="Air"
              value={data.weather.air}
            />
            <WeatherStat
              icon={<Thermometer size={12} />}
              label="Track"
              value={data.weather.track}
            />
            <WeatherStat
              icon={<CloudRain size={12} />}
              label="Rain"
              value={data.weather.rain}
            />
          </div>
        </header>

        <div className="flex min-h-0 flex-1 gap-[1.5vh]">
          <section className="flex w-[clamp(18rem,30vw,30rem)] min-w-0 flex-col overflow-hidden rounded-[1.2vh] border border-white/10 bg-[linear-gradient(160deg,rgba(12,14,19,0.94),rgba(4,5,8,0.9))] shadow-2xl">
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-[1.3vh] py-[0.9vh]">
              <div className="flex items-center gap-[0.7vh] text-[1.05vh] font-black uppercase tracking-[0.28em] text-white/55">
                <Activity size={13} className="text-red-400" />
                Timing Tower
              </div>
              <div className="flex items-center gap-[0.6vh] text-[0.9vh] font-black uppercase tracking-[0.16em] text-white/35">
                <span
                  className={`h-[0.65vh] w-[0.65vh] rounded-full ${
                    connectionStatus === 'connected'
                      ? 'bg-emerald-400'
                      : connectionStatus === 'lost'
                        ? 'bg-amber-400'
                        : 'bg-white/35'
                  }`}
                />
                {gaveUp ? 'Offline' : connectionStatus === 'connected' ? 'Live feed' : 'Connecting'}
              </div>
            </div>

            {sortedLines.length === 0 ? (
              <div className="flex flex-1 flex-col items-center justify-center gap-[1.2vh] px-[2vh] text-center">
                <div className="relative flex h-[6vh] w-[6vh] items-center justify-center rounded-full border border-white/10 bg-white/[0.03]">
                  <span className="absolute h-full w-full animate-ping rounded-full border border-red-500/25" />
                  <Radio size={22} className="text-red-400" />
                </div>
                <div className="text-[1.35vh] font-black uppercase tracking-[0.3em] text-white/70">
                  Awaiting live session
                </div>
                <p className="max-w-[26ch] text-[1.05vh] font-bold leading-relaxed tracking-wide text-white/35">
                  {data.status === 'unavailable_subscription'
                    ? 'This feed requires the paid live timing subscription.'
                    : 'Timing rows appear automatically when the session starts.'}
                </p>
              </div>
            ) : (
              <div className="min-h-0 flex-1 overflow-hidden">
                {sortedLines.map((row, index) => (
                  <DriverRow key={`${row.driver}-${row.position}`} row={row} leader={index === 0} />
                ))}
              </div>
            )}

            <div className="flex shrink-0 items-center justify-between border-t border-white/10 px-[1.3vh] py-[0.7vh] text-[0.85vh] font-bold uppercase tracking-[0.18em] text-white/30">
              <span>{sortedLines.length > 0 ? `${sortedLines.length} cars` : 'No cars'}</span>
              <span className="tabular-nums">{data.weather.humidity} humidity</span>
            </div>
          </section>

          <section className="relative flex min-w-0 flex-1 flex-col overflow-hidden rounded-[1.2vh] border border-white/10 bg-[linear-gradient(150deg,rgba(10,12,17,0.94),rgba(3,4,7,0.9))] shadow-2xl">
            <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-linear-to-r from-transparent via-red-500/50 to-transparent" />
            <div className="flex shrink-0 items-center justify-between border-b border-white/10 px-[1.5vh] py-[0.9vh]">
              <div className="flex min-w-0 items-center gap-[0.8vh] text-[1.05vh] font-black uppercase tracking-[0.26em] text-white/55">
                <MonitorPlay size={13} className="text-red-400" />
                <span className="truncate">Circuit Map</span>
              </div>
              <div className="flex shrink-0 items-center gap-[0.7vh] text-[0.9vh] font-black uppercase tracking-[0.16em] text-white/35">
                <button
                  type="button"
                  onClick={() => setSatelliteView((prev) => !prev)}
                  className={`rounded-sm border px-[0.55vh] py-[0.15vh] transition ${
                    satelliteView
                      ? 'border-emerald-400/40 bg-emerald-400/15 text-emerald-200'
                      : 'border-white/15 bg-white/5 text-white/45 hover:text-white/80'
                  }`}
                >
                  Sat
                </button>
                <button
                  type="button"
                  onClick={() => setShowCorners((prev) => !prev)}
                  className={`rounded-sm border px-[0.55vh] py-[0.15vh] transition ${
                    showCorners
                      ? 'border-cyan-400/35 bg-cyan-400/15 text-cyan-200/90'
                      : 'border-white/15 bg-white/5 text-white/45 hover:text-white/80'
                  }`}
                >
                  Turns
                </button>
                <span className="tabular-nums">{lapLabel}</span>
              </div>
            </div>

            <div className="relative min-h-0 flex-1">
              {trackCircuit ? (
                <Track3D className="h-full w-full p-[1vh]" tone="red" tilt={0} interactive={false} flat>
                  <LiveCircuitMap
                    circuit={trackCircuit}
                    lines={data.circuit ? sortedLines : []}
                    preview={Boolean(previewCircuit)}
                    showCorners={showCorners}
                    satellite={satelliteView}
                    cornerTone="overlay"
                  />
                </Track3D>
              ) : (
                <div className="flex h-full flex-col items-center justify-center gap-[0.8vh] text-center">
                  <MonitorPlay size={28} className="text-white/15" />
                  <p className="text-[1.1vh] font-black uppercase tracking-[0.28em] text-white/35">
                    Awaiting circuit
                  </p>
                </div>
              )}
              {previewCircuit && (
                <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-linear-to-t from-black/70 to-transparent px-[1.5vh] pb-[1vh] pt-[5vh] text-center">
                  <p className="text-[0.95vh] font-black uppercase tracking-[0.24em] text-cyan-200/75">
                    Next round · {nextEvent?.name?.split(' - ')[0] ?? 'Formula 1'}
                  </p>
                </div>
              )}
            </div>

            <div className="flex shrink-0 items-center justify-between border-t border-white/10 px-[1.5vh] py-[0.7vh] text-[0.85vh] font-bold uppercase tracking-[0.18em] text-white/30">
              <span className="truncate">
                {trackCircuit
                  ? [trackCircuit.location, trackCircuit.country].filter(Boolean).join(' · ')
                  : 'Circuit data pending'}
              </span>
              <span className="flex items-center gap-[0.8vh]">
                <Wind size={11} /> {data.weather.humidity} humidity
              </span>
            </div>
          </section>
        </div>

        <footer className="flex shrink-0 items-center gap-[1.1vh] rounded-[0.9vh] border border-white/10 bg-black/55 px-[1.4vh] py-[0.75vh]">
          <span className="flex shrink-0 items-center gap-[0.55vh] text-[0.9vh] font-black uppercase tracking-[0.24em] text-red-400">
            <Radio size={12} /> Race Control
          </span>
          <span className="h-[1vh] w-px shrink-0 bg-white/15" />
          <span className="min-w-0 flex-1 truncate text-[1.15vh] font-bold tracking-wide text-white/65">
            {latestMessage?.msg ?? 'Monitoring race control channels…'}
          </span>
          <span className="shrink-0 text-[0.95vh] font-black tabular-nums text-white/30">
            {latestMessage?.time ?? '—'}
          </span>
        </footer>
      </div>

      {previewBackground && controlsVisible && (
        <div className="absolute bottom-[2.2vh] right-[2.2vh] z-50 flex items-center gap-[0.9vh] rounded-full border border-white/15 bg-black/85 px-[1.1vh] py-[0.6vh] text-[1vh] font-bold text-white/70 shadow-2xl">
          <span className="flex items-center gap-[0.5vh] text-emerald-300">
            <span className="h-[0.6vh] w-[0.6vh] rounded-full bg-emerald-400" />
            OBS 1920×1080
          </span>
          <span className="h-[1vh] w-px bg-white/15" />
          <button
            type="button"
            onClick={copyObsUrl}
            className="flex cursor-pointer items-center gap-[0.45vh] rounded-full px-[0.6vh] py-[0.25vh] text-white/70 transition-colors hover:bg-white/10 hover:text-white"
          >
            {copied ? <Check size={12} /> : <Copy size={12} />}
            {copied ? 'Copied' : 'Copy transparent URL'}
          </button>
          <Link
            to="/live"
            className="flex items-center gap-[0.45vh] rounded-full px-[0.6vh] py-[0.25vh] text-white/50 transition-colors hover:bg-white/10 hover:text-white"
          >
            <ArrowLeft size={12} /> Pit Wall
          </Link>
        </div>
      )}
    </div>
  );
};

export default OverlayLivePage;
