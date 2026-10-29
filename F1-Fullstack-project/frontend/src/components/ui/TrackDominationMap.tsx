import React from 'react';
import { Compass, MousePointerClick, Palette, Trophy } from 'lucide-react';
import EmptyState, { EMPTY_TABLE_MESSAGES } from './EmptyState';
import { TelemetryDataPoint, TeamDriverInfo } from '../../types/f1';
import { teamColors, DRIVER_TEAM_COLORS_2026, getDriverColor } from '../../data/teamData';
import { getCircuitGeometry, sampleCircuitPosition, CircuitLookup } from '../../data/circuitPaths';
import { getCircuitCorners, CircuitCorner } from '../../data/circuitCorners';
import { getCornerDetail } from '../../data/cornerDetails';
import { CircuitCornerMarkers } from './CircuitCornerMarkers';
import { CornerDetailCard } from './CornerDetailCard';
import { Track3D } from './Track3D';

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
  const [showCorners, setShowCorners] = React.useState<boolean>(true);
  const [selectedCorner, setSelectedCorner] = React.useState<CircuitCorner | null>(null);
  const svgRef = React.useRef<SVGSVGElement>(null);
  const tooltipRef = React.useRef<HTMLDivElement>(null);
  const tooltipSizeRef = React.useRef({ width: 0, height: 0 });
  const rafRef = React.useRef<number | null>(null);

  const circuitGeom = React.useMemo(() => {
    return getCircuitGeometry(circuitInfo);
  }, [circuitInfo]);

  const corners = React.useMemo(() => {
    return getCircuitCorners(circuitInfo);
  }, [circuitInfo]);

  const cornerIndex = React.useMemo(() => {
    if (!selectedCorner) return -1;
    return corners.findIndex(
      (c) =>
        c.number === selectedCorner.number &&
        (c.letter ?? '') === (selectedCorner.letter ?? ''),
    );
  }, [corners, selectedCorner]);

  const handlePrevCorner = React.useCallback(() => {
    if (corners.length === 0 || cornerIndex === -1) return;
    const prevIdx = (cornerIndex - 1 + corners.length) % corners.length;
    setSelectedCorner(corners[prevIdx]);
  }, [corners, cornerIndex]);

  const handleNextCorner = React.useCallback(() => {
    if (corners.length === 0 || cornerIndex === -1) return;
    const nextIdx = (cornerIndex + 1) % corners.length;
    setSelectedCorner(corners[nextIdx]);
  }, [corners, cornerIndex]);

  const activeCornerDetail = React.useMemo(() => {
    if (!selectedCorner) return null;
    return getCornerDetail(circuitInfo, selectedCorner.number, selectedCorner.letter);
  }, [circuitInfo, selectedCorner]);

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
  const padding     = maxDim * 0.1;
  const viewBox     = `${minX - padding} ${minY - padding} ${trackWidth + padding * 2} ${trackHeight + padding * 2}`;

  const baseStrokeWidth = Math.max(12, maxDim * 0.015);
  const glowStrokeWidth = baseStrokeWidth * 1.15;
  const flipY = (y: number) => maxY + minY - y;

  const trackPointsForCorners = React.useMemo(() => {
    if (circuitGeom && circuitGeom.points.length > 0) {
      return circuitGeom.points.map((p) => ({ x: p.x, y: flipY(p.y) }));
    }
    return mappedTelemetry
      .filter((d) => d.x !== undefined && d.y !== undefined && !isNaN(d.x) && !isNaN(d.y))
      .map((d) => ({ x: d.x as number, y: flipY(d.y as number) }));
  }, [circuitGeom, mappedTelemetry, maxY, minY]);

  const sampleForCorners = React.useCallback(
    (d: number) => {
      if (circuitGeom) {
        const pt = sampleCircuitPosition(circuitGeom, d);
        return { x: pt.x, y: flipY(pt.y) };
      }
      const total = mappedTelemetry.length;
      if (total === 0) return { x: 0, y: 0 };
      const idx = Math.max(0, Math.min(total - 1, Math.round(d * (total - 1))));
      const pt = mappedTelemetry[idx];
      return { x: pt.x ?? 0, y: flipY(pt.y ?? 0) };
    },
    [circuitGeom, mappedTelemetry, maxY, minY],
  );

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

  // Domination statistics: percentage and point count per driver
  const dominationStats = React.useMemo(() => {
    const counts: Record<string, number> = {};
    drivers.forEach((d) => {
      counts[d] = 0;
    });

    let totalValidPoints = 0;
    mappedTelemetry.forEach((d) => {
      if (d.dominant_driver && counts[d.dominant_driver] !== undefined) {
        counts[d.dominant_driver]++;
        totalValidPoints++;
      }
    });

    const stats: Record<string, { points: number; percent: number }> = {};
    drivers.forEach((d) => {
      const count = counts[d] || 0;
      stats[d] = {
        points: count,
        percent: totalValidPoints > 0 ? Math.round((count / totalValidPoints) * 100) : 0,
      };
    });
    return stats;
  }, [drivers, mappedTelemetry]);

  // Order drivers by domination percentage (highest first, 0% drivers at the end)
  const sortedDrivers = React.useMemo(() => {
    return [...drivers].sort((a, b) => {
      const pA = dominationStats[a]?.percent ?? 0;
      const pB = dominationStats[b]?.percent ?? 0;
      return pB - pA;
    });
  }, [drivers, dominationStats]);

  // Highest-scoring driver, used for the plain-language summary under the map.
  const dominationLeader = React.useMemo(() => {
    const top = sortedDrivers[0];
    if (!top) return null;
    const percent = dominationStats[top]?.percent ?? 0;
    return percent > 0 ? { driver: top, percent } : null;
  }, [sortedDrivers, dominationStats]);

  const allPoints = React.useMemo(() => {
    if (circuitGeom && circuitGeom.points.length > 0) {
      return circuitGeom.points.map(p => `${p.x},${flipY(p.y).toFixed(2)}`).join(' ');
    }
    return mappedTelemetry
      .filter(d => d.x !== undefined && d.y !== undefined && !isNaN(d.x) && !isNaN(d.y))
      .map(d => `${d.x},${flipY(d.y as number).toFixed(2)}`)
      .join(' ');
  }, [circuitGeom, mappedTelemetry, maxY, minY]);

  const pointerRef = React.useRef({ x: 0, y: 0 });
  // Legend pills render the tooltip above themselves; the track uses the cursor.
  const placementRef = React.useRef<'cursor' | 'above'>('cursor');

  const placeTooltip = React.useCallback(() => {
    const tooltip = tooltipRef.current;
    if (!tooltip) return;
    // The tooltip is anchored to the card, not the SVG: the map viewport is
    // overflow-hidden, which used to clip the tooltip near the right edge and
    // hide it completely when hovering the driver pills below the map.
    const parent = tooltip.offsetParent as HTMLElement | null;
    if (!parent) return;
    const rect = parent.getBoundingClientRect();
    // Measure once per hover. Reading offsetWidth/offsetHeight on every
    // mousemove forced a layout flush and made the bubble visibly stutter.
    const { width, height } = tooltipSizeRef.current;
    if (!width || !height) return;
    const gap = 16;
    const pad = 8;

    let x = pointerRef.current.x - rect.left + gap;
    let centerY = pointerRef.current.y - rect.top;

    if (placementRef.current === 'above') {
      // Centre the bubble above the pill instead of covering it.
      x = pointerRef.current.x - rect.left - width / 2;
      centerY -= height / 2 + 6;
    } else if (x + width > rect.width - pad) {
      // Flip to the left of the cursor when there is no room on the right.
      x = pointerRef.current.x - rect.left - width - gap;
    }
    x = Math.max(pad, Math.min(x, rect.width - width - pad));

    // Keep the vertically centred tooltip inside the card as well.
    const minCenter = height / 2 + pad;
    const maxCenter = rect.height - height / 2 - pad;
    const y = Math.max(minCenter, Math.min(centerY, maxCenter));

    tooltip.style.transform = `translate3d(${x}px, ${y}px, 0) translateY(-50%)`;
  }, []);

  const scheduleTooltip = React.useCallback(() => {
    if (typeof window.requestAnimationFrame !== 'function') {
      placeTooltip();
      return;
    }
    if (rafRef.current !== null) return;
    rafRef.current = window.requestAnimationFrame(() => {
      rafRef.current = null;
      placeTooltip();
    });
  }, [placeTooltip]);

  React.useEffect(() => {
    return () => {
      if (rafRef.current !== null) {
        window.cancelAnimationFrame(rafRef.current);
        rafRef.current = null;
      }
    };
  }, []);

  // Position after the tooltip mounts so the first hover does not flash at 0,0.
  React.useLayoutEffect(() => {
    if (!hoveredDriver) return;
    const tooltip = tooltipRef.current;
    if (tooltip) {
      tooltipSizeRef.current = {
        width: tooltip.offsetWidth,
        height: tooltip.offsetHeight,
      };
    }
    placeTooltip();
  }, [hoveredDriver, placeTooltip]);

  const trackPointer = (clientX: number, clientY: number) => {
    pointerRef.current = { x: clientX, y: clientY };
    scheduleTooltip();
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    placementRef.current = 'cursor';
    trackPointer(e.clientX, e.clientY);
  };

  const handleDriverHover = (driver: string, e: React.MouseEvent) => {
    placementRef.current = 'cursor';
    pointerRef.current = { x: e.clientX, y: e.clientY };
    setHoveredDriver(driver);
    scheduleTooltip();
  };

  const handlePillHover = (driver: string, e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    placementRef.current = 'above';
    pointerRef.current = { x: rect.left + rect.width / 2, y: rect.top - 4 };
    setHoveredDriver(driver);
    scheduleTooltip();
  };

  const handleMouseLeave = () => {
    setHoveredDriver(null);
  };

  return (
    <div className="relative bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-lg p-6 shadow-2xl mb-8">
      <div className="flex flex-wrap items-center justify-between gap-3 mb-2">
        <h3 className="text-xl font-bold text-white flex items-center gap-2">
          <Compass size={20} className="text-red-500" /> Track Domination Map
        </h3>
        {corners.length > 0 && (
          <button
            type="button"
            onClick={() => setShowCorners((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold transition-colors duration-200 border cursor-pointer ${
              showCorners
                ? 'bg-red-500/15 border-red-500/40 text-red-300 shadow-[0_0_12px_rgba(239,68,68,0.2)]'
                : 'bg-neutral-800/80 border-neutral-700/60 text-neutral-400 hover:text-neutral-200'
            }`}
            aria-pressed={showCorners}
            data-testid="toggle-turn-numbers"
            title={
              showCorners
                ? 'Hide the T1–Tn turn badges drawn on the circuit'
                : 'Overlay T1–Tn turn badges on the circuit — click a badge to read that corner'
            }
          >
            <span
              className={`w-1.5 h-1.5 rounded-full ${showCorners ? 'bg-red-400 motion-safe:animate-pulse' : 'bg-neutral-500'}`}
            />
            Turn Numbers {showCorners ? 'ON' : 'OFF'}
          </button>
        )}
      </div>
      <p className="text-xs text-neutral-400 mb-4 font-medium">
        Color-coded segments show which driver was fastest at each part of the track
      </p>
      <div
        data-testid="domination-map"
        className="w-full h-[400px] bg-linear-to-br from-neutral-950 to-neutral-900 rounded-lg p-4 flex items-center justify-center overflow-hidden border border-neutral-800/50 relative"
        onMouseMove={handleMouseMove}
        onMouseLeave={handleMouseLeave}
      >
        <Track3D className="w-full h-full" tone="cyan" tilt={8} interactive={false} flat>
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
                onMouseEnter={(e) => handleDriverHover(line.driver, e)}
              >
                {/* Wide low-opacity layer instead of an SVG blur filter: blur
                    filters repaint the whole map on every hover change and
                    caused visible flicker in Chromium. */}
                <polyline
                  points={line.points.join(' ')}
                  stroke={style.color}
                  strokeWidth={glowStrokeWidth}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={isDimmed ? 0.05 : isHovered ? 0.46 : 0.2}
                  pointerEvents="none"
                  style={{ transition: 'opacity 160ms ease' }}
                />
                {/* Main colored line. Widths stay constant in both states so
                    the painted hit area cannot grow under the cursor and
                    oscillate between neighbouring segments. */}
                <polyline
                  points={line.points.join(' ')}
                  stroke={style.color}
                  strokeWidth={baseStrokeWidth * 0.78}
                  strokeDasharray={style.strokeDasharray}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  opacity={isDimmed ? 0.22 : 1}
                  pointerEvents="none"
                  style={{ transition: 'opacity 160ms ease' }}
                />
                {/* Invisible, constant-width hit target. The visible layers
                    never participate in hit testing. */}
                <polyline
                  points={line.points.join(' ')}
                  stroke="rgba(0,0,0,0)"
                  strokeWidth={baseStrokeWidth * 1.25}
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill="none"
                  pointerEvents="stroke"
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

          {/* Turn numbering badges */}
          {showCorners && corners.length > 0 && trackPointsForCorners.length > 0 && (
            <CircuitCornerMarkers
              corners={corners}
              trackPoints={trackPointsForCorners}
              sample={sampleForCorners}
              viewBox={viewBox}
              trackWidth={baseStrokeWidth}
              radius={maxDim * 0.024}
              tone="overlay"
              selectedCorner={selectedCorner}
              onCornerClick={(corner) => setSelectedCorner(corner)}
            />
          )}
        </svg>

        {/* Interactive Corner Spotlight Card */}
        {showCorners && selectedCorner && activeCornerDetail && (
          <div className="absolute bottom-3 left-3 right-3 sm:right-auto sm:max-w-sm z-30 pointer-events-auto animate-in fade-in zoom-in-95 duration-200">
            <CornerDetailCard
              detail={activeCornerDetail}
              circuitName={circuitInfo?.name || circuitInfo?.location || undefined}
              onClose={() => setSelectedCorner(null)}
              onPrev={corners.length > 1 ? handlePrevCorner : undefined}
              onNext={corners.length > 1 ? handleNextCorner : undefined}
            />
          </div>
        )}
        </Track3D>
      </div>
      {/* Legend Pills with Domination Percentages */}
      <div className="flex flex-wrap justify-center gap-3 sm:gap-4 mt-6">
        {sortedDrivers.map((drv) => {
          const style = driverStyles[drv] || { color: '#ffffff', strokeDasharray: undefined };
          const info = driver_info[drv];
          const teamColor = teamColors[info?.team ?? ''] || '#888888';
          const isActive = hoveredDriver === drv;
          const stat = dominationStats[drv] || { points: 0, percent: 0 };
          const isZero = stat.percent === 0;

          return (
            <div
              key={drv}
              data-testid={`driver-pill-${drv}`}
              className={`flex items-center gap-2.5 rounded-full border px-3.5 py-1.5 transition-all duration-200 cursor-pointer ${
                isActive
                  ? 'bg-neutral-800/95 scale-105 shadow-lg'
                  : isZero
                    ? 'bg-neutral-950/60 opacity-50 hover:opacity-90'
                    : 'bg-neutral-900/80 hover:bg-neutral-800/80'
              }`}
              style={{
                borderColor: isActive ? style.color : isZero ? '#333338' : teamColor,
                boxShadow: isActive ? `0 0 20px ${style.color}40` : 'none',
              }}
              onMouseEnter={(e) => handlePillHover(drv, e)}
              onMouseLeave={() => setHoveredDriver(null)}
            >
              <svg width="28" height="8" viewBox="0 0 28 8">
                <line
                  x1="0"
                  y1="4"
                  x2="28"
                  y2="4"
                  stroke={isZero ? '#55555e' : style.color}
                  strokeWidth={isActive ? '7' : '5'}
                  strokeLinecap="round"
                  strokeDasharray={style.strokeDasharray}
                />
              </svg>
              <div className="flex items-center gap-2">
                <span className="text-xs sm:text-sm font-black text-white">{drv}</span>
                <span
                  className={`px-1.5 py-0.5 rounded text-[10px] font-mono font-bold ${
                    isZero
                      ? 'bg-neutral-800/80 text-neutral-400'
                      : 'bg-neutral-950/90 text-neutral-200 border border-neutral-700/60'
                  }`}
                >
                  {isZero ? '0%' : `${stat.percent}%`}
                </span>
                {info?.team && (
                  <span className="hidden sm:inline text-[10px] text-neutral-400 font-medium">
                    {info.team}
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {/* How to read this map — replaces the bare space under the legend */}
      <div
        data-testid="domination-explainer"
        className="mt-6 pt-5 border-t border-neutral-800/80"
      >
        <h4 className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.18em] mb-3">
          How to read this map
        </h4>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="flex gap-2.5">
            <Palette size={15} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-neutral-400 leading-relaxed">
              <span className="text-neutral-200 font-bold">Each colour is a driver.</span>{' '}
              The track is split into micro-sectors and painted with the colour of
              whoever set the highest speed through that exact stretch.
            </p>
          </div>
          <div className="flex gap-2.5">
            <Trophy size={15} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-neutral-400 leading-relaxed">
              <span className="text-neutral-200 font-bold">The % is share of track.</span>{' '}
              {dominationLeader
                ? `${dominationLeader.driver} leads with ${dominationLeader.percent}% of the lap. `
                : ''}
              A driver on 0% was never fastest anywhere — not slow overall, just
              beaten in every sector by the others selected.
            </p>
          </div>
          <div className="flex gap-2.5">
            <MousePointerClick size={15} className="text-red-500 shrink-0 mt-0.5" />
            <p className="text-xs text-neutral-400 leading-relaxed">
              <span className="text-neutral-200 font-bold">Try it.</span>{' '}
              Hover a line or a driver pill to isolate it.
              {corners.length > 0
                ? ' Toggle Turn Numbers, then click any T-badge to read that corner’s history.'
                : ''}
            </p>
          </div>
        </div>
      </div>

      {/* Tooltip overlay — lives on the card so the map viewport cannot clip it */}
      {hoveredDriver && (
        <div
          ref={tooltipRef}
          className="pointer-events-none absolute left-0 top-0 z-50 will-change-transform"
        >
          <div
            className="px-4 py-2.5 rounded-xl border-2 shadow-2xl backdrop-blur-md"
            style={{
              backgroundColor: 'rgba(10, 10, 10, 0.98)',
              borderColor: driverStyles[hoveredDriver]?.color || '#ffffff',
            }}
          >
            <div className="flex items-center gap-2.5">
              <div
                className="w-3 h-3 rounded-full shrink-0"
                style={{ backgroundColor: driverStyles[hoveredDriver]?.color || '#ffffff' }}
              />
              <div className="flex flex-col">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-black text-white leading-none">
                    {hoveredDriver}
                  </span>
                  <span className="text-xs font-mono font-black text-white/90">
                    {(dominationStats[hoveredDriver]?.percent ?? 0) === 0
                      ? '0% · No sectors dominated'
                      : `${dominationStats[hoveredDriver]?.percent}% track dominated`}
                  </span>
                </div>
                <span className="text-[11px] text-neutral-400 font-medium leading-none mt-1">
                  {(dominationStats[hoveredDriver]?.percent ?? 0) === 0
                    ? 'Slower in all track sectors compared to other selected drivers'
                    : driver_info[hoveredDriver]?.name || driver_info[hoveredDriver]?.team}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default TrackDominationMap;
