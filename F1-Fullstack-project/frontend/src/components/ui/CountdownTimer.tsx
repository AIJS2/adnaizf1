// src/components/ui/CountdownTimer.tsx

import React, { useState, useEffect, useCallback } from 'react';

interface CountdownTimerProps {
  targetDate: string | Date;
}

interface TimeLeft {
  HARI?: number;
  JAM?: number;
  MENIT?: number;
  DETIK?: number;
}

const CountdownTimer: React.FC<CountdownTimerProps> = ({ targetDate }) => {
  const calculateTimeLeft = useCallback((): TimeLeft => {
    const target = new Date(targetDate).getTime();
    const now = new Date().getTime();
    const difference = target - now;

    if (isNaN(difference) || difference <= 0) return {};

    return {
      HARI:  Math.floor(difference / (1000 * 60 * 60 * 24)),
      JAM:   Math.floor((difference / (1000 * 60 * 60)) % 24),
      MENIT: Math.floor((difference / 1000 / 60) % 60),
      DETIK: Math.floor((difference / 1000) % 60),
    };
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState<TimeLeft>(calculateTimeLeft());

  useEffect(() => {
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    return () => clearInterval(timer);
  }, [calculateTimeLeft]);

  if (!Object.keys(timeLeft).length) {
    return (
      <span className="inline-flex items-center gap-2 text-lg font-black italic text-emerald-400">
        <span className="relative flex h-2.5 w-2.5" aria-hidden="true">
          <span className="absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-60 motion-safe:animate-ping" />
          <span className="relative inline-flex h-2.5 w-2.5 rounded-full bg-emerald-400" />
        </span>
        RACE IS LIVE!
      </span>
    );
  }

  const timeKeys = Object.keys(timeLeft) as Array<keyof TimeLeft>;

  return (
    <div className="flex items-start gap-1 sm:gap-2" role="timer" aria-label="Time until the next session">
      {timeKeys.map((interval, index) => (
        <React.Fragment key={interval}>
          <div className="flex flex-col items-center min-w-11 sm:min-w-14">
            <span className="text-3xl sm:text-4xl font-black text-chalk leading-none sm:leading-10 tabular-nums">
              {String(timeLeft[interval] ?? 0).padStart(2, '0')}
            </span>
            <span className="mt-1.5 text-[11px] font-semibold text-neutral-500" aria-hidden="true">
              {UNIT_LABEL[interval]}
            </span>
          </div>
          {index < timeKeys.length - 1 && (
            <span className="text-2xl sm:text-3xl font-light leading-none sm:leading-9 text-neutral-700" aria-hidden="true">:</span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

const UNIT_LABEL: Record<keyof TimeLeft, string> = { HARI: 'days', JAM: 'hrs', MENIT: 'min', DETIK: 'sec' };

export default CountdownTimer;
