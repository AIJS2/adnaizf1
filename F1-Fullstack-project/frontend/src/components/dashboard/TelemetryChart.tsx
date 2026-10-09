import React from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';

interface TelemetryChartProps {
  title: string;
  icon: React.ReactNode;
  data: Record<string, unknown>[];
  dataKeys: string;
  domain: [number | string, number | string];
  drivers: string[];
  driverStyles: Record<string, { color: string; strokeDasharray?: string }>;
  setActiveDistance: (distance: number | null) => void;
}

interface CustomTooltipProps {
  active?: boolean;
  payload?: { name: string; value: number | string; dataKey: string }[];
  label?: string;
  driverStyles: Record<string, { color: string; strokeDasharray?: string }>;
}

const CustomTooltip: React.FC<CustomTooltipProps> = ({ active, payload, label, driverStyles }) => {
  if (active && payload && payload.length) {
    return (
      <div className="bg-neutral-955/95 backdrop-blur-md border border-neutral-700 p-4 rounded-xl shadow-2xl min-w-[200px]">
        <p className="text-neutral-400 text-xs font-bold mb-3 border-b border-neutral-800 pb-2">Distance: {label}m</p>
        {payload.map((entry, index: number) => {
          const drv = entry.name;
          const style = driverStyles[drv] || { color: '#fff' };
          return (
            <div key={index} className="flex justify-between items-center mb-1 text-sm font-mono">
              <span className="font-bold flex items-center gap-2">
                <svg width="16" height="8" viewBox="0 0 16 8">
                  <line x1="0" y1="4" x2="16" y2="4" stroke={style.color} strokeWidth="3" strokeDasharray={style.strokeDasharray} />
                </svg>
                <span className="text-white">{drv}</span>
              </span>
              <span className="text-neutral-300 font-bold ml-4">
                {Number(entry.value).toFixed(1)} {entry.dataKey.startsWith('speed') ? 'km/h' : entry.dataKey.startsWith('delta') ? 's' : '%'}
              </span>
            </div>
          );
        })}
      </div>
    );
  }
  return null;
};

const TelemetryChart: React.FC<TelemetryChartProps> = ({
  title,
  icon,
  data,
  dataKeys,
  domain,
  drivers,
  driverStyles,
  setActiveDistance
}) => {
  return (
    <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 shadow-2xl">
      <h3 className="text-xl font-bold mb-6 text-white flex items-center gap-2">
        {icon} {title}
      </h3>
      <div className="h-[300px]">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart 
            data={data} 
            margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
            onMouseMove={(chartState: { activeLabel?: number } | null | undefined) => {
              if (chartState && chartState.activeLabel !== undefined) {
                setActiveDistance(chartState.activeLabel);
              }
            }}
            onMouseLeave={() => setActiveDistance(null)}
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#222" vertical={false} />
            <XAxis dataKey="distance" stroke="#666" tick={{fill: '#888', fontSize: 11}} tickLine={false} axisLine={false} minTickGap={50} />
            <YAxis domain={domain} stroke="#666" tick={{fill: '#888', fontSize: 11}} tickLine={false} axisLine={false} width={40} />
            <RechartsTooltip content={<CustomTooltip driverStyles={driverStyles} />} />
            <Legend verticalAlign="top" height={36} iconType="plainline" wrapperStyle={{ fontSize: '12px', fontWeight: 'bold' }} />
            
            {drivers.map(drv => {
              const dataKey = dataKeys.replace('{drv}', drv);
              if (dataKeys.startsWith('delta') && drv === drivers[0]) return null;
              
              const style = driverStyles[drv] || { color: '#fff' };
              return (
                <Line 
                  key={drv}
                  type="monotone" 
                  dataKey={dataKey} 
                  name={drv}
                  stroke={style.color}
                  strokeWidth={2}
                  strokeDasharray={style.strokeDasharray}
                  dot={false}
                  activeDot={{ r: 4, strokeWidth: 0 }}
                  isAnimationActive={false}
                />
              );
            })}
            {dataKeys.startsWith('delta') && <ReferenceLine y={0} stroke="#444" strokeDasharray="3 3" />}
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default TelemetryChart;
