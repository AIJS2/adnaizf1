// src/CountdownTimer.jsx - VERSI FINAL (TANPA LABEL)

import React, { useState, useEffect } from 'react';

const CountdownTimer = ({ targetDate }) => {
  const calculateTimeLeft = () => {
    const difference = +new Date(targetDate) - +new Date();
    let timeLeft = {};

    if (difference > 0) {
      // Kita tetap gunakan key ini untuk logika, tapi tidak akan menampilkannya
      timeLeft = {
        HARI: Math.floor(difference / (1000 * 60 * 60 * 24)),
        JAM: Math.floor((difference / (1000 * 60 * 60)) % 24),
        MENIT: Math.floor((difference / 1000 / 60) % 60),
        DETIK: Math.floor((difference / 1000) % 60),
      };
    }
    return timeLeft;
  };

  const [timeLeft, setTimeLeft] = useState(calculateTimeLeft());

  useEffect(() => {
    const timer = setTimeout(() => {
      setTimeLeft(calculateTimeLeft());
    }, 1000);
    return () => clearTimeout(timer);
  });

  // Jika waktu habis, tampilkan pesan live
  if (!Object.keys(timeLeft).length) {
    return <span className="text-xl font-bold text-green-400 animate-pulse">RACE IS LIVE!</span>;
  }

  // Gabungkan semua komponen jadi satu, HANYA ANGKA DAN PEMISAH
  const countdownComponents = Object.keys(timeLeft).map((interval, index) => (
    <React.Fragment key={interval}>
      {/* Angka Countdown */}
      <span className="text-2xl font-bold text-white tracking-wider font-mono">
        {String(timeLeft[interval]).padStart(2, '0')}
      </span>
      
      {/* Tampilkan pemisah ':' kecuali untuk elemen terakhir */}
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