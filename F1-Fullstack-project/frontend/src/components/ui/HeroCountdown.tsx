import React, { useState, useEffect, useMemo } from 'react';

interface HeroCountdownProps {
  targetDate: string | Date;
  /**
   * Lifecycle phase of the event:
   *  - 'future'   — a later race day (plain countdown).
   *  - 'race_day' — today, but the start time has NOT yet arrived: keep the
   *                 countdown and let the caller add a RACE DAY badge. Never
   *                 show LIVE before start time.
   *  - 'live'     — race underway: show the LIVE badge, hide the countdown.
   */
  phase?: 'future' | 'race_day' | 'live';
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isLive: boolean;
}

/**
 * Derive the countdown from a target timestamp. Used as the lazy `useState`
 * initializer so the very first painted frame already shows the real numbers
 * (a post-mount `useEffect` would flash 00:00:00:00 for one frame).
 */
function computeTimeLeft(targetTimestamp: number): TimeLeft {
  // No parseable target: keep the all-zero, non-live state (same as before).
  if (!targetTimestamp) return { days: 0, hours: 0, minutes: 0, seconds: 0, isLive: false };
  const diff = targetTimestamp - Date.now();
  if (diff <= 0) return { days: 0, hours: 0, minutes: 0, seconds: 0, isLive: true };
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / 1000 / 60) % 60),
    seconds: Math.floor((diff / 1000) % 60),
    isLive: false,
  };
}

// --- DIGITAL HERO COUNTDOWN COMPONENT ---
const HeroCountdown: React.FC<HeroCountdownProps> = ({ targetDate, phase = 'future' }) => {
  const targetTimestamp = useMemo(() => {
    if (!targetDate) return 0;
    const t = typeof targetDate === 'string' ? new Date(targetDate).getTime() : targetDate.getTime();
    return isNaN(t) ? 0 : t;
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(() => computeTimeLeft(targetTimestamp));

  useEffect(() => {
    if (!targetTimestamp) return;

    const calc = () => setTimeLeft(computeTimeLeft(targetTimestamp));
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [targetTimestamp]);

  // LIVE in the resolved 'live' phase, or dynamically when the timer has counted
  // down past lights out (even if the initial page phase was 'race_day' or 'future').
  if (phase === 'live' || timeLeft.isLive) {
    return (
      <div className="inline-flex items-center gap-2.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 font-black italic px-4 py-2 rounded-md text-sm">
        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        SESSION IS LIVE ON TRACK
      </div>
    );
  }

  return (
    <div className="flex items-stretch gap-1.5 sm:gap-2.5" role="timer" aria-label="Time until the session starts">
      {[
        { val: timeLeft.days, label: 'DAYS' },
        { val: timeLeft.hours, label: 'HRS' },
        { val: timeLeft.minutes, label: 'MIN' },
        { val: timeLeft.seconds, label: 'SEC' },
      ].map((item) => (
        <div
          key={item.label}
          className="relative overflow-hidden bg-neutral-950/90 border border-neutral-800/90 hover:border-neutral-700 rounded-lg px-2.5 py-2 sm:px-4 sm:py-2.5 text-center min-w-[56px] sm:min-w-[68px] shadow-inner transition-colors"
        >
          <div className="absolute top-0 left-0 right-0 h-[2px] bg-red-600/70" aria-hidden="true" />
          <div className="font-mono font-black text-2xl sm:text-3xl text-white leading-none sm:leading-tight tabular-nums tracking-tight">
            {String(item.val).padStart(2, '0')}
          </div>
          <div className="text-[10px] tracking-wider text-neutral-400 font-bold mt-1.5 uppercase">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
};

export default HeroCountdown;
