// Helper and demo synthesizer for Telemetry Ghost Race.
//
// When live FastF1 telemetry is available from `/api/telemetry/{year}/{round}`,
// we use the real lap traces. When a race is in the future, when the local
// backend is offline, or when the user wants an instant demo, this module
// generates a physically plausible head-to-head lap between two drivers
// sampled over canonical circuit geometry.
//
// The synth models the track as a closed loop of uniformly arc-length-spaced
// samples, estimates local curvature, then runs a two-pass racing-line
// velocity solver: a backward "braking" pass constrains how fast a car can be
// traveling when it arrives at each corner (so braking happens BEFORE the
// apex), and a forward "acceleration" pass constrains how much speed it can
// carry out of a corner. Throttle and brake stay mutually exclusive, braking
// zones appear ahead of every corner, and DRS only opens on straights.

import { TelemetryDataPoint } from '../types/f1';
import { CircuitGeometry, sampleCircuitPosition } from '../data/circuitPaths';
import { getCircuitSpec } from '../data/circuitSpecs';

export interface GhostDriverSample {
  code: string;
  name: string;
  team: string;
  baseColor: string;
}

/** Physics tuning for the synthetic drivers (A vs B produce a natural duel). */
const PHYSICS = {
  // Lateral acceleration at the apex (downforce-limited), m/s^2
  latAccel: { A: 38, B: 37.5 },
  // Braking deceleration, m/s^2 (A brakes later/deeper, B brakes earlier)
  brakeDecel: { A: 36, B: 33 },
  // Forward acceleration model: a = accelBase - accelTopK * v (v in m/s)
  accelBase: { A: 13.5, B: 13.2 },
  accelTopK: { A: 0.11, B: 0.113 },
  // Absolute top-speed caps, m/s (~338 vs ~335 km/h)
  topSpeedMs: { A: 94, B: 93 },
  minApexSpeedMs: 21, // ~76 km/h slowest corner
};

function gearForSpeed(speedKmh: number): number {
  if (speedKmh < 70) return 2;
  if (speedKmh < 105) return 3;
  if (speedKmh < 145) return 4;
  if (speedKmh < 185) return 5;
  if (speedKmh < 225) return 6;
  if (speedKmh < 265) return 7;
  return 8;
}

/**
 * Generate a realistic synthetic lap trace with braking zones, straights,
 * throttle modulation, gear changes, and speed deltas.
 *
 * Uses a two-pass (backward braking / forward acceleration) velocity solver
 * over uniformly arc-length-sampled circuit positions.
 */
export function generateDemoTelemetry(
  geom: CircuitGeometry,
  driverA: GhostDriverSample,
  driverB: GhostDriverSample,
  pointCount = 350,
): TelemetryDataPoint[] {
  const spec = getCircuitSpec(geom.name) || getCircuitSpec(geom.country);
  const totalDistanceMeters = parseFloat(spec.length) * 1000 || 5200;

  const N = pointCount;
  if (N < 4) return [];

  // 1. Uniformly sample the closed loop by normalized arc length.
  const positions: { x: number; y: number }[] = [];
  for (let i = 0; i < N; i++) {
    positions.push(sampleCircuitPosition(geom, i / (N - 1)));
  }
  const ds = totalDistanceMeters / (N - 1);

  // 2. Local curvature over a ~30 m window (robust to geometry point density).
  const w = Math.max(1, Math.round(30 / ds));
  const rawCurv = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    const pPrev = positions[(i - w + N) % N];
    const pCurr = positions[i];
    const pNext = positions[(i + w) % N];
    const dx1 = pCurr.x - pPrev.x;
    const dy1 = pCurr.y - pPrev.y;
    const dx2 = pNext.x - pCurr.x;
    const dy2 = pNext.y - pCurr.y;
    const a1 = Math.atan2(dy1, dx1);
    const a2 = Math.atan2(dy2, dx2);
    let diff = Math.abs(a1 - a2);
    if (diff > Math.PI) diff = 2 * Math.PI - diff;
    rawCurv[i] = diff / (2 * w * ds);
  }
  // Smooth curvature with a 3-point box to kill discretization noise.
  const curv = new Float64Array(N);
  for (let i = 0; i < N; i++) {
    curv[i] = (rawCurv[(i - 1 + N) % N] + rawCurv[i] + rawCurv[(i + 1) % N]) / 3;
  }

  // 3. Corner apex speed (m/s) from curvature, per driver.
  const apexOf = (driver: 'A' | 'B'): number[] => {
    const arr: number[] = [];
    for (let i = 0; i < N; i++) {
      const k = Math.max(curv[i], 0.001);
      const v = Math.sqrt(PHYSICS.latAccel[driver] / k);
      arr.push(Math.min(PHYSICS.topSpeedMs[driver], Math.max(PHYSICS.minApexSpeedMs, v)));
    }
    return arr;
  };
  const vApexA = apexOf('A');
  const vApexB = apexOf('B');

  // 4. Backward pass: cap speed by what braking deceleration allows before
  //    each upcoming corner (two sweeps settle the lap-boundary seam).
  const brakingPass = (apex: number[], decel: number): number[] => {
    const v = apex.slice();
    for (let iter = 0; iter < 2; iter++) {
      for (let i = N - 1; i >= 0; i--) {
        const nxt = (i + 1) % N;
        const maxV = Math.sqrt(v[nxt] * v[nxt] + 2 * decel * ds);
        if (v[i] > maxV) v[i] = maxV;
      }
    }
    return v;
  };
  const vBrakeA = brakingPass(vApexA, PHYSICS.brakeDecel.A);
  const vBrakeB = brakingPass(vApexB, PHYSICS.brakeDecel.B);

  // 5. Forward pass: cap speed by available traction/engine acceleration.
  const accelerationPass = (brakeV: number[], base: number, k: number): number[] => {
    const v = brakeV.slice();
    for (let iter = 0; iter < 2; iter++) {
      for (let i = 0; i < N; i++) {
        const prevIdx = (i - 1 + N) % N;
        const vPrev = v[prevIdx];
        const aAcc = Math.max(3.8, base - k * vPrev);
        const maxV = Math.sqrt(vPrev * vPrev + 2 * aAcc * ds);
        if (v[i] > maxV) v[i] = maxV;
      }
    }
    return v;
  };
  const vSpeedA = accelerationPass(vBrakeA, PHYSICS.accelBase.A, PHYSICS.accelTopK.A);
  const vSpeedB = accelerationPass(vBrakeB, PHYSICS.accelBase.B, PHYSICS.accelTopK.B);

  // 6. Assemble per-sample telemetry; infer brake/throttle from dv/ds.
  const telemetry: TelemetryDataPoint[] = [];

  const inputsFor = (vSpeed: number[], i: number): { throttle: number; brake: number } => {
    const vCurr = vSpeed[i];
    const dv = vSpeed[(i + 1) % N] - vCurr;
    if (dv < -0.3) {
      // Braking zone ahead of a corner: brake on, throttle fully off.
      const decel = Math.abs((dv * vCurr) / ds);
      return { throttle: 0, brake: Math.round(Math.min(100, Math.max(20, (decel / 35) * 100))) };
    }
    if (dv > 0.15) {
      // Accelerating out of a corner / down a straight.
      return { throttle: Math.round(Math.min(100, Math.max(45, (vCurr / 75) * 100))), brake: 0 };
    }
    // Mid-corner maintenance or steady-state.
    const throttle = curv[i] > 0.007 ? Math.round(Math.max(20, 60 - curv[i] * 1200)) : 100;
    return { throttle, brake: 0 };
  };

  const noUpcomingBrake = (vSpeed: number[], i: number): boolean => {
    const lookahead = Math.max(1, Math.round(120 / ds));
    for (let j = 1; j <= lookahead; j++) {
      const idx = (i + j) % N;
      if (vSpeed[(idx + 1) % N] - vSpeed[idx] < -0.3) return false;
    }
    return true;
  };

  for (let i = 0; i < N; i++) {
    const distance = Math.round(i * ds);
    const pos = positions[i];

    const speedA = Math.round(vSpeedA[i] * 3.6);
    const speedB = Math.round(vSpeedB[i] * 3.6);

    const inA = inputsFor(vSpeedA, i);
    const inB = inputsFor(vSpeedB, i);
    const throttleA = inA.throttle;
    const brakeA = inA.brake;
    const throttleB = inB.throttle;
    const brakeB = inB.brake;

    // DRS: only full-throttle, high-speed, low-curvature points with no
    // braking within the next ~120 m (i.e. real straight-line zones).
    const drsA =
      throttleA >= 98 && speedA > 265 && curv[i] < 0.002 && noUpcomingBrake(vSpeedA, i) ? 1 : 0;
    const drsB =
      throttleB >= 98 && speedB > 265 && curv[i] < 0.002 && noUpcomingBrake(vSpeedB, i) ? 1 : 0;

    const gearA = gearForSpeed(speedA);
    const gearB = gearForSpeed(speedB);

    const dominant = speedA >= speedB ? driverA.code : driverB.code;

    telemetry.push({
      distance,
      dominant_driver: dominant,
      x: pos.x,
      y: pos.y,
      [`speed_${driverA.code}`]: speedA,
      [`speed_${driverB.code}`]: speedB,
      [`throttle_${driverA.code}`]: throttleA,
      [`throttle_${driverB.code}`]: throttleB,
      [`brake_${driverA.code}`]: brakeA,
      [`brake_${driverB.code}`]: brakeB,
      [`gear_${driverA.code}`]: gearA,
      [`gear_${driverB.code}`]: gearB,
      [`drs_${driverA.code}`]: drsA,
      [`drs_${driverB.code}`]: drsB,
    });
  }

  return telemetry;
}
