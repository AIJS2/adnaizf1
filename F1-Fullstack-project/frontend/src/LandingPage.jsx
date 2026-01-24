// src/LandingPage.jsx - VERSI YANG DIPERBAIKI

import React from 'react';

function LandingPage() {
  return (
    // ✅ PERUBAHAN DI SINI: Kelas `overflow-hidden` sudah dihapus
    <div className="relative min-h-screen bg-black flex flex-col items-center justify-center text-white p-4">
      <div className="relative z-10 text-center max-w-4xl mx-auto">
        
        <h1 className="text-5xl md:text-8xl font-extrabold mb-4 tracking-tighter leading-tight uppercase">
          <span>Analyze</span> <span>The</span> <span className="text-red-600">Apex</span>
        </h1>
        
        <div className="mt-10">
          <p className="text-lg md:text-xl text-gray-300 max-w-2xl mx-auto">
            Unleash the power of data. Real-time analytics for the true Formula 1 strategist.
          </p>
        </div>

        <div className="mt-10">
          {/* Ganti href="#" dengan path yang sesuai, misalnya "/dashboard" */}
          <a 
            href="/dashboard" 
            className="bg-red-600 hover:bg-red-700 text-white font-bold py-4 px-8 rounded-lg text-lg uppercase tracking-wider transition-all duration-300"
          >
            Enter The Paddock
          </a>
        </div>
      </div>
    </div>
  );
}

export default LandingPage;