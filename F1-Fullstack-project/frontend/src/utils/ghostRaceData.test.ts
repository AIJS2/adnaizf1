import { describe, expect, it } from 'vitest';
import { generateDemoTelemetry, GhostDriverSample } from './ghostRaceData';
import { CANONICAL_CIRCUITS } from '../data/circuitPaths';

describe('generateDemoTelemetry', () => {
  const driverA: GhostDriverSample = {
    code: 'VER',
    name: 'Max Verstappen',
    team: 'Red Bull',
    baseColor: '#3671C6',
  };

  const driverB: GhostDriverSample = {
    code: 'NOR',
    name: 'Lando Norris',
    team: 'McLaren',
    baseColor: '#FF8000',
  };

  const circuit = CANONICAL_CIRCUITS[0]; // Albert Park

  it('generates the requested number of telemetry data points', () => {
    const points = generateDemoTelemetry(circuit, driverA, driverB, 150);
    expect(points).toHaveLength(150);
  });

  it('populates valid distance, x, y and dynamic driver telemetry keys', () => {
    const points = generateDemoTelemetry(circuit, driverA, driverB, 50);
    const p0 = points[0];
    const pEnd = points[points.length - 1];

    expect(p0.distance).toBe(0);
    expect(pEnd.distance).toBeGreaterThan(5000);
    expect(typeof p0.x).toBe('number');
    expect(typeof p0.y).toBe('number');

    // Telemetry fields for driver A and B
    expect(p0).toHaveProperty('speed_VER');
    expect(p0).toHaveProperty('speed_NOR');
    expect(p0).toHaveProperty('throttle_VER');
    expect(p0).toHaveProperty('throttle_NOR');
    expect(p0).toHaveProperty('brake_VER');
    expect(p0).toHaveProperty('brake_NOR');
    expect(p0).toHaveProperty('gear_VER');
    expect(p0).toHaveProperty('gear_NOR');

    // Values are within realistic physical bounds
    const speedA = Number(p0.speed_VER);
    expect(speedA).toBeGreaterThanOrEqual(70);
    expect(speedA).toBeLessThanOrEqual(360);

    const throttleA = Number(p0.throttle_VER);
    expect(throttleA).toBeGreaterThanOrEqual(0);
    expect(throttleA).toBeLessThanOrEqual(100);

    const brakeA = Number(p0.brake_VER);
    expect(brakeA).toBeGreaterThanOrEqual(0);
    expect(brakeA).toBeLessThanOrEqual(100);

    const gearA = Number(p0.gear_VER);
    expect(gearA).toBeGreaterThanOrEqual(1);
    expect(gearA).toBeLessThanOrEqual(8);
  });

  it('correctly sets dominant_driver based on speed comparison', () => {
    const points = generateDemoTelemetry(circuit, driverA, driverB, 60);
    points.forEach((pt) => {
      const spA = Number(pt.speed_VER);
      const spB = Number(pt.speed_NOR);
      if (spA >= spB) {
        expect(pt.dominant_driver).toBe('VER');
      } else {
        expect(pt.dominant_driver).toBe('NOR');
      }
    });
  });
});
