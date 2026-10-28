import { describe, expect, it } from 'vitest';
import { CIRCUIT_CORNERS, getCircuitCorners } from '../circuitCorners';

describe('bundled circuit corners', () => {
  it('includes a complete, lap-ordered set for Monaco', () => {
    const monaco = CIRCUIT_CORNERS.find((entry) => entry.round === 6);
    expect(monaco).toBeDefined();
    expect(monaco?.corners).toHaveLength(19);
    expect(monaco?.corners.map((corner) => corner.number)).toEqual(
      Array.from({ length: 19 }, (_, index) => index + 1),
    );

    const distances = monaco?.corners.map((corner) => corner.d) ?? [];
    expect(distances[0]).toBeGreaterThanOrEqual(0);
    expect(distances[distances.length - 1]).toBeLessThan(1);
    expect([...distances].sort((a, b) => a - b)).toEqual(distances);
  });

  it('resolves a live payload by circuit name', () => {
    expect(
      getCircuitCorners({
        name: 'Circuit de Monaco',
        location: 'Monte Carlo',
        country: 'Monaco',
      }),
    ).toHaveLength(19);
  });

  it('resolves a preview payload by country when the name is a Grand Prix title', () => {
    expect(getCircuitCorners({ country: 'Monaco' })).toHaveLength(19);
  });

  it('falls back to the numeric circuit key', () => {
    expect(getCircuitCorners({ circuitKey: 22 })).toHaveLength(19);
  });

  it('does not lend Barcelona corners to the Madrid round', () => {
    // Both rounds carry circuit key 15 in the bundled canonical data, so a
    // name match must win over the key fallback.
    expect(getCircuitCorners({ name: 'Madrid Circuit' })).toEqual([]);
  });

  it('returns an empty list for an unknown circuit', () => {
    expect(getCircuitCorners({ name: 'Moon Grand Prix' })).toEqual([]);
    expect(getCircuitCorners(null)).toEqual([]);
  });
});
