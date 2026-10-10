import React, { useState } from 'react';
import { teamColors } from '../../data/teamData';
import { RaceResultEntry, RaceSeriesPoint } from '../../types/f1';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import { LineChart as LineChartIcon } from 'lucide-react';
import EmptyState, { EMPTY_TABLE_MESSAGES } from '../ui/EmptyState';
import { formatLapTime, hasItems, toNumber } from '../../utils/data';

interface DriverMeta {
  name: string;
  team: string;
  color: string;
}

interface LapTimesChartProps {
  lapTimesChart?: RaceSeriesPoint[];
  results?: RaceResultEntry[];
}

const LapTimesChartComponent: React.FC<LapTimesChartProps> = ({ lapTimesChart, results }) => {
  const sample: RaceSeriesPoint | Record<string, unknown> = lapTimesChart && lapTimesChart[0] ? lapTimesChart[0] : {};
  const activeKeys = Object.keys(sample).filter(k => k !== 'lap');

  const driverMeta: Record<string, DriverMeta> = {};
  if (results) {
    results.forEach((r: RaceResultEntry) => {
      const parts = String(r.full_name || '').split(' ');
      const last = parts[parts.length - 1] || '';
      const fallbackAbbr = last.slice(0, 3).toUpperCase();
      const abbr = String(r.abbreviation || fallbackAbbr);
      const team = String(r.team_name || '');
      driverMeta[abbr] = {
        name: String(r.full_name || abbr),
        team,
        color: teamColors[team] || '#888888'
      };
    });
  }

  const [selectedDrivers, setSelectedDrivers] = useState(activeKeys);
  const [filterOutliers, setFilterOutliers] = useState(true);

  const toggleDriver = (drv: string) => {
    if (selectedDrivers.includes(drv)) {
      if (selectedDrivers.length > 1) {
        setSelectedDrivers(selectedDrivers.filter(d => d !== drv));
      }
    } else {
      setSelectedDrivers([...selectedDrivers, drv]);
    }
  };

  const selectTop5 = () => setSelectedDrivers(activeKeys.slice(0, 5));
  const selectAll = () => setSelectedDrivers(activeKeys);


  // Calculate domain manually to avoid Recharts domain function crash.
  // safeMax/safeMin never return Infinity, which would silently break the
  // axis when the payload is empty or every value is non-numeric.
  let yDomain: [number | string, number | string] = ['dataMin', 'dataMax'];
  if (filterOutliers && hasItems(lapTimesChart)) {
    const values: number[] = [];
    lapTimesChart.forEach((row: RaceSeriesPoint) => {
      selectedDrivers.forEach(drv => {
        const v = toNumber(row[drv], NaN);
        if (Number.isFinite(v)) values.push(v);
      });
    });
    const minTime = values.length ? Math.min(...values) : NaN;
    if (Number.isFinite(minTime)) {
      yDomain = [minTime, minTime * 1.15];
    }
  }

  // No lap times recorded yet -> empty state instead of an empty chart frame.
  if (!hasItems(lapTimesChart) || activeKeys.length === 0) {
    return (
      <div className="p-6">
        <EmptyState
          icon={LineChartIcon}
          title={EMPTY_TABLE_MESSAGES.charts.title}
          description="Lap-time analysis needs completed laps, which become available once the session has run."
          className="min-h-[400px] rounded-2xl border border-neutral-800 bg-neutral-900/30"
        />
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4 mb-6">
        <div>
          <h3 className="text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-500 tracking-tight">
            Lap Analysis (Lap Times)
          </h3>
          <p className="text-xs text-neutral-400 mt-1">
            Analyze individual lap times and pace consistency across the race
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button 
            onClick={() => setFilterOutliers(!filterOutliers)}
            className={`px-3 py-1.5 text-xs font-bold rounded-lg transition-colors flex items-center gap-2 border ${filterOutliers ? 'bg-blue-900/40 text-blue-400 border-blue-500/30' : 'bg-neutral-800 text-neutral-400 border-neutral-700'}`}
            title="Filter out slow laps (e.g. pit stops) to zoom in on normal race pace"
          >
            {filterOutliers ? '🔍 Zoomed In (Race Pace)' : '📉 Show All (Inc. Pit Stops)'}
          </button>
          <div className="w-px h-6 bg-neutral-800 mx-1"></div>
          <button 
            onClick={selectTop5}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-lg text-neutral-300 transition-colors"
          >
            Top 5
          </button>
          <button 
            onClick={selectAll}
            className="px-3 py-1.5 bg-neutral-800 hover:bg-neutral-700 text-xs font-bold rounded-lg text-neutral-300 transition-colors"
          >
            All Drivers
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

      <div className="h-[460px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={lapTimesChart ?? []} margin={{ top: 10, right: 20, left: 10, bottom: 20 }}>
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
              domain={yDomain}
              allowDataOverflow={true}
              tickFormatter={formatLapTime}
              stroke="#666" 
              tick={{ fill: '#888', fontSize: 11 }} 
              tickLine={false} 
              axisLine={false} 
            />
            <RechartsTooltip 
              contentStyle={{ backgroundColor: 'rgba(15,15,15,0.95)', border: '1px solid #333', borderRadius: '12px', color: '#fff' }}
              labelFormatter={(lbl) => `Lap ${lbl}`}
              formatter={(val) => [formatLapTime(val as number | string), String(name)]}
            />
            {selectedDrivers.map(drv => {
              const meta = driverMeta[drv];
              const color = meta?.color || '#EF4444';
              return (
                <Line
                  key={drv}
                  type="monotone"
                  dataKey={drv}
                  name={meta?.name || drv}
                  stroke={color}
                  strokeWidth={2}
                  dot={false}
                  activeDot={{ r: 4 }}
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
export default LapTimesChartComponent;
