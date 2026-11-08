import type {
  LiveTimingCircuit,
  LiveTimingData,
  LiveTimingLine,
  LiveTimingMessage,
  LiveTimingWeather,
} from '../types/f1';
import { getCircuitGeometry } from '../data/circuitPaths';
import { buildPreviewCircuit } from './liveCircuit';

export interface SimDriverConfig {
  number: string;
  code: string;
  name: string;
  team: string;
  baseLapSeconds: number;
}

export const SIMULATION_DRIVERS_GRID: SimDriverConfig[] = [
  { number: '1', code: 'VER', name: 'Max Verstappen', team: 'Red Bull Racing', baseLapSeconds: 72.1 },
  { number: '4', code: 'NOR', name: 'Lando Norris', team: 'McLaren', baseLapSeconds: 72.15 },
  { number: '16', code: 'LEC', name: 'Charles Leclerc', team: 'Ferrari', baseLapSeconds: 72.2 },
  { number: '81', code: 'PIA', name: 'Oscar Piastri', team: 'McLaren', baseLapSeconds: 72.3 },
  { number: '44', code: 'HAM', name: 'Lewis Hamilton', team: 'Ferrari', baseLapSeconds: 72.35 },
  { number: '63', code: 'RUS', name: 'George Russell', team: 'Mercedes', baseLapSeconds: 72.4 },
  { number: '14', code: 'ALO', name: 'Fernando Alonso', team: 'Aston Martin', baseLapSeconds: 72.5 },
  { number: '55', code: 'SAI', name: 'Carlos Sainz', team: 'Williams', baseLapSeconds: 72.6 },
  { number: '23', code: 'ALB', name: 'Alexander Albon', team: 'Williams', baseLapSeconds: 72.7 },
  { number: '10', code: 'GAS', name: 'Pierre Gasly', team: 'Alpine', baseLapSeconds: 72.8 },
  { number: '22', code: 'TSU', name: 'Yuki Tsunoda', team: 'Racing Bulls', baseLapSeconds: 72.85 },
  { number: '27', code: 'HUL', name: 'Nico Hulkenberg', team: 'Audi', baseLapSeconds: 72.9 },
  { number: '18', code: 'STR', name: 'Lance Stroll', team: 'Aston Martin', baseLapSeconds: 73.0 },
  { number: '31', code: 'OCO', name: 'Esteban Ocon', team: 'Haas F1 Team', baseLapSeconds: 73.05 },
  { number: '87', code: 'BEA', name: 'Oliver Bearman', team: 'Haas F1 Team', baseLapSeconds: 73.1 },
  { number: '30', code: 'LAW', name: 'Liam Lawson', team: 'Racing Bulls', baseLapSeconds: 73.15 },
  { number: '77', code: 'BOT', name: 'Valtteri Bottas', team: 'Cadillac', baseLapSeconds: 73.2 },
  { number: '43', code: 'COL', name: 'Franco Colapinto', team: 'Alpine', baseLapSeconds: 73.3 },
  { number: '5', code: 'BOR', name: 'Gabriel Bortoleto', team: 'Audi', baseLapSeconds: 73.4 },
  { number: '12', code: 'ANT', name: 'Kimi Antonelli', team: 'Mercedes', baseLapSeconds: 73.45 },
];

export interface SimulationStateOptions {
  circuit?: LiveTimingCircuit | null;
  startingLap?: number;
  totalLaps?: number;
}

export function formatLapTime(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  const mins = Math.floor(seconds / 60);
  const remSecs = (seconds % 60).toFixed(3).padStart(6, '0');
  return `${mins}:${remSecs}`;
}

export function formatSector(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds <= 0) return '—';
  return seconds.toFixed(3);
}

/**
 * Creates the initial live telemetry state for the simulation.
 */
export function createInitialSimulation(options: SimulationStateOptions = {}): LiveTimingData {
  const currentLap = options.startingLap ?? 42;
  const totalLaps = options.totalLaps ?? 71;

  const lines: LiveTimingLine[] = SIMULATION_DRIVERS_GRID.map((drv, idx) => {
    // Stagger progress from leader (progress ~0.88) down to P20
    const progress = Math.max(0.02, 0.88 - idx * 0.042);
    const gapSec = idx === 0 ? 0 : idx * 1.35 + (idx > 3 ? idx * 0.4 : 0);

    const s1 = 18.2 + idx * 0.08 + (Math.sin(idx) * 0.05);
    const s2 = 34.5 + idx * 0.12 + (Math.cos(idx) * 0.06);
    const s3 = 19.4 + idx * 0.06;
    const lapTimeSec = s1 + s2 + s3;

    return {
      position: idx + 1,
      driver: drv.code,
      team: drv.team,
      status: 'TRACK',
      gap: idx === 0 ? 'LEADER' : `+${gapSec.toFixed(3)}`,
      interval: idx === 0 ? '—' : `+${(idx === 1 ? gapSec : 1.35 + (Math.cos(idx) * 0.2)).toFixed(3)}`,
      lastLap: formatLapTime(lapTimeSec),
      lap_color: idx === 0 ? 'purple' : idx < 4 ? 'green' : 'yellow',
      sector1: formatSector(s1),
      s1_color: idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow',
      sector2: formatSector(s2),
      s2_color: idx === 1 ? 'purple' : idx < 5 ? 'green' : 'yellow',
      sector3: formatSector(s3),
      s3_color: idx === 2 ? 'purple' : 'yellow',
      pits: 1,
      tyre: idx % 3 === 0 ? 'HARD' : idx % 2 === 0 ? 'MEDIUM' : 'SOFT',
      tyre_age: 14 + (idx % 8),
      gap_seconds: gapSec,
      progress,
    };
  });

  const weather: LiveTimingWeather = {
    air: '24.6°C',
    track: '39.2°C',
    humidity: '54%',
    rain: '0%',
  };

  const messages: LiveTimingMessage[] = [
    { time: '14:30:00', msg: 'SESSION STARTED - GREEN FLAG' },
    { time: '14:38:15', msg: 'DRS ENABLED IN ZONES 1 AND 2' },
    { time: '14:48:22', msg: 'CAR 4 (NOR) - LAP TIME 1:12.115 DELETED - TRACK LIMITS TURN 4' },
    { time: '14:55:04', msg: 'CAR 16 (LEC) RADIO: TYRE TEMPERATURES NOMINAL' },
  ];

  const fallbackGeom = getCircuitGeometry({ round: 21 });
  const resolvedCircuit = options.circuit ?? (fallbackGeom ? buildPreviewCircuit(fallbackGeom) : null);

  return {
    lines,
    trackStatus: '1', // Green
    weather,
    messages,
    radio: [],
    status: 'live',
    isLiveSession: true,
    session_state: 'live',
    session_title: '2026 Brazilian Grand Prix — LIVE SIMULATION',
    circuit: resolvedCircuit,
    lap: currentLap,
    total_laps: totalLaps,
    last_session: null,
  };
}

export interface SimulationTickOptions {
  safetyCar?: boolean;
  rain?: boolean;
  speedMultiplier?: number;
}

/**
 * Advances the simulation by deltaSeconds.
 */
export function tickSimulation(
  prev: LiveTimingData,
  deltaSeconds: number,
  options: SimulationTickOptions = {}
): LiveTimingData {
  const { safetyCar = false, rain = false, speedMultiplier = 1 } = options;

  const currentLap = prev.lap ?? 42;
  const totalLaps = prev.total_laps ?? 71;
  let newLap = currentLap;

  // Track status code
  let trackStatus = prev.trackStatus;
  if (safetyCar) {
    trackStatus = '4'; // SC
  } else if (trackStatus === '4' && !safetyCar) {
    trackStatus = '1'; // Back to green
  }

  // Adjust weather for rain
  const weather: LiveTimingWeather = {
    ...prev.weather,
    rain: rain ? '72%' : '0%',
    track: rain ? '25.4°C' : '39.2°C',
    air: rain ? '20.8°C' : '24.6°C',
  };

  // Speed factor: normal lap is ~72s, so progress delta per sec is ~1/72 (~0.01388)
  // SC reduces speed to ~42%, Rain reduces speed to ~85%
  const speedScale = (safetyCar ? 0.42 : rain ? 0.85 : 1.0) * speedMultiplier;

  // Clone lines and advance cars
  const updatedLines = prev.lines.map((line, idx) => {
    const config = SIMULATION_DRIVERS_GRID.find((d) => d.code === line.driver) ?? {
      baseLapSeconds: 72.5 + idx * 0.1,
    };

    const isPitting = line.status === 'PIT';
    let newStatus = line.status;
    let pits = line.pits;
    let tyre = line.tyre;
    let tyreAge = line.tyre_age;

    // Advance progress
    const baseProgressDelta = (1 / config.baseLapSeconds) * deltaSeconds * speedScale;
    let progress = (line.progress ?? 0) + (isPitting ? baseProgressDelta * 0.3 : baseProgressDelta);

    let lastLap = line.lastLap;
    let s1 = line.sector1;
    let s2 = line.sector2;
    let s3 = line.sector3;
    let s1_color = line.s1_color;
    let s2_color = line.s2_color;
    let s3_color = line.s3_color;
    let lap_color = line.lap_color;

    // Completed lap check
    if (progress >= 1.0) {
      progress = progress - 1.0;
      tyreAge += 1;

      // P1 triggers race lap increment
      if (line.position === 1 && newLap < totalLaps) {
        newLap += 1;
      }

      // Finish pit stop if car was pitting
      if (isPitting) {
        newStatus = 'TRACK';
      }

      // Simulate pit stop when tyre age gets high (> 28)
      if (!safetyCar && tyreAge >= 28 && !isPitting) {
        newStatus = 'PIT';
        pits += 1;
        tyreAge = 0;
        tyre = rain ? 'INTERMEDIATE' : tyre === 'MEDIUM' ? 'HARD' : 'MEDIUM';
      }

      // Generate realistic sector times for completed lap
      const rainDelta = rain ? 5.2 : 0;
      const microVar = (Math.sin(idx + (newLap % 10)) * 0.15);
      const s1Val = (18.1 + (idx * 0.07) + microVar + rainDelta * 0.25);
      const s2Val = (34.3 + (idx * 0.11) + microVar + rainDelta * 0.5);
      const s3Val = (19.2 + (idx * 0.05) + rainDelta * 0.25);
      const totalSec = s1Val + s2Val + s3Val;

      s1 = formatSector(s1Val);
      s2 = formatSector(s2Val);
      s3 = formatSector(s3Val);
      lastLap = formatLapTime(totalSec);

      s1_color = idx === 0 ? 'purple' : idx < 4 ? 'green' : 'yellow';
      s2_color = idx === 1 ? 'purple' : idx < 5 ? 'green' : 'yellow';
      s3_color = idx === 2 ? 'purple' : 'yellow';
      lap_color = idx === 0 ? 'purple' : idx < 3 ? 'green' : 'yellow';
    }

    return {
      ...line,
      status: newStatus,
      progress: Math.max(0, Math.min(progress, 0.999)),
      tyre,
      tyre_age: tyreAge,
      pits,
      lastLap,
      sector1: s1,
      sector2: s2,
      sector3: s3,
      s1_color,
      s2_color,
      s3_color,
      lap_color,
    };
  });

  // Calculate positions: sort by progress descending (cars further ahead on track)
  // Under green, small gap fluctuations occur
  const sorted = [...updatedLines].sort((a, b) => {
    const progA = a.progress ?? 0;
    const progB = b.progress ?? 0;
    return progB - progA;
  });

  const leaderProg = sorted[0]?.progress ?? 0;

  const finalLines: LiveTimingLine[] = sorted.map((line, idx) => {
    const pos = idx + 1;
    let gapStr = 'LEADER';
    let intervalStr = '—';
    let gapSec = 0;

    if (idx > 0) {
      const prevLine = sorted[idx - 1];
      const progDiffFromLeader = (leaderProg - (line.progress ?? 0) + 1.0) % 1.0;
      const progDiffFromPrev = ((prevLine.progress ?? 0) - (line.progress ?? 0) + 1.0) % 1.0;

      // Approximate seconds from progress delta (72 seconds = 1.0 progress)
      gapSec = progDiffFromLeader * 72;
      const intSec = progDiffFromPrev * 72;

      gapStr = `+${gapSec.toFixed(3)}`;
      intervalStr = `+${intSec.toFixed(3)}`;
    }

    return {
      ...line,
      position: pos,
      gap: gapStr,
      interval: intervalStr,
      gap_seconds: gapSec,
    };
  });

  // Dynamic race control message on safety car trigger
  let messages = prev.messages;
  if (safetyCar && prev.trackStatus !== '4') {
    const timeStr = new Date().toTimeString().split(' ')[0];
    messages = [
      { time: timeStr, msg: 'SAFETY CAR DEPLOYED - REDUCE SPEED' },
      ...messages.slice(0, 15),
    ];
  } else if (!safetyCar && prev.trackStatus === '4') {
    const timeStr = new Date().toTimeString().split(' ')[0];
    messages = [
      { time: timeStr, msg: 'SAFETY CAR IN THIS LAP - TRACK CLEAR - GREEN FLAG' },
      ...messages.slice(0, 15),
    ];
  }

  return {
    ...prev,
    lines: finalLines,
    trackStatus,
    weather,
    messages,
    lap: newLap,
  };
}
