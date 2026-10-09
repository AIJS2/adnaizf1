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
    return <span className="text-xl font-bold text-green-400 animate-pulse">RACE IS LIVE!</span>;
  }

  const timeKeys = Object.keys(timeLeft) as Array<keyof TimeLeft>;

  const countdownComponents = timeKeys.map((interval, index) => (
    <React.Fragment key={interval}>
      <span className="text-2xl font-bold text-white tracking-wider font-mono">
        {String(timeLeft[interval] ?? 0).padStart(2, '0')}
      </span>
      {index < timeKeys.length - 1 && (
        <span className="text-xl font-bold text-neutral-600 mx-4">:</span>
      )}
    </React.Fragment>
  ));

  return (
    <div className="flex items-center justify-center">
      {countdownComponents}
    </div>
  );
};

export default CountdownTimer;
