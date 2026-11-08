import { describe, expect, it } from 'vitest';
import { generateDemoTelemetry, GhostDriverSample } from './ghostRaceData';
import { CANONICAL_CIRCUITS } from '../data/circuitPaths';
import { getCircuitSpec } from '../data/circuitSpecs';

const driverA: GhostDriverSample = { code: 'VER', name: 'Max Verstappen', team: 'Red Bull', baseColor: '#3671C6' };
const driverB: GhostDriverSample = { code: 'NOR', name: 'Lando Norris', team: 'McLaren', baseColor: '#FF8000' };

describe('generateDemoTelemetry physics fix', () => {
  const circuit = CANONICAL_CIRCUITS.find((c) => c.round === 19)!;
  const points = generateDemoTelemetry(circuit, driverA, driverB, 350);

  it('resolves Mexico spec (Hermano Rodríguez)', () => {
    expect(getCircuitSpec('Autódromo Hermanos Rodríguez').length).toBe('4.304 km');
  });

  it('produces braking (brake > 0) at real corner zones', () => {
    const brakingPts = points.filter((p) => Number(p.brake_VER) > 0).length;
    expect(brakingPts).toBeGreaterThan(25);
  });

  it('keeps throttle at 0 whenever brake is applied', () => {
    let checked = 0;
    for (const p of points) {
      const brk = Number(p.brake_VER);
      const thr = Number(p.throttle_VER);
      if (brk > 0) {
        expect(thr).toBe(0);
        checked++;
      }
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('has extensive braking zones with high brake force', () => {
    const strongBrake = points.filter((p) => Number(p.brake_VER) >= 50).length;
    expect(strongBrake).toBeGreaterThan(8);
  });

  it('resolves the real Mexico track length (4304 m), not the old 5200 m', () => {
    const last = points[points.length - 1];
    expect(last.distance).toBeGreaterThan(4200);
    expect(last.distance).toBeLessThan(4400);
  });

  it('works consistently across several circuits', () => {
    for (const round of [1, 5, 9, 14, 19, 22]) {
      const c = CANONICAL_CIRCUITS.find((x) => x.round === round);
      if (!c) continue;
      const pts = generateDemoTelemetry(c, driverA, driverB, 300);
      const brk = pts.filter((p) => Number(p.brake_VER) > 0).length;
      const speeds = pts.map((p) => Number(p.speed_VER));
      const minSpeed = Math.min(...speeds);
      const maxSpeed = Math.max(...speeds);
      expect(brk).toBeGreaterThan(15);
      expect(minSpeed).toBeLessThanOrEqual(230);
      expect(maxSpeed).toBeGreaterThanOrEqual(280);
    }
  });
});
