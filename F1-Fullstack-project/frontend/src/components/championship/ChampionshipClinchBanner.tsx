import React, { useState } from 'react';
import {
  Crown,
  Trophy,
  ShieldCheck,
  ChevronDown,
  ChevronUp,
  AlertCircle,
  Sparkles,
  CheckCircle2,
  Award,
  Flame,
  Lock,
  Gauge,
} from 'lucide-react';
import {
  evaluateChampionship,
  ChampionshipRace,
  ChampionshipEntry,
  ChampionshipCalculation,
} from '../../utils/championshipMath';
import { teamLogos, getDriverColor, getTeamColor } from '../../data/teamData';

interface ChampionshipClinchBannerProps {
  drivers: ChampionshipEntry[];
  teams: ChampionshipEntry[];
  races?: ChampionshipRace[];
  totalRaces?: number;
  currentYear?: number;
}

interface TitleCardProps {
  type: 'wdc' | 'wcc';
  calc: ChampionshipCalculation;
  currentYear: number;
}

const DARK_LOGOS = ['Audi', 'Audi F1 Team', 'Haas', 'Haas F1 Team'];

const TitleCoronationCard: React.FC<TitleCardProps> = ({ type, calc, currentYear }) => {
  const isWdc = type === 'wdc';
  const isClinched = calc.isClinched;
  const leader = calc.leader;
  const runnerUp = calc.runnerUp;

  if (!leader) return null;

  const teamName = isWdc ? (leader.team || '') : leader.name;
  const accentColor = isWdc
    ? getDriverColor(leader.name, leader.team)
    : getTeamColor(leader.name);
  const logo = teamLogos[teamName] || teamLogos[leader.name];
  const needsInvert = DARK_LOGOS.some((name) => teamName.toLowerCase().includes(name.toLowerCase()));

  const leaderPts = Number(leader.points) || 0;
  const runnerUpPts = runnerUp ? Number(runnerUp.points) || 0 : 0;
  const runnerUpMaxPts = runnerUpPts + calc.maxRemainingPoints;
  const clinchMargin = leaderPts - runnerUpMaxPts;

  const scaleMax = Math.max(leaderPts, runnerUpMaxPts, 1);
  const leaderBarPct = Math.min(100, Math.max(12, (leaderPts / scaleMax) * 100));
  const runnerUpCurrentPct = Math.min(100, Math.max(6, (runnerUpPts / scaleMax) * 100));
  const runnerUpPotentialPct = Math.min(
    100 - runnerUpCurrentPct,
    Math.max(0, (calc.maxRemainingPoints / scaleMax) * 100)
  );

  const contenderCount = calc.entries.filter((e) => e.canWinTitle).length;

  return (
    <div
      className={`relative overflow-hidden rounded-xl border transition-all duration-300 ${
        isClinched
          ? 'border-yellow-500/45 bg-gradient-to-br from-yellow-950/35 via-neutral-900/95 to-neutral-950 shadow-[0_12px_40px_-12px_rgba(234,179,8,0.22)] hover:border-yellow-400/70'
          : 'border-neutral-800 bg-gradient-to-br from-neutral-900/90 via-neutral-900/70 to-neutral-950 shadow-xl hover:border-neutral-700'
      } p-4 sm:p-5 flex flex-col justify-between`}
    >
      {/* Top dual-tone laser bar (Gold + Team Accent) */}
      <div
        className="absolute top-0 left-0 right-0 h-1"
        style={{
          background: isClinched
            ? `linear-gradient(90deg, #FACC15 0%, ${accentColor} 60%, #F59E0B 100%)`
            : `linear-gradient(90deg, ${accentColor} 0%, transparent 100%)`,
          boxShadow: isClinched ? '0 0 14px rgba(250, 204, 21, 0.55)' : `0 0 10px ${accentColor}50`,
        }}
      />

      {/* Ambient team & gold glow */}
      <div
        className="pointer-events-none absolute -right-12 -top-12 h-44 w-44 rounded-full blur-3xl opacity-20"
        style={{ backgroundColor: isClinched ? '#FACC15' : accentColor }}
      />
      <div
        className="pointer-events-none absolute -left-10 -bottom-12 h-36 w-36 rounded-full blur-3xl opacity-15"
        style={{ backgroundColor: accentColor }}
      />

      {/* Giant Watermark */}
      <div
        className="pointer-events-none select-none absolute right-3 bottom-1 font-mono text-[4.5rem] sm:text-[5.5rem] font-black italic leading-none opacity-[0.045]"
        style={{ color: isClinched ? '#FACC15' : accentColor }}
      >
        {isWdc ? 'WDC' : 'WCC'}
      </div>

      <div>
        {/* Top Status Pill Row */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3.5 relative z-10">
          {isClinched ? (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-yellow-400/50 bg-yellow-500/20 px-2.5 py-1 text-[10px] font-mono font-black uppercase tracking-widest text-yellow-300 shadow-xs">
              {isWdc ? <Sparkles size={11} className="text-yellow-400" /> : <CheckCircle2 size={11} className="text-yellow-400" />}
              <span>{isWdc ? 'WDC Champion Clinched' : 'WCC Champion Clinched'}</span>
            </div>
          ) : (
            <div className="inline-flex items-center gap-1.5 rounded-md border border-neutral-700 bg-neutral-800/80 px-2.5 py-1 text-[10px] font-mono font-black uppercase tracking-widest text-neutral-300">
              {isWdc ? <Crown size={11} className="text-amber-400" /> : <Trophy size={11} className="text-amber-400" />}
              <span>{isWdc ? 'WDC Leader (Contested)' : 'WCC Leader (Contested)'}</span>
            </div>
          )}

          <div className="flex items-center gap-1.5">
            {leader.wins !== undefined && Number(leader.wins) > 0 && (
              <span className="inline-flex items-center gap-1 rounded-md border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 font-mono text-[10px] font-bold text-amber-300">
                <Flame size={10} className="text-amber-400" />
                {leader.wins} {Number(leader.wins) === 1 ? 'WIN' : 'WINS'}
              </span>
            )}
            <span
              className={`inline-flex items-center gap-1 rounded-md border px-2 py-0.5 font-mono text-[10px] font-bold uppercase ${
                isClinched
                  ? 'border-emerald-500/40 bg-emerald-500/15 text-emerald-300'
                  : 'border-neutral-700 bg-neutral-900 text-neutral-400'
              }`}
            >
              <Lock size={9} />
              {isClinched ? 'SEALED' : `${contenderCount} IN HUNT`}
            </span>
          </div>
        </div>

        {/* Champion Identity Block */}
        <div className="flex items-center gap-3.5 mb-4 relative z-10">
          <div
            className={`relative flex h-13 w-13 shrink-0 items-center justify-center rounded-xl border shadow-inner ${
              isClinched
                ? 'border-yellow-400/60 bg-gradient-to-br from-yellow-500/30 via-amber-500/15 to-neutral-900 text-yellow-300 shadow-yellow-500/20'
                : 'border-neutral-700 bg-neutral-800/80 text-neutral-300'
            }`}
          >
            {isWdc ? <Crown size={26} /> : <Trophy size={25} />}
            {isClinched && (
              <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-yellow-400 text-[9px] font-mono font-black text-neutral-950 shadow-xs">
                1
              </span>
            )}
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="font-mono text-[10px] font-bold uppercase tracking-widest text-neutral-400">
                {currentYear} {isWdc ? "FIA World Drivers' Title" : "FIA World Constructors' Title"}
              </span>
            </div>

            <div className="font-black italic uppercase tracking-tight text-white text-xl sm:text-2xl leading-tight truncate drop-shadow-xs">
              {leader.name}
            </div>

            <div className="flex items-center gap-2 mt-1">
              {logo && (
                <img
                  src={logo}
                  alt={teamName}
                  className={`h-3.5 w-auto object-contain shrink-0 ${needsInvert ? 'brightness-0 invert' : ''}`}
                />
              )}
              <span
                className="text-xs font-bold uppercase tracking-wider truncate"
                style={{ color: accentColor }}
              >
                {isWdc
                  ? leader.team
                    ? `Team • ${leader.team}`
                    : 'Formula 1 Team'
                  : 'Constructor • Official Entry'}
              </span>
            </div>
          </div>
        </div>

        {/* 3-Column Pit-Wall Telemetry Strip */}
        <div className="grid grid-cols-3 gap-2 mb-3.5 relative z-10">
          <div className="rounded-lg border border-neutral-800/90 bg-neutral-950/80 p-2.5">
            <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-neutral-500">
              Total Points
            </span>
            <div className="mt-0.5 font-mono text-base sm:text-lg font-black text-yellow-300 leading-none">
              {leaderPts} <span className="text-[10px] font-bold text-neutral-400">PTS</span>
            </div>
            <span className="mt-1 block font-mono text-[9px] text-neutral-500 truncate">
              P1 Standing
            </span>
          </div>

          <div className="rounded-lg border border-neutral-800/90 bg-neutral-950/80 p-2.5">
            <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-neutral-500">
              Lead Over P2
            </span>
            <div className="mt-0.5 font-mono text-base sm:text-lg font-black text-emerald-400 leading-none">
              +{calc.gap} <span className="text-[10px] font-bold text-neutral-400">pts</span>
            </div>
            <span className="mt-1 block font-mono text-[9px] text-neutral-400 truncate">
              {runnerUp ? `vs ${runnerUp.name}` : 'Uncontested'}
            </span>
          </div>

          <div className="rounded-lg border border-neutral-800/90 bg-neutral-950/80 p-2.5">
            <span className="block font-mono text-[9px] font-bold uppercase tracking-wider text-neutral-500">
              {isClinched ? 'P2 Max Ceiling' : 'Magic Number'}
            </span>
            <div className="mt-0.5 font-mono text-base sm:text-lg font-black text-white leading-none">
              {isClinched ? runnerUpMaxPts : calc.magicNumber}{' '}
              <span className="text-[10px] font-bold text-neutral-400">PTS</span>
            </div>
            <span className="mt-1 block font-mono text-[9px] text-amber-400/90 truncate">
              {isClinched
                ? `+${clinchMargin} pts buffer`
                : `Max left: ${calc.maxRemainingPoints} pts`}
            </span>
          </div>
        </div>
      </div>

      {/* Visual Mathematical Comparison Gauge */}
      <div className="rounded-lg border border-neutral-800/80 bg-neutral-950/90 p-2.5 space-y-2 relative z-10">
        {/* P1 Bar */}
        <div className="space-y-1">
          <div className="flex items-center justify-between font-mono text-[10px]">
            <span className="font-bold text-yellow-300 truncate">
              P1 • {leader.name}
            </span>
            <span className="font-black text-white">{leaderPts} PTS</span>
          </div>
          <div className="h-1.5 w-full rounded-full bg-neutral-900 overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${leaderBarPct}%`,
                background: `linear-gradient(90deg, #FACC15 0%, ${accentColor} 100%)`,
              }}
            />
          </div>
        </div>

        {/* P2 Current + Max Possible Bar */}
        {runnerUp && (
          <div className="space-y-1">
            <div className="flex items-center justify-between font-mono text-[10px]">
              <span className="font-medium text-neutral-400 truncate">
                P2 • {runnerUp.name} ({runnerUpPts} + {calc.maxRemainingPoints} max)
              </span>
              <span className="font-bold text-neutral-300">
                {runnerUpMaxPts} PTS MAX
              </span>
            </div>
            <div className="flex h-1.5 w-full rounded-full bg-neutral-900 overflow-hidden">
              <div
                className="h-full bg-neutral-500 transition-all duration-500"
                style={{ width: `${runnerUpCurrentPct}%` }}
                title={`Current Points: ${runnerUpPts} PTS`}
              />
              {runnerUpPotentialPct > 0 && (
                <div
                  className="h-full bg-amber-500/35 border-l border-neutral-950 transition-all duration-500"
                  style={{ width: `${runnerUpPotentialPct}%` }}
                  title={`Max Remaining Available: +${calc.maxRemainingPoints} PTS`}
                />
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export const ChampionshipClinchBanner: React.FC<ChampionshipClinchBannerProps> = ({
  drivers,
  teams,
  races = [],
  totalRaces,
  currentYear = 2026,
}) => {
  const [showMathDetails, setShowMathDetails] = useState(false);

  const wdcCalc = evaluateChampionship(drivers, {
    races,
    totalRaces,
    isConstructor: false,
  });

  const wccCalc = evaluateChampionship(teams, {
    races,
    totalRaces,
    isConstructor: true,
  });

  const isWdcClinched = wdcCalc.isClinched;
  const isWccClinched = wccCalc.isClinched;

  // If neither is clinched and no meaningful late-season battle exists, skip heavy banner
  if (!isWdcClinched && !isWccClinched && wdcCalc.remainingRaces > 10) {
    return null;
  }

  const seasonProgressPct =
    wdcCalc.totalRaces > 0
      ? Math.min(100, Math.round((wdcCalc.completedRaces / wdcCalc.totalRaces) * 100))
      : 0;

  return (
    <div className="relative overflow-hidden rounded-2xl border border-yellow-500/45 bg-gradient-to-b from-yellow-950/30 via-neutral-950/95 to-neutral-950 p-4 sm:p-6 shadow-[0_20px_60px_-15px_rgba(234,179,8,0.18)] backdrop-blur-xl">
      {/* Top Championship Gold Laser Accent */}
      <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-yellow-500 via-amber-200 to-yellow-600 shadow-[0_0_16px_rgba(250,204,21,0.75)]" />

      {/* Subtle Ambient Corner Spotlights */}
      <div className="pointer-events-none absolute -top-24 left-1/4 h-64 w-64 rounded-full bg-yellow-500/10 blur-[100px]" />
      <div className="pointer-events-none absolute -bottom-24 right-1/4 h-64 w-64 rounded-full bg-amber-500/10 blur-[100px]" />

      {/* Top Telemetry Command Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 mb-5 border-b border-neutral-800/80 relative z-10">
        <div className="space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1.5 rounded-full border border-yellow-400/60 bg-yellow-500/20 px-3 py-1 text-[11px] font-mono font-black uppercase tracking-widest text-yellow-300 shadow-xs">
              <Crown size={13} className="text-yellow-400" />
              {currentYear} World Championship Title Status
            </span>

            {(isWdcClinched || isWccClinched) && (
              <span className="inline-flex items-center gap-1 rounded-full border border-emerald-500/40 bg-emerald-500/15 px-2.5 py-1 text-[10px] font-mono font-black uppercase tracking-wider text-emerald-300">
                <Award size={12} className="text-emerald-400" />
                {isWdcClinched && isWccClinched
                  ? 'Double Crown Mathematically Clinched'
                  : 'Title Mathematically Clinched'}
              </span>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-xs font-mono text-neutral-300">
            <span className="font-bold text-white">
              Round {wdcCalc.completedRaces} of {wdcCalc.totalRaces} • {wdcCalc.remainingRaces} Races Remaining
            </span>
            <span className="hidden sm:inline text-neutral-600">|</span>
            <span className="text-neutral-400">
              Max Points Available:{' '}
              <strong className="text-yellow-300">{wdcCalc.maxRemainingPoints} pts / driver</strong> •{' '}
              <strong className="text-yellow-300">{wccCalc.maxRemainingPoints} pts / team</strong>
            </span>
          </div>
        </div>

        {/* Right: Season Completion Gauge & Mathematical Proof Toggle */}
        <div className="flex flex-wrap sm:flex-nowrap items-center gap-3 shrink-0">
          <div className="flex items-center gap-2.5 rounded-lg border border-neutral-800 bg-neutral-900/90 px-3 py-2">
            <Gauge size={15} className="text-yellow-400 shrink-0" />
            <div className="min-w-[110px]">
              <div className="flex items-center justify-between font-mono text-[10px] text-neutral-400 mb-1">
                <span>SEASON</span>
                <span className="font-black text-yellow-300">{seasonProgressPct}%</span>
              </div>
              <div className="h-1.5 w-full rounded-full bg-neutral-800 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-yellow-500 to-amber-300"
                  style={{ width: `${seasonProgressPct}%` }}
                />
              </div>
            </div>
          </div>

          <button
            type="button"
            onClick={() => setShowMathDetails(!showMathDetails)}
            aria-expanded={showMathDetails}
            className="inline-flex items-center gap-2 rounded-lg border border-yellow-500/40 bg-neutral-900/95 px-3.5 py-2.5 text-xs font-mono font-bold text-yellow-200 hover:border-yellow-400 hover:bg-yellow-500/15 hover:text-white focus:outline-hidden focus:ring-2 focus:ring-yellow-400/60 transition-colors cursor-pointer"
          >
            <ShieldCheck size={14} className="text-yellow-400" />
            <span>Mathematical Proof</span>
            {showMathDetails ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
        </div>
      </div>

      {/* Dual Asymmetric Coronation Cards (WDC & WCC) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 relative z-10">
        <TitleCoronationCard type="wdc" calc={wdcCalc} currentYear={currentYear} />
        <TitleCoronationCard type="wcc" calc={wccCalc} currentYear={currentYear} />
      </div>

      {/* Accordion: Mathematical Proof Details */}
      {showMathDetails && (
        <div className="mt-5 pt-5 border-t border-neutral-800/90 font-mono text-xs relative z-10">
          <div className="rounded-xl border border-yellow-500/30 bg-neutral-950/90 p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-yellow-400 font-black uppercase text-xs tracking-wider">
                <AlertCircle size={15} /> Official Clinching Formula
              </div>
              <span className="text-[10px] font-mono text-neutral-400 uppercase tracking-widest">
                FIA 2026 Sporting Regulations • Points System (25 GP / 8 Sprint)
              </span>
            </div>

            <p className="text-neutral-300 text-xs leading-relaxed font-sans">
              A world championship title is mathematically clinched when the championship leader&apos;s points advantage over P2 exceeds the maximum points available across all remaining events:
            </p>

            {/* 4-Card Telemetry Breakdown */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
              <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-3">
                <span className="text-[10px] text-neutral-400 uppercase block">Remaining Events</span>
                <span className="text-sm font-black text-white mt-0.5 block">
                  {wdcCalc.remainingRaces} Grand Prix
                  {wdcCalc.remainingSprints > 0 ? ` + ${wdcCalc.remainingSprints} Sprint` : ''}
                </span>
                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                  Completed: {wdcCalc.completedRaces} / {wdcCalc.totalRaces} rounds
                </span>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-3">
                <span className="text-[10px] text-neutral-400 uppercase block">Max Driver Points Available</span>
                <span className="text-sm font-black text-yellow-300 mt-0.5 block">
                  {wdcCalc.maxRemainingPoints} PTS
                </span>
                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                  {wdcCalc.remainingRaces} × 25 pts{wdcCalc.remainingSprints > 0 ? ` + ${wdcCalc.remainingSprints} × 8 pts` : ''}
                </span>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-3">
                <span className="text-[10px] text-neutral-400 uppercase block">Max Constructor Points Available</span>
                <span className="text-sm font-black text-yellow-300 mt-0.5 block">
                  {wccCalc.maxRemainingPoints} PTS
                </span>
                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                  {wccCalc.remainingRaces} × 43 pts{wccCalc.remainingSprints > 0 ? ` + ${wccCalc.remainingSprints} × 15 pts` : ''}
                </span>
              </div>

              <div className="rounded-lg border border-neutral-800 bg-neutral-900/80 p-3">
                <span className="text-[10px] text-neutral-400 uppercase block">Title Gap Verification</span>
                <span className="text-sm font-black text-emerald-400 mt-0.5 block">
                  +{wdcCalc.gap} WDC / +{wccCalc.gap} WCC
                </span>
                <span className="text-[10px] text-neutral-500 mt-0.5 block">
                  P1 Lead vs Max Remaining
                </span>
              </div>
            </div>

            <div className="p-3 rounded-lg bg-neutral-900/90 border border-neutral-800 text-neutral-300 text-[11px] leading-relaxed">
              Since the points gap (+{wdcCalc.gap} pts WDC{isWccClinched ? ` / +${wccCalc.gap} pts WCC` : ''}) exceeds the maximum remaining points available ({wdcCalc.maxRemainingPoints} pts WDC{isWccClinched ? ` / ${wccCalc.maxRemainingPoints} pts WCC` : ''}), no challenger can mathematically match or overtake P1.
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChampionshipClinchBanner;
