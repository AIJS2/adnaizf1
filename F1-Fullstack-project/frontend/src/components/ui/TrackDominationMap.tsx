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

/** Generate visually distinct colors for teammates using HSL color space rotation */
const generateTeammateColors = (baseColor: string, teamSize: number): string[] => {
  // Convert hex to RGB
  const hex = baseColor.replace(/^#/, '');
  const r = parseInt(hex.substring(0, 2), 16) / 255;
  const g = parseInt(hex.substring(2, 4), 16) / 255;
  const b = parseInt(hex.substring(4, 6), 16) / 255;

  // Convert RGB to HSL
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h = 0, s = 0;
  const l = (max + min) / 2;

  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

    switch (max) {
      case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
      case g: h = ((b - r) / d + 2) / 6; break;
      case b: h = ((r - g) / d + 4) / 6; break;
    }
  }

  const colors: string[] = [];

  for (let i = 0; i < teamSize; i++) {
    let newH = h;
    let newS = s;
    let newL = l;

    if (i === 0) {
      // First driver: base color
      colors.push(baseColor);
    } else if (i === 1) {
      // Second driver: darker and slightly shifted hue
      newL = Math.max(0.2, l - 0.25);
      newH = (h + 0.05) % 1;
      colors.push(hslToHex(newH, newS, newL));
    } else if (i === 2) {
      // Third driver: lighter and shifted hue opposite direction
      newL = Math.min(0.8, l + 0.15);
      newS = Math.min(1, s + 0.2);
      newH = (h - 0.05 + 1) % 1;
      colors.push(hslToHex(newH, newS, newL));
    }
  }

  return colors;
};

/** Convert HSL to Hex */
const hslToHex = (h: number, s: number, l: number): string => {
  const hue2rgb = (p: number, q: number, t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1/6) return p + (q - p) * 6 * t;
    if (t < 1/2) return q;
    if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
    return p;
  };

  let r, g, b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1/3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1/3);
  }

  const toHex = (x: number) => {
    const hex = Math.round(x * 255).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  };

  return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
};

const TrackDominationMap: React.FC<TrackDominationMapProps> = ({ telemetry, drivers, driver_info, activeDistance }) => {
  const [hoveredDriver, setHoveredDriver] = React.useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState<{ x: number; y: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const xs = telemetry.map(d => d.x).filter((x): x is number => x !== undefined && !isNaN(x));
  const ys = telemetry.map(d => d.y).filter((y): y is number => y !== undefined && !isNaN(y));

  // Degenerate coordinates (all points identical — e.g. an all-zero payload
  // from a data source without position channels) would render as a single
  // dot, which reads as "broken map". Treat that as missing position data.
  const hasSpread =
    xs.length > 1 &&
    (Math.max(...xs) - Math.min(...xs) > 1 || Math.max(...ys) - Math.min(...ys) > 1);

  // No positional telemetry: render an explicit empty state rather than
  // returning null, which made the whole section disappear with no
  // explanation and left a layout hole on the page.
  if (!telemetry || telemetry.length === 0 || !hasSpread) {
    return (
      <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-lg p-6 shadow-2xl mb-8">
        <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
          <Compass size={20} className="text-red-500" /> Track Domination Map
        </h3>
        <EmptyState
          icon={Compass}
          title={EMPTY_TABLE_MESSAGES.telemetry.title}
          description="The track map is drawn from X/Y telemetry, which is published after a session finishes."
          className="min-h-[300px] rounded-lg border border-neutral-800 bg-neutral-950"
        />
      </div>
    );
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  
  const padding = 800;
  const viewBox = `${minX - padding} ${minY - padding} ${maxX - minX + padding*2} ${maxY - minY + padding*2}`;

  let activePoint: TelemetryDataPoint | null = null;
  if (activeDistance !== null) {
    activePoint = telemetry.find(d => d.distance === activeDistance) || telemetry.find(d => d.distance >= activeDistance) || null;
  }

  const driverStyles: Record<string, { color: string, strokeDasharray: string | undefined }> = {};
  const teamCounts: Record<string, number> = {};
  const teamDrivers: Record<string, string[]> = {};

  // First pass: group drivers by team
  drivers.forEach(drv => {
    const team = driver_info[drv]?.team;
    if (!teamDrivers[team]) {
      teamDrivers[team] = [];
    }
    teamDrivers[team].push(drv);
  });

  // Second pass: assign colors with smart differentiation
  drivers.forEach(drv => {
    const team = driver_info[drv]?.team;
    if (!teamCounts[team]) teamCounts[team] = 0;

    const index = teamCounts[team];
    const teamSize = teamDrivers[team]?.length || 1;
    teamCounts[team]++;

    // Get base team color
    const baseColor = teamColors[team] || '#ffffff';

    let color: string;
    let strokeDasharray: string | undefined = undefined;

    if (teamSize === 1) {
      // Single driver from this team - use base color
      color = baseColor;
    } else {
      // Multiple drivers from same team - generate distinct colors
      const teammateColors = generateTeammateColors(baseColor, teamSize);
      color = teammateColors[index] || baseColor;

      // Also add dash pattern for extra differentiation
      if (index === 1) strokeDasharray = "8 6"; // Medium dash
      else if (index === 2) strokeDasharray = "4 4"; // Short dash
    }

    driverStyles[drv] = {
      color,
      strokeDasharray
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

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!svgRef.current) return;
    const rect = svgRef.current.getBoundingClientRect();
    setTooltipPos({
      x: e.clientX - rect.left,
      y: e.clientY - rect.top
    });
  };

  const handleMouseLeave = () => {
    setHoveredDriver(null);
    setTooltipPos(null);
  };

  return (
    <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-lg p-6 shadow-2xl mb-8">
      <h3 className="text-xl font-bold mb-4 text-white flex items-center gap-2">
        <Compass size={20} className="text-red-500" /> Track Domination Map
      </h3>
      <p className="text-xs text-neutral-400 mb-4 font-medium">
        Color-coded segments show which driver was fastest at each part of the track
      </p>
      <div
        className="w-full h-[400px] bg-gradient-to-br from-neutral-950 to-neutral-900 rounded-lg p-4 flex items-center justify-center overflow-hidden border border-neutral-800/50 relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg ref={svgRef} viewBox={viewBox} className="w-full h-full" style={{ transform: 'scale(1, -1)' }}>
          {/* Background track outline */}
          <polyline
            points={allPoints}
            stroke="#1a1a1a"
            strokeWidth={120}
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />

          {/* Domination segments */}
          {polylines.map((line, i) => {
            const style = driverStyles[line.driver] || { color: '#ffffff', strokeDasharray: undefined };
            const isHovered = hoveredDriver === line.driver;
            const isDimmed = hoveredDriver && hoveredDriver !== line.driver;

            return (
              <g
                key={i}
                style={{ cursor: 'pointer' }}
                onMouseEnter={() => setHoveredDriver(line.driver)}
              >
                {/* Shadow/glow effect */}
                <polyline
                  points={line.points.join(' ')}
                  stroke={style.color}
                  strokeWidth={isHovered ? 120 : 100}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={isDimmed ? 0.1 : isHovered ? 0.5 : 0.3}
                  filter="blur(4px)"
                  style={{ transition: 'all 0.2s ease' }}
                />
                {/* Main colored line */}
                <polyline
                  points={line.points.join(' ')}
                  stroke={style.color}
                  strokeWidth={isHovered ? 95 : 85}
                  strokeDasharray={style.strokeDasharray}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={isDimmed ? 0.2 : 1}
                  style={{ transition: 'all 0.2s ease' }}
                />
              </g>
            );
          })}

          {/* Active cursor position */}
          {activePoint && activePoint.x !== undefined && activePoint.y !== undefined && (
            <g>
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={120}
                fill={driverStyles[activePoint.dominant_driver ?? '']?.color || '#ffffff'}
                opacity={0.3}
              />
              <circle
                cx={activePoint.x}
                cy={activePoint.y}
                r={80}
                fill="#ffffff"
                stroke="#000000"
                strokeWidth={20}
              />
            </g>
          )}
        </svg>

        {/* Tooltip overlay */}
        {hoveredDriver && tooltipPos && (
          <div
            className="absolute pointer-events-none z-50"
            style={{
              left: tooltipPos.x + 16,
              top: tooltipPos.y - 40,
              transform: 'translateY(-50%)'
            }}
          >
            <div
              className="px-4 py-2 rounded-full border-2 shadow-2xl backdrop-blur-xl animate-in fade-in zoom-in duration-150"
              style={{
                backgroundColor: 'rgba(10, 10, 10, 0.95)',
                borderColor: driverStyles[hoveredDriver]?.color || '#ffffff'
              }}
            >
              <div className="flex items-center gap-2">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ backgroundColor: driverStyles[hoveredDriver]?.color || '#ffffff' }}
                />
                <div className="flex flex-col">
                  <span className="text-sm font-black text-white leading-none">
                    {hoveredDriver}
                  </span>
                  <span className="text-[11px] text-neutral-400 font-medium leading-none mt-0.5">
                    {driver_info[hoveredDriver]?.name || driver_info[hoveredDriver]?.team}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
      <div className="flex flex-wrap justify-center gap-6 mt-6">
        {drivers.map(drv => {
          const style = driverStyles[drv] || { color: '#ffffff', strokeDasharray: undefined };
          const info = driver_info[drv];
          const teamColor = teamColors[info?.team ?? ''] || '#888888';
          const isActive = hoveredDriver === drv;

          return (
            <div
              key={drv}
              className="flex items-center gap-3 bg-neutral-900/80 border rounded-full px-4 py-2 transition-ui cursor-pointer"
              style={{
                borderColor: isActive ? style.color : teamColor,
                transform: isActive ? 'scale(1.1)' : 'scale(1)',
                boxShadow: isActive ? `0 0 20px ${style.color}40` : 'none'
              }}
              onMouseEnter={() => setHoveredDriver(drv)}
              onMouseLeave={() => setHoveredDriver(null)}
            >
              <svg width="36" height="10" viewBox="0 0 36 10">
                <line
                  x1="0"
                  y1="5"
                  x2="36"
                  y2="5"
                  stroke={style.color}
                  strokeWidth={isActive ? "8" : "6"}
                  strokeLinecap="round"
                  strokeDasharray={style.strokeDasharray}
                />
              </svg>
              <div className="flex flex-col">
                <span className="text-sm font-black text-white">{drv}</span>
                {info?.team && <span className="text-[11px] text-neutral-400 font-medium">{info.team}</span>}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default TrackDominationMap;
