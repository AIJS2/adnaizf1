import React, { useState } from 'react';
import { Trophy, Clock, Flag, AlertTriangle, Target, Zap, Activity, Navigation, Thermometer, Droplets, CloudRain } from 'lucide-react';
import { teamColors } from '../../data/teamData';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const LapChartComponent = ({ lapChart, results }) => {
  const sample = lapChart && lapChart[0] ? lapChart[0] : {};
  const activeKeys = Object.keys(sample).filter(k => k !== 'lap');

  const driverMeta = {};
  if (results) {
    results.forEach(r => {
      const parts = (r.full_name || '').split(' ');
      const last = parts[parts.length - 1] || '';
      const fallbackAbbr = last.slice(0, 3).toUpperCase();
      const abbr = r.abbreviation || fallbackAbbr;
      driverMeta[abbr] = {
        name: r.full_name,
        team: r.team_name,
        color: teamColors[r.team_name] || '#888888'
      };
    });
  }

  const [selectedDrivers, setSelectedDrivers] = useState(activeKeys);

  const toggleDriver = (drv) => {
    if (selectedDrivers.includes(drv)) {
      if (selectedDrivers.length > 1) {
        setSelectedDrivers(selectedDrivers.filter(d => d !== drv));
      }
    } else {
      setSelectedDrivers([...selectedDrivers, drv]);
    }
  };

  const selectTop10 = () => setSelectedDrivers(activeKeys.slice(0, 10));
  const selectAll = () => setSelectedDrivers(activeKeys);
  const clearAll = () => setSelectedDrivers([]);

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500 tracking-tight">
            Lap-by-Lap Position Chart
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Track positional changes, overtakes, and pit stops from Lap 1 to {lapChart.length}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={selectTop10}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-lg text-neutral-300 transition-colors"
          >
            Top 10
          </button>
          <button 
            onClick={selectAll}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-lg text-neutral-300 transition-colors"
          >
            All
          </button>
          <button 
            onClick={clearAll}
            className="px-3 py-1.5 bg-red-900/30 hover:bg-red-900/50 border border-red-500/30 text-xs font-bold rounded-lg text-red-400 transition-colors"
          >
            Clear
          </button>
        </div>
      </div>

      {/* Driver Toggle Pills */}
      <div className="flex flex-wrap gap-2 mb-6 max-h-28 overflow-y-auto p-2 bg-neutral-950/60 rounded-xl border border-neutral-800">
        {activeKeys.map(drv => {
          const isSelected = selectedDrivers.includes(drv);
          const meta = driverMeta[drv];
          const color = meta?.color || '#888888';
          return (
            <button
              key={drv}
              onClick={() => toggleDriver(drv)}
              className={`px-2.5 py-1 rounded-lg text-xs font-mono font-bold transition-all flex items-center gap-1.5 border ${
                isSelected 
                  ? 'bg-neutral-900 text-white border-neutral-600 shadow' 
                  : 'bg-transparent text-neutral-500 border-neutral-800 opacity-50 hover:opacity-100'
              }`}
            >
              <span className="w-2 h-2 rounded-full" style={{ backgroundColor: color }} />
              {drv}
            </button>
          );
        })}
      </div>

      {/* Recharts LineChart with Y reversed so P1 is at top */}
      <div className="h-[460px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lapChart} margin={{ top: 10, right: 20, left: -10, bottom: 20 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis 
              dataKey="lap" 
              stroke="#666" 
              tick={{ fill: '#888', fontSize: 11 }} 
              tickLine={false} 
              axisLine={false} 
              label={{ value: 'Race Lap Number', position: 'insideBottom', fill: '#666', fontSize: 11, offset: -10 }}
            />
            <YAxis 
              domain={[1, 20]} 
              reversed={true} 
              ticks={[1, 3, 5, 10, 15, 20]}
              tickFormatter={(v) => `P${v}`}
              stroke="#666" 
              tick={{ fill: '#888', fontSize: 11 }} 
              tickLine={false} 
              axisLine={false} 
            />
            <RechartsTooltip 
              contentStyle={{ backgroundColor: 'rgba(15,15,15,0.95)', border: '1px solid #333', borderRadius: '12px', color: '#fff' }}
              labelFormatter={(lbl) => `Lap ${lbl}`}
              formatter={(val, name) => [`P${val}`, name]}
            />
            {selectedDrivers.map(drv => {
              const meta = driverMeta[drv];
              const color = meta?.color || '#EF4444';
              return (
                <Line
                  key={drv}
                  type="linear"
                  dataKey={drv}
                  name={meta?.name || drv}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 5, stroke: '#fff', strokeWidth: 1.5 }}
                  connectNulls={true}
                />
              );
            })}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};
export default LapChartComponent;
