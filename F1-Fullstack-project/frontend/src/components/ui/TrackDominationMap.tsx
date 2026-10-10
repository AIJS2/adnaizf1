import React from 'react';
import { Compass } from 'lucide-react';
import EmptyState, { EMPTY_TABLE_MESSAGES } from './EmptyState';
import { TelemetryDataPoint, TeamDriverInfo } from '../../types/f1';
import { teamColors } from '../../data/teamData';

interface TrackDominationMapProps {
  telemetry: TelemetryDataPoint[];
  drivers: string[];
  driver_info: Record<string, TeamDriverInfo>;
  activeDistance: number | null;
}

const adjustColor = (col: string, amt: number): string => {
  if (!col) return '#ffffff';
  let color = col.replace(/^#/, '');
  if (color.length === 3) color = color[0]+color[0]+color[1]+color[1]+color[2]+color[2];
  const num = parseInt(color, 16);
  let r = (num >> 16) + amt;
  let b = ((num >> 8) & 0x00FF) + amt;
  let g = (num & 0x0000FF) + amt;
  r = Math.max(Math.min(255, r), 0);
  b = Math.max(Math.min(255, b), 0);
  g = Math.max(Math.min(255, g), 0);
  return '#' + (g | (b << 8) | (r << 16)).toString(16).padStart(6, '0');
};

const TrackDominationMap: React.FC<TrackDominationMapProps> = ({ telemetry, drivers, driver_info, activeDistance }) => {
  const xs = telemetry.map(d => d.x).filter((x): x is number => x !== undefined && !isNaN(x));
  const ys = telemetry.map(d => d.y).filter((y): y is number => y !== undefined && !isNaN(y));

  // No positional telemetry: render an explicit empty state rather than
  // returning null, which made the whole section disappear with no
  // explanation and left a layout hole on the page.
  if (!telemetry || telemetry.length === 0 || xs.length === 0 || ys.length === 0) {
    return (
      <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 shadow-2xl mb-8">
        <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
          <Compass size={20} className="text-red-500" /> Track Domination Map
        </h3>
        <EmptyState
          icon={Compass}
          title={EMPTY_TABLE_MESSAGES.telemetry.title}
          description="The track map is drawn from X/Y telemetry, which is published after a session finishes."
          className="min-h-[300px] rounded-2xl border border-neutral-800 bg-neutral-950"
        />
      </div>
    );
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  const padding = 1000;
  const viewBox = `${minX - padding} ${minY - padding} ${maxX - minX + padding*2} ${maxY - minY + padding*2}`;

  let activePoint: TelemetryDataPoint | null = null;
  if (activeDistance !== null) {
    activePoint = telemetry.find(d => d.distance === activeDistance) || telemetry.find(d => d.distance >= activeDistance) || null;
  }

  const driverStyles: Record<string, { color: string, strokeDasharray: string | undefined }> = {};
  const teamCounts: Record<string, number> = {};
  
  drivers.forEach(drv => {
    const team = driver_info[drv]?.team;
    if (!teamCounts[team]) teamCounts[team] = 0;
    
    const index = teamCounts[team];
    teamCounts[team]++;
    
    let color = teamColors[team] || '#ffffff';
    if (index === 1) color = adjustColor(color, -60);
    else if (index === 2) color = adjustColor(color, 60);
    
    driverStyles[drv] = {
      color,
      strokeDasharray: undefined
    };
  });

  const polylines: { driver: string; points: string[] }[] = [];
  let currentLine: { driver: string; points: string[] } | null = null;
  
  telemetry.forEach((d) => {
    if (d.x === undefined || d.y === undefined || isNaN(d.x) || isNaN(d.y)) return;
    const dominant = d.dominant_driver;
    
    if (!dominant) return;

    if (!currentLine || currentLine.driver !== dominant) {
      if (currentLine) {
        currentLine.points.push(`${d.x},${d.y}`);
        polylines.push(currentLine);
      }
      currentLine = {
        driver: dominant,
        points: [`${d.x},${d.y}`]
      };
    } else {
      currentLine.points.push(`${d.x},${d.y}`);
    }
  });
  if (currentLine) polylines.push(currentLine);

  const allPoints = telemetry
    .filter(d => d.x !== undefined && d.y !== undefined && !isNaN(d.x) && !isNaN(d.y))
    .map(d => `${d.x},${d.y}`)
    .join(' ');

  return (
    <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 shadow-2xl mb-8">
      <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
        <Compass size={20} className="text-red-500" /> Track Domination Map
      </h3>
      <div className="w-full h-[400px] bg-neutral-950 rounded-2xl p-4 flex items-center justify-center overflow-hidden">
        <svg viewBox={viewBox} className="w-full h-full" style={{ transform: 'scale(1, -1)' }}>
          <polyline 
            points={allPoints}
            stroke="#2a2a2a"
            strokeWidth={500}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
          {polylines.map((line, i) => {
            const style = driverStyles[line.driver] || { color: '#ffffff', strokeDasharray: undefined };
            return (
              <polyline 
                key={i}
                points={line.points.join(' ')}
                stroke={style.color}
                strokeWidth={500}
                strokeDasharray={style.strokeDasharray}
                strokeLinecap="round"
                strokeLinejoin="round"
                fill="none"
              />
            );
          })}
          {activePoint && activePoint.x !== undefined && activePoint.y !== undefined && (
            <circle 
              cx={activePoint.x} 
              cy={activePoint.y} 
              r={300} 
              fill="#ffffff" 
              stroke="#000000"
              strokeWidth={100}
            />
          )}
        </svg>
      </div>
      <div className="flex flex-wrap justify-center gap-4 mt-4 text-sm font-bold">
        {drivers.map(drv => {
          const style = driverStyles[drv] || { color: '#ffffff' };
          return (
            <div key={drv} className="flex items-center gap-2">
              <svg width="24" height="12" viewBox="0 0 24 12">
                <line x1="0" y1="6" x2="24" y2="6" stroke={style.color} strokeWidth="4" />
              </svg>
              {drv}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrackDominationMap;
