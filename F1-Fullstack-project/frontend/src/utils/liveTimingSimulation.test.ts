import { describe, expect, it } from 'vitest';
import {
  createInitialSimulation,
  formatLapTime,
  formatSector,
  tickSimulation,
  SIMULATION_DRIVERS_GRID,
} from './liveTimingSimulation';

describe('liveTimingSimulation utility', () => {
  it('formats lap times and sector times cleanly', () => {
    expect(formatLapTime(72.435)).toBe('1:12.435');
    expect(formatLapTime(60.0)).toBe('1:00.000');
    expect(formatLapTime(0)).toBe('—');
    expect(formatLapTime(-5)).toBe('—');

    expect(formatSector(18.234)).toBe('18.234');
    expect(formatSector(0)).toBe('—');
  });

  it('initializes 20 drivers grid with full telemetry metadata', () => {
    const sim = createInitialSimulation({ startingLap: 40, totalLaps: 70 });

    expect(sim.lines).toHaveLength(20);
    expect(sim.lap).toBe(40);
    expect(sim.total_laps).toBe(70);
    expect(sim.trackStatus).toBe('1');
    expect(sim.status).toBe('live');
    expect(sim.isLiveSession).toBe(true);

    const leader = sim.lines[0];
    expect(leader.position).toBe(1);
    expect(leader.gap).toBe('LEADER');
    expect(leader.interval).toBe('—');
    expect(leader.driver).toBe(SIMULATION_DRIVERS_GRID[0].code);

    const p2 = sim.lines[1];
    expect(p2.position).toBe(2);
    expect(p2.gap).toMatch(/^\+\d+\.\d{3}$/);
  });

  it('advances car progress and increments lap upon crossing line', () => {
    const sim = createInitialSimulation({ startingLap: 10, totalLaps: 50 });
    // Force leader close to finish line
    sim.lines[0].progress = 0.999;

    const next = tickSimulation(sim, 1.0, { speedMultiplier: 1 });
    expect(next.lines[0].progress).toBeGreaterThanOrEqual(0);
    expect(next.lap).toBe(11);
  });

  it('handles safety car mode and triggers race control event', () => {
    const sim = createInitialSimulation();
    expect(sim.trackStatus).toBe('1');

    const scState = tickSimulation(sim, 1.0, { safetyCar: true });
    expect(scState.trackStatus).toBe('4');
    expect(scState.messages[0].msg).toContain('SAFETY CAR DEPLOYED');

    const greenState = tickSimulation(scState, 1.0, { safetyCar: false });
    expect(greenState.trackStatus).toBe('1');
    expect(greenState.messages[0].msg).toContain('SAFETY CAR IN THIS LAP');
  });

  it('handles rain conditions by adjusting weather and sector pace', () => {
    const sim = createInitialSimulation();
    const wetState = tickSimulation(sim, 1.0, { rain: true });

    expect(wetState.weather.rain).toBe('72%');
    expect(Number(wetState.weather.track.replace('°C', ''))).toBeLessThan(30);
  });
});
