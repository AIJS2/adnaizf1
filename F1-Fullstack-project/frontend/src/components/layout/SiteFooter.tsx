import React from 'react';
import { Link } from 'react-router-dom';
import {
  Activity,
  ArrowUp,
  BookOpen,
  Calculator,
  Database,
  Flag,
  Github,
  Radio,
  Trophy,
} from 'lucide-react';

interface FooterLink {
  to: string;
  label: string;
  icon: React.ComponentType<{ size?: number; className?: string }>;
}

const exploreLinks: FooterLink[] = [
  { to: '/dashboard', label: 'Race Dashboard', icon: Activity },
  { to: '/races', label: 'Race Calendar', icon: Flag },
  { to: '/stats', label: 'Championship', icon: Trophy },
  { to: '/compare', label: 'Driver Compare', icon: Database },
];

const toolLinks: FooterLink[] = [
  { to: '/live', label: 'Live Timing', icon: Radio },
  { to: '/simulator', label: 'Simulator', icon: Calculator },
  { to: '/guide', label: 'Field Guide', icon: BookOpen },
  { to: '/drivers', label: 'Driver Grid', icon: Trophy },
];

/**
 * Global page footer. Short pages used to end on a flat block of background at
 * zoomed-out viewports; this gives every route a deliberate close with a
 * racing stripe, navigation and a live "data source" read-out.
 */
export function SiteFooter() {
  return (
    <footer className="relative mt-16 border-t border-neutral-800/80 bg-neutral-950/85 text-neutral-400">
      <div className="footer-stripe absolute inset-x-0 top-0 h-px" aria-hidden="true" />
      <div
        className="pointer-events-none absolute -top-24 left-1/2 h-44 w-[42rem] -translate-x-1/2 rounded-full bg-red-600/10 blur-[110px]"
        aria-hidden="true"
      />

      <div className="relative mx-auto w-full max-w-[1600px] px-4 py-10 sm:px-6 xl:px-10">
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <Link to="/" className="inline-flex items-center gap-3" aria-label="Analyziz home">
              <span className="flex h-9 w-9 items-center justify-center rounded-md bg-red-600 shadow-[0_0_24px_rgba(225,6,0,0.35)]">
                <Flag size={18} className="text-white" />
              </span>
              <span className="text-lg font-black italic tracking-tight text-white">
                ANALYZ<span className="text-red-500">IZ</span>
              </span>
            </Link>
            <p className="mt-4 max-w-sm text-xs leading-relaxed text-neutral-500">
              Formula 1 telemetry, race strategy and championship what-ifs built on
              real session data. No simulated timing, no made-up lap times.
            </p>
            <div className="mt-4 flex flex-wrap items-center gap-2 text-[10px] font-bold uppercase tracking-widest">
              <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-2.5 py-1 text-emerald-300">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 motion-safe:animate-pulse" />
                FastF1 + OpenF1
              </span>
              <span className="rounded-full border border-neutral-800 bg-neutral-900/80 px-2.5 py-1 text-neutral-400">
                Real data only
              </span>
            </div>
          </div>

          <div className="lg:col-span-3">
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500">Explore</h2>
            <ul className="mt-3 space-y-2">
              {exploreLinks.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="group inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 transition-colors hover:text-white"
                  >
                    <Icon size={13} className="text-neutral-600 transition-colors group-hover:text-red-500" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500">Pit Wall</h2>
            <ul className="mt-3 space-y-2">
              {toolLinks.map(({ to, label, icon: Icon }) => (
                <li key={to}>
                  <Link
                    to={to}
                    className="group inline-flex items-center gap-2 text-xs font-semibold text-neutral-400 transition-colors hover:text-white"
                  >
                    <Icon size={13} className="text-neutral-600 transition-colors group-hover:text-red-500" />
                    {label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div className="lg:col-span-2">
            <h2 className="text-[10px] font-black uppercase tracking-[0.25em] text-neutral-500">Signal</h2>
            <dl className="mt-3 space-y-2 text-[11px] font-mono">
              <div className="flex items-center justify-between gap-2">
                <dt className="text-neutral-600">Backend</dt>
                <dd className="text-neutral-300">FastAPI</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-neutral-600">Cache</dt>
                <dd className="text-neutral-300">Redis</dd>
              </div>
              <div className="flex items-center justify-between gap-2">
                <dt className="text-neutral-600">Season</dt>
                <dd className="text-neutral-300">2026</dd>
              </div>
            </dl>
          </div>
        </div>

        <div className="mt-9 flex flex-col gap-3 border-t border-neutral-800/70 pt-5 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-600">
            © 2026 Analyziz · Unofficial F1 data project
          </p>
          <div className="flex items-center gap-4">
            <a
              href="https://github.com"
              target="_blank"
              rel="noreferrer"
              className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 transition-colors hover:text-white"
            >
              <Github size={13} /> Source
            </a>
            <button
              type="button"
              onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
              className="inline-flex items-center gap-1.5 rounded-md border border-neutral-800 bg-neutral-900/80 px-2.5 py-1.5 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-400 transition-colors hover:border-red-500/50 hover:text-white"
            >
              <ArrowUp size={13} className="text-red-500" /> Top
            </button>
          </div>
        </div>
      </div>

      <span
        aria-hidden="true"
        className="pointer-events-none absolute -bottom-6 right-4 hidden select-none text-[120px] font-black italic leading-none tracking-tighter text-white/[0.025] lg:block"
      >
        ANALYZIZ
      </span>
    </footer>
  );
}

export default SiteFooter;
