import React from 'react';
import { Compass } from 'lucide-react';
import EmptyState, { EMPTY_TABLE_MESSAGES } from './EmptyState';
import { TelemetryDataPoint, TeamDriverInfo } from '../../types/f1';
import { teamColors, DRIVER_TEAM_COLORS_2026, getDriverColor } from '../../data/teamData';
import { getCircuitGeometry, sampleCircuitPosition, CircuitLookup } from '../../data/circuitPaths';

export interface TrackDominationMapProps {
  telemetry: TelemetryDataPoint[];
  drivers: string[];
  driver_info: Record<string, TeamDriverInfo>;
  activeDistance: number | null;
  circuitInfo?: CircuitLookup | null;
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

const TrackDominationMap: React.FC<TrackDominationMapProps> = ({
  telemetry,
  drivers,
  driver_info,
  activeDistance,
  circuitInfo,
}) => {
  const [hoveredDriver, setHoveredDriver] = React.useState<string | null>(null);
  const [tooltipPos, setTooltipPos] = React.useState<{ x: number; y: number } | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);

  const circuitGeom = React.useMemo(() => {
    return getCircuitGeometry(circuitInfo);
  }, [circuitInfo]);

  // Project or sample telemetry points onto canonical circuit geometry
  const mappedTelemetry = React.useMemo(() => {
    if (!telemetry || telemetry.length === 0) return [];
    if (!circuitGeom) return telemetry;

    const maxDist = Math.max(...telemetry.map(d => d.distance || 0), 1);
    return telemetry.map(d => {
      const dist = d.distance ?? 0;
      const normD = Math.max(0, Math.min(1, dist / maxDist));
      const pt = sampleCircuitPosition(circuitGeom, normD);
      return {
        ...d,
        x: pt.x,
        y: pt.y,
      };
    });
  }, [telemetry, circuitGeom]);

  const refXs = React.useMemo(() => {
    if (circuitGeom && circuitGeom.points.length > 0) {
      return circuitGeom.points.map(p => p.x);
    }
    return mappedTelemetry.map(d => d.x).filter((x): x is number => x !== undefined && !isNaN(x));
  }, [circuitGeom, mappedTelemetry]);

  const refYs = React.useMemo(() => {
    if (circuitGeom && circuitGeom.points.length > 0) {
      return circuitGeom.points.map(p => p.y);
    }
    return mappedTelemetry.map(d => d.y).filter((y): y is number => y !== undefined && !isNaN(y));
  }, [circuitGeom, mappedTelemetry]);

  // Degenerate coordinates check
  const hasSpread =
    refXs.length > 1 &&
    (Math.max(...refXs) - Math.min(...refXs) > 1 || Math.max(...refYs) - Math.min(...refYs) > 1);

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

  const minX = Math.min(...refXs);
  const maxX = Math.max(...refXs);
  const minY = Math.min(...refYs);
  const maxY = Math.max(...refYs);

  const trackWidth  = maxX - minX;
  const trackHeight = maxY - minY;
  const maxDim      = Math.max(trackWidth, trackHeight, 1);
  const padding     = maxDim * 0.08;
  const viewBox     = `${minX - padding} ${minY - padding} ${trackWidth + padding * 2} ${trackHeight + padding * 2}`;

  const baseStrokeWidth = Math.max(12, maxDim * 0.015);
  const glowStrokeWidth = baseStrokeWidth * 1.15;
  const flipY = (y: number) => maxY + minY - y;

  let activePoint: TelemetryDataPoint | null = null;
  if (activeDistance !== null) {
    activePoint = mappedTelemetry.find(d => d.distance === activeDistance) || mappedTelemetry.find(d => d.distance >= activeDistance) || null;
  }

  const driverStyles: Record<string, { color: string, strokeDasharray: string | undefined }> = {};
  const teamCounts: Record<string, number> = {};
  const teamDrivers: Record<string, string[]> = {};

  // First pass: group drivers by team
  drivers.forEach(drv => {
    const team = driver_info[drv]?.team || '';
    if (!teamDrivers[team]) {
      teamDrivers[team] = [];
    }
    teamDrivers[team].push(drv);
  });

  // Second pass: assign colors with smart differentiation
  drivers.forEach(drv => {
    const team = driver_info[drv]?.team || '';
    if (!teamCounts[team]) teamCounts[team] = 0;

    const index = teamCounts[team];
    const teamSize = teamDrivers[team]?.length || 1;
    teamCounts[team]++;

    const drvConfig = DRIVER_TEAM_COLORS_2026[drv];
    let color = getDriverColor(drv, team);
    let strokeDasharray: string | undefined = undefined;

    if (teamSize > 1) {
      if (drvConfig?.isTeammate2 || index > 0) {
        color = drvConfig?.secondary ?? generateTeammateColors(color, teamSize)[index] ?? color;
        strokeDasharray = index === 1 ? "8 6" : "4 4";
      }
    }

    driverStyles[drv] = {
      color,
      strokeDasharray
    };
  });

  const polylines: { driver: string; points: string[] }[] = [];
  let currentLine: { driver: string; points: string[] } | null = null;
  let prevPoint: string | null = null;

  const flushLine = () => {
    if (currentLine) {
      if (prevPoint && currentLine.points[currentLine.points.length - 1] !== prevPoint) {
        currentLine.points.push(prevPoint);
      }
      polylines.push(currentLine);
      currentLine = null;
    }
  };

  mappedTelemetry.forEach((d) => {
    if (d.x === undefined || d.y === undefined || isNaN(d.x) || isNaN(d.y)) return;
    const dominant = d.dominant_driver;
    if (!dominant) return;

    const pt = `${d.x},${flipY(d.y).toFixed(2)}`;

    if (!currentLine || currentLine.driver !== dominant) {
      flushLine();
      currentLine = {
        driver: dominant,
        points: [prevPoint ?? pt, pt],
      };
    } else {
      currentLine.points.push(pt);
    }
    prevPoint = pt;
  });
  flushLine();

  const allPoints = React.useMemo(() => {
    if (circuitGeom && circuitGeom.points.length > 0) {
      return circuitGeom.points.map(p => `${p.x},${flipY(p.y).toFixed(2)}`).join(' ');
    }
    return mappedTelemetry
      .filter(d => d.x !== undefined && d.y !== undefined && !isNaN(d.x) && !isNaN(d.y))
      .map(d => `${d.x},${flipY(d.y as number).toFixed(2)}`)
      .join(' ');
  }, [circuitGeom, mappedTelemetry, maxY, minY]);

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
        className="w-full h-[400px] bg-linear-to-br from-neutral-950 to-neutral-900 rounded-lg p-4 flex items-center justify-center overflow-hidden border border-neutral-800/50 relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <svg ref={svgRef} viewBox={viewBox} className="w-full h-full" preserveAspectRatio="xMidYMid meet">
          {/* Background track outline */}
          <polyline
            points={allPoints}
            stroke="#1a1a1a"
            strokeWidth={glowStrokeWidth}
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
                  strokeWidth={isHovered ? glowStrokeWidth : baseStrokeWidth * 0.85}
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
                  strokeWidth={isHovered ? baseStrokeWidth : baseStrokeWidth * 0.75}
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
                cy={flipY(activePoint.y)}
                r={glowStrokeWidth * 0.6}
                fill={driverStyles[activePoint.dominant_driver ?? '']?.color || '#ffffff'}
                opacity={0.3}
              />
              <circle
                cx={activePoint.x}
                cy={flipY(activePoint.y)}
                r={baseStrokeWidth * 0.5}
                fill="#ffffff"
                stroke="#000000"
                strokeWidth={Math.max(2, baseStrokeWidth * 0.12)}
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
