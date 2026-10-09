import React, { useState, useEffect } from 'react';

interface HeroCountdownProps {
  targetDate: string | Date;
}

interface TimeLeft {
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
  isLive: boolean;
}

// --- DIGITAL HERO COUNTDOWN COMPONENT ---
const HeroCountdown: React.FC<HeroCountdownProps> = ({ targetDate }) => {
  const [timeLeft, setTimeLeft] = useState<TimeLeft>({ days: 0, hours: 0, minutes: 0, seconds: 0, isLive: false });

  useEffect(() => {
    const calc = () => {
      const diff = new Date(targetDate).getTime() - new Date().getTime();
      if (diff <= 0) {
        setTimeLeft({ days: 0, hours: 0, minutes: 0, seconds: 0, isLive: true });
        return;
      }
      setTimeLeft({
        days: Math.floor(diff / (1000 * 60 * 60 * 24)),
        hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
        minutes: Math.floor((diff / 1000 / 60) % 60),
        seconds: Math.floor((diff / 1000) % 60),
        isLive: false,
      });
    };
    calc();
    const interval = setInterval(calc, 1000);
    return () => clearInterval(interval);
  }, [targetDate]);

  if (timeLeft.isLive) {
    return (
      <div className="inline-flex items-center gap-2 bg-green-500/20 border border-green-500/40 text-green-400 font-black px-4 py-2 rounded-xl text-sm animate-pulse font-mono uppercase tracking-wider">
        <span className="w-2.5 h-2.5 rounded-full bg-green-400"></span>
        SESSION IS LIVE ON TRACK
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2 sm:gap-3">
      {[
        { val: timeLeft.days, label: 'DAYS' },
        { val: timeLeft.hours, label: 'HRS' },
        { val: timeLeft.minutes, label: 'MIN' },
        { val: timeLeft.seconds, label: 'SEC' },
      ].map((item, idx) => (
        <div key={idx} className="bg-neutral-900/90 border border-neutral-800 rounded-xl px-3 py-2 sm:px-4 sm:py-2.5 text-center min-w-[56px] sm:min-w-[64px] shadow-lg">
          <div className="font-mono font-black text-2xl sm:text-3xl text-white tracking-tight">
            {String(item.val).padStart(2, '0')}
          </div>
          <div className="text-[9px] uppercase tracking-widest text-neutral-500 font-extrabold mt-0.5">
            {item.label}
          </div>
        </div>
      ))}
    </div>
  );
};

export default HeroCountdown;
