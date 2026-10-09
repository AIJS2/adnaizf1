// src/CountdownTimer.jsx - FIXED: useEffect dengan interval yang benar

import React, { useState, useEffect, useCallback } from 'react';

const CountdownTimer = ({ targetDate }) => {
  const calculateTimeLeft = useCallback(() => {
    const target = new Date(targetDate).getTime();
    const now = new Date().getTime();
    const difference = target - now;

    if (difference <= 0) return {};

    return {
      HARI:  Math.floor(difference / (1000 * 60 * 60 * 24)),
      JAM:   Math.floor((difference / (1000 * 60 * 60)) % 24),
      MENIT: Math.floor((difference / 1000 / 60) % 60),
      DETIK: Math.floor((difference / 1000) % 60),
    };
  }, [targetDate]);

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    // Gunakan setInterval agar update tiap detik tanpa re-render chain
    const timer = setInterval(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);

    // Cleanup interval saat komponen di-unmount
    return () => clearInterval(timer);
  }, [calculateTimeLeft]); // dependency array yang benar

  if (!Object.keys(timeLeft).length) {
    return <span className="text-xl font-bold text-green-400 animate-pulse">RACE IS LIVE!</span>;
  }

  const countdownComponents = Object.keys(timeLeft).map((interval, index) => (
    <React.Fragment key={interval}>
      <span className="text-2xl font-bold text-white tracking-wider font-mono">
        {String(timeLeft[interval]).padStart(2, '0')}
      </span>
      {index < Object.keys(timeLeft).length - 1 && (
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
