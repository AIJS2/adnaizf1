import React from 'react';
import { Disc } from 'lucide-react';

export default function TyreStrategy({ timingData }) {
  const getTyreColor = (compound) => {
    if (compound === 'S') return 'bg-red-500';
    if (compound === 'M') return 'bg-yellow-400';
    if (compound === 'H') return 'bg-white';
    if (compound === 'I') return 'bg-green-500';
    if (compound === 'W') return 'bg-blue-500';
    return 'bg-gray-500';
  };

  const getTyreLife = (compound, age) => {
    let maxLife = 30;
    if (compound === 'S') maxLife = 25;
    if (compound === 'M') maxLife = 40;
    if (compound === 'H') maxLife = 60;
    if (compound === 'I') maxLife = 40;
    if (compound === 'W') maxLife = 50;

    const wear = Math.min((age / maxLife) * 100, 100);
    const lifeLeft = 100 - wear;
    return lifeLeft;
  };

  const topDrivers = (timingData || []).slice(0, 5);

  return (
    <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-5 shadow-xl relative overflow-hidden flex flex-col">
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent"></div>
      
      <h3 className="text-[10px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-4">
        <Disc size={14} className="text-neutral-400" /> Tyre Wear & Strategy
      </h3>

      <div className="space-y-3">
        {topDrivers.length > 0 ? topDrivers.map((driver) => {
          const lifeLeft = getTyreLife(driver.tyre, driver.tyre_age);
          const colorClass = getTyreColor(driver.tyre);
          
          return (
            <div key={driver.driver} className="flex flex-col gap-1.5">
              <div className="flex justify-between items-center text-[10px] font-black uppercase">
                <span className="text-white flex items-center gap-2">
                  {driver.driver} 
                  <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[9px] ${colorClass} ${driver.tyre === 'M' || driver.tyre === 'H' ? 'text-black' : 'text-white'}`}>
                    {driver.tyre}
                  </span>
                </span>
                <span className={lifeLeft < 20 ? 'text-red-500 animate-pulse' : 'text-neutral-400'}>
                  {driver.tyre_age} Laps ({Math.round(lifeLeft)}%)
                </span>
              </div>
              
              <div className="w-full bg-[#111] h-1.5 rounded-full overflow-hidden border border-[#222]">
                <div 
                  className={`h-full rounded-full transition-all duration-1000 ${colorClass}`}
                  style={{ width: `${lifeLeft}%`, opacity: lifeLeft < 20 ? 0.6 : 1 }}
                ></div>
              </div>
            </div>
          );
        }) : (
          <div className="text-neutral-600 text-xs text-center py-4">Waiting for telemetry...</div>
        )}
      </div>
    </div>
  );
}
