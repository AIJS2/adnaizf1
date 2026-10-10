/**
 * Tests for the payload guards in `src/utils/data.ts`.
 *
 * These back the empty-state work: with mock data removed, every chart and
 * table can be handed an empty array, a missing field, or a numeric string.
 * Each helper below exists because the naive version of it produced a broken
 * render (NaN axis, -Infinity domain, "/driver/undefined" links).
 */
import { describe, it, expect } from 'vitest';

import {
  driverSlug,
  formatLapTime,
  hasItems,
  safeMax,
  teamSlug,
  toNumber,
} from '../data';

describe('hasItems', () => {
  it('is false for every empty/missing shape an endpoint may return', () => {
    expect(hasItems(undefined)).toBe(false);
    expect(hasItems(null)).toBe(false);
    expect(hasItems([])).toBe(false);
  });

  it('is true for a populated array', () => {
    expect(hasItems([1])).toBe(true);
    expect(hasItems([{}])).toBe(true);
  });
});

describe('toNumber', () => {
  it('coerces the NumericString payload fields the backend sends', () => {
    expect(toNumber('833')).toBe(833);
    expect(toNumber('0')).toBe(0);
    expect(toNumber(12.5)).toBe(12.5);
  });

  it('falls back instead of producing NaN', () => {
    expect(toNumber(undefined)).toBe(0);
    expect(toNumber(null)).toBe(0);
    expect(toNumber('')).toBe(0);
    expect(toNumber('abc')).toBe(0);
    expect(toNumber(NaN)).toBe(0);
    expect(toNumber(undefined, 10)).toBe(10);
  });

  it('treats Infinity as absent', () => {
    expect(toNumber(Infinity, 5)).toBe(5);
  });
});

describe('safeMax', () => {
  it('never returns -Infinity for an empty payload', () => {
    // Math.max(...[]) is -Infinity, which silently corrupts every chart
    // domain built from it when the season has no standings.
    expect(safeMax([], 100)).toBe(100);
  });

  it('ignores non-finite values rather than propagating them', () => {
    expect(safeMax([NaN, Infinity, 5], 1)).toBe(5);
  });

  it('returns the real maximum when one exists', () => {
    expect(safeMax([3, 99, 7])).toBe(99);
  });
});

describe('formatLapTime', () => {
  it('formats seconds as m:ss.mmm', () => {
    expect(formatLapTime(83.456)).toBe('1:23.456');
    expect(formatLapTime(60)).toBe('1:00.000');
  });

  it('renders an em dash for absent/zero lap times', () => {
    // The old formatter returned '' for 0, which collapsed the column width.
    expect(formatLapTime(0)).toBe('—');
    expect(formatLapTime(undefined)).toBe('—');
    expect(formatLapTime(null)).toBe('—');
    expect(formatLapTime('n/a')).toBe('—');
    expect(formatLapTime(-5)).toBe('—');
  });
});

describe('driverSlug', () => {
  it('builds the route slug from a full name', () => {
    expect(driverSlug('Max Verstappen')).toBe('max_verstappen');
    expect(driverSlug('Lando  Norris')).toBe('lando_norris');
  });

  it('returns empty for a missing name so the link is not rendered', () => {
    // A missing name used to produce "/driver/undefined".
    expect(driverSlug(undefined)).toBe('');
    expect(driverSlug(null)).toBe('');
    expect(driverSlug('')).toBe('');
  });
});

describe('teamSlug', () => {
  it('builds the route slug from a team name', () => {
    expect(teamSlug('Red Bull Racing')).toBe('red_bull_racing');
  });

  it('returns empty for a missing team name', () => {
    expect(teamSlug(undefined)).toBe('');
    expect(teamSlug(null)).toBe('');
    expect(teamSlug('')).toBe('');
  });
});
