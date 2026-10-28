import { fetchDashboardData } from '../services/api';
import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CountdownTimer from '../components/ui/CountdownTimer';
import { resolveNextRaceFromSources, countdownTarget, type ResolvedNextRace } from '../utils/nextRace';
import {
  Activity, Users, Calculator, Trophy, Flag, BookOpen, Search, ChevronRight, LayoutDashboard, Radio,
} from 'lucide-react';

// The hero's one orchestrated moment: five start lights come on one by one,
// then all go out on the same frame. Timings in seconds.
const LIGHT_FIRST = 0.35;
const LIGHT_STEP = 0.32;
const LIGHTS_OUT = LIGHT_FIRST + LIGHT_STEP * 4 + 0.7;

const tools = [
  {
    id: 'dashboard',
    title: 'Dashboard',
    desc: 'Standings, the race calendar and how the season is unfolding.',
    icon: LayoutDashboard,
    link: '/dashboard',
  },
  {
    id: 'telemetry',
    title: 'Telemetry',
    desc: 'Overlay speed, throttle, brake and gear traces, and see who gains where on the lap.',
    icon: Activity,
    link: '/races',
  },
  {
    id: 'compare',
    title: 'Head-to-head',
    desc: 'Put any two drivers side by side and export the comparison as an image.',
    icon: Users,
    link: '/compare',
  },
  {
    id: 'simulator',
    title: 'Championship simulator',
    desc: 'Set the podium for upcoming rounds and watch the title fight recalculate.',
    icon: Calculator,
    link: '/simulator',
  },
  {
    id: 'races',
    title: 'Race weekends',
    desc: 'Results, tyre strategy, speed traps and race control for every round.',
    icon: Flag,
    link: '/races',
  },
  {
    id: 'live',
    title: 'Live timing',
    desc: 'Follow every car live on track, with gaps, intervals, sectors and tyre age.',
    icon: Radio,
    link: '/live',
  },
  {
    id: 'stats',
    title: 'Season stats',
    desc: 'Wins, poles, podiums and points for every driver and constructor.',
    icon: Trophy,
    link: '/stats',
  },
  {
    id: 'guide',
    title: 'How to read the charts',
    desc: 'What lap charts, gap charts and sector deltas are telling you.',
    icon: BookOpen,
    link: '/guide',
  },
];

const topLinks = [
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/races', label: 'Races' },
  { to: '/stats', label: 'Stats' },
  { to: '/compare', label: 'Compare' },
  { to: '/live', label: 'Live Timing' },
];

const openSearch = () =>
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }));

function StartLights() {
  return (
    <div className="flex gap-2 sm:gap-3" aria-hidden="true">
      {[0, 1, 2, 3, 4].map((i) => {
        const delay = LIGHT_FIRST + i * LIGHT_STEP;
        return (
          <div key={i} className="flex flex-col gap-1.5 rounded-md bg-neutral-950 border border-neutral-800 p-1.5 sm:p-2">
            {[0, 1].map((lamp) => (
              <span key={lamp} className="relative block h-4 w-4 sm:h-6 sm:w-6 rounded-full bg-neutral-850">
                <span
                  className="start-light absolute inset-0 rounded-full bg-red-600 shadow-[0_0_18px_4px_rgba(225,6,0,0.55)]"
                  style={{ animationDelay: `${delay}s`, animationDuration: `${LIGHTS_OUT - delay}s` }}
                />
              </span>
            ))}
          </div>
        );
      })}
    </div>
  );
}

function NextRacePanel({ nextRace }: { nextRace: ResolvedNextRace | null }) {
  if (!nextRace) {
    // Reserve the panel's height so the hero does not jump when data lands.
    return <div className="min-h-[148px]" aria-hidden="true" />;
  }

  const raceName = (nextRace.name || '').split(' - ')[0];
  const isLive = nextRace.phase === 'live';
  const isRaceDay = nextRace.phase === 'race_day';
  const phaseLabel = isLive ? 'Live Now' : isRaceDay ? 'Race Day' : 'Next Race';
  const accent = isLive ? 'bg-emerald-400' : isRaceDay ? 'bg-amber-400' : 'bg-red-600';

  return (
    <section
      aria-label="Next race"
      className="hero-rise relative min-h-[148px] rounded-lg bg-neutral-950/80 border border-neutral-800 p-5 sm:p-6 backdrop-blur-sm"
      style={{ animationDelay: '0.35s' }}
      aria-live="polite"
    >
      <span className={`absolute left-0 top-5 bottom-5 w-1 rounded-r ${accent}`} aria-hidden="true" />
      <p className="text-sm font-semibold text-neutral-400">
        <span>{phaseLabel}: {raceName}</span>
      </p>

      <div className="mt-4">
        {isLive ? (
          <span className="inline-flex items-center gap-2 text-2xl font-black italic text-emerald-400">
            <span className="relative flex h-3 w-3" aria-hidden="true">
              <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-emerald-400" />
            </span>
            Race is live
          </span>
        ) : (
          <>
            {isRaceDay && (
              <span className="mb-4 inline-flex items-center rounded-sm bg-amber-400/10 border border-amber-400/30 px-2.5 py-1 text-xs font-bold text-amber-300">
                Today: race starts soon
              </span>
            )}
            <CountdownTimer targetDate={countdownTarget(nextRace.date) ?? new Date()} />
          </>
        )}
      </div>
    </section>
  );
}

function LandingPage() {
  const [nextRace, setNextRace] = useState<ResolvedNextRace | null>(null);
  const [isMac, setIsMac] = useState(false);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setIsMac(typeof navigator !== 'undefined' && /Mac|iPod|iPhone|iPad/.test(navigator.platform));
  }, []);

  useEffect(() => {
    // No cache-busting query param: the backend already serves this payload
    // through Redis with its own TTL.
    let cancelled = false;
    fetchDashboardData(currentYear)
      .then((data) => {
        if (cancelled) return;
        // Single source of truth for the badge's name AND its countdown
        // target, so the two can never disagree on race day.
        const resolved = resolveNextRaceFromSources(data?.race_analytics, data?.next_race_event);
        if (resolved) setNextRace(resolved);
      })
      .catch(err => console.error(err));
    return () => { cancelled = true; };
  }, [currentYear]);

  return (
    <div className="relative min-h-screen bg-tarmac text-chalk overflow-x-hidden">
      {/* Desktop top bar. Below xl the shared mobile header handles nav. */}
      <header className="relative z-20 hidden xl:block">
        <div className="mx-auto flex h-20 max-w-7xl items-center justify-between px-8">
          <Link to="/" className="flex items-center gap-2 rounded-xs" aria-label="Analyziz home" translate="no">
            <span aria-hidden="true" className="h-5 w-2 -skew-x-12 bg-red-600" />
            <span className="text-xl font-black italic tracking-tight">Analyziz</span>
          </Link>
          <nav aria-label="Main" className="flex items-center gap-1">
            {topLinks.map((l) => (
              <Link
                key={l.to}
                to={l.to}
                className="rounded-md px-3 py-2 text-sm font-semibold text-neutral-400 hover:text-chalk hover:bg-neutral-900 transition-colors duration-150"
              >
                {l.label}
              </Link>
            ))}
            <button
              type="button"
              onClick={openSearch}
              className="ml-3 inline-flex items-center gap-2 rounded-md border border-neutral-800 bg-neutral-950 px-3 py-2 text-sm font-semibold text-neutral-400 hover:text-chalk hover:border-neutral-700 transition-colors duration-150"
            >
              <Search size={15} aria-hidden="true" />
              Search
              <kbd className="ml-1 rounded-sm border border-neutral-800 px-1.5 text-[11px] text-neutral-500">Ctrl&nbsp;K</kbd>
            </button>
          </nav>
        </div>
      </header>

      {/* Backdrop: a faint racing-line sweep, static. */}
      <svg
        className="pointer-events-none absolute -right-40 top-0 h-[780px] w-[1100px] text-neutral-900"
        viewBox="0 0 1100 780"
        fill="none"
        aria-hidden="true"
      >
        <path d="M40 720 C 320 700, 420 420, 640 380 S 980 300, 1060 40" stroke="currentColor" strokeWidth="90" strokeLinecap="round" />
        <path d="M40 720 C 320 700, 420 420, 640 380 S 980 300, 1060 40" stroke="#e10600" strokeOpacity="0.35" strokeWidth="2" strokeDasharray="14 18" />
      </svg>

      <section className="relative z-10 mx-auto grid max-w-7xl gap-12 px-5 pb-20 pt-12 sm:px-8 sm:pt-16 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-end xl:pt-20">
        <div className="min-w-0">
          <StartLights />

          <h1
            className="hero-rise mt-10 max-w-4xl text-5xl font-black italic leading-[0.95] tracking-tight sm:text-7xl xl:text-8xl"
            style={{ animationDelay: '0.1s' }}
          >
            Read the race like the pit wall does.
          </h1>

          <p
            className="hero-rise mt-6 max-w-xl text-lg leading-relaxed text-neutral-400"
            style={{ animationDelay: '0.2s' }}
          >
            Lap-by-lap telemetry, live timing, head-to-head driver comparisons and a championship
            simulator for every Grand Prix of the season.
          </p>

          <div className="hero-rise mt-9 flex flex-col gap-3 sm:flex-row" style={{ animationDelay: '0.3s' }}>
            <Link
              to="/dashboard"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md bg-red-600 px-6 font-bold text-white hover:bg-red-500 active:bg-red-700 transition-colors duration-150"
            >
              Open Dashboard
            </Link>
            <button
              type="button"
              onClick={openSearch}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-md border border-neutral-700 px-6 font-bold text-neutral-200 hover:border-neutral-500 hover:bg-neutral-900 hover:text-chalk transition-colors duration-150"
            >
              <Search size={17} aria-hidden="true" />
              Search Drivers
              <kbd className="ml-1 rounded-sm border border-neutral-700 px-1.5 text-xs font-semibold text-neutral-300">
                {isMac ? '⌘K' : 'Ctrl K'}
              </kbd>
            </button>
          </div>
        </div>

        <NextRacePanel nextRace={nextRace} />
      </section>

      <section className="relative z-10 mx-auto max-w-7xl px-5 pb-24 sm:px-8" aria-labelledby="tools-heading">
        <h2 id="tools-heading" className="text-2xl font-black italic tracking-tight sm:text-3xl">
          Where to start
        </h2>
        <p className="mt-2 max-w-xl text-neutral-400">
          From first practice to the chequered flag, each tool covers one part of the weekend.
        </p>

        <ul className="mt-8 grid gap-px overflow-hidden rounded-lg border border-neutral-800 bg-neutral-800 md:grid-cols-2">
          {tools.map(({ id, title, desc, icon: Icon, link }) => (
            <li key={id} className="bg-tarmac">
              <Link
                to={link}
                className="group relative flex h-full items-start gap-4 p-5 sm:p-6 hover:bg-neutral-950 transition-colors duration-150"
              >
                {/* Red kerb stripe that grows on hover/focus: the only hover motion here. */}
                <span
                  aria-hidden="true"
                  className="absolute left-0 top-0 h-full w-[3px] origin-top scale-y-0 bg-red-600 transition-transform duration-200 ease-pit group-hover:scale-y-100 group-focus-visible:scale-y-100"
                />
                <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-neutral-900 text-neutral-300 group-hover:text-red-500 transition-colors duration-150">
                  <Icon size={20} aria-hidden="true" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-lg font-bold text-chalk">{title}</span>
                  <span className="mt-1 block text-sm leading-relaxed text-neutral-400">{desc}</span>
                </span>
                <ChevronRight size={18} className="mt-1 shrink-0 text-neutral-600 group-hover:text-chalk transition-colors duration-150" aria-hidden="true" />
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <footer className="relative z-10 border-t border-neutral-900">
        <div className="mx-auto flex max-w-7xl flex-col items-start justify-between gap-6 px-5 py-10 sm:flex-row sm:items-center sm:px-8">
          <div className="flex items-center gap-2" translate="no">
            <span aria-hidden="true" className="h-4 w-1.5 -skew-x-12 bg-red-600" />
            <span className="text-lg font-black italic tracking-tight">Analyziz</span>
          </div>
          <p className="text-sm text-neutral-500">
            Unofficial fan project. Not associated with Formula 1 companies.
          </p>
        </div>
      </footer>
    </div>
  );
}

export default LandingPage;