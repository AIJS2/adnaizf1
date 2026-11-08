import { describe, it, expect } from 'vitest';
import { buildPreviewCircuit } from '../liveCircuit';
import {
  LIVE_TIMING_UNAVAILABLE_TITLE,
  LIVE_TIMING_UNAVAILABLE_MESSAGE,
  REAL_DATA_ONLY_NOTE,
} from '../liveTimingCopy';
import { getDriverColor, getTeamColor, teamColors, teamLogos } from '../../data/teamData';
import type { CircuitGeometry } from '../../data/circuitPaths';

export function verifyTeamColorLookup(code: string, team: string): string {
  return getDriverColor(code, team);
}

describe('liveCircuit, liveTimingCopy & teamData utilities', () => {
  it('buildPreviewCircuit scales canonical geometry into a 1000-unit viewBox SVG path', () => {
    const geom: CircuitGeometry = {
      round: 1,
      circuitKey: 10,
      name: 'Albert Park Circuit',
      location: 'Melbourne',
      country: 'Australia',
      points: [
        { x: 0, y: 0, d: 0 },
        { x: 1000, y: 0, d: 0.25 },
        { x: 1000, y: 500, d: 0.5 },
        { x: 0, y: 500, d: 0.75 },
      ],
    };

    const preview = buildPreviewCircuit(geom);
    expect(preview.key).toBe('preview-1');
    expect(preview.name).toBe('Albert Park Circuit');
    expect(preview.viewBox).toBe('0 0 1000 1000');
    expect(preview.path.startsWith('M ')).toBe(true);
    expect(preview.path.endsWith(' Z')).toBe(true);
  });

  it('exports consistent live timing paywall copy strings', () => {
    expect(LIVE_TIMING_UNAVAILABLE_TITLE).toBe('LIVE TIMING UNAVAILABLE');
    expect(LIVE_TIMING_UNAVAILABLE_MESSAGE).toContain('Real-time timing requires');
    expect(REAL_DATA_ONLY_NOTE).toContain('real data only');
  });

  it('resolves driver and constructor colors and logos via teamData', () => {
    expect(verifyTeamColorLookup('VER', 'Red Bull Racing')).toBe('#3671C6');
    expect(getDriverColor('HAM', 'Ferrari', true)).toBe('#FF5C77');
    expect(getDriverColor('UNKNOWN', 'McLaren')).toBe('#FF8000');
    expect(getTeamColor('Scuderia Ferrari')).toBe('#E8002D');
    expect(getTeamColor('')).toBe('#888888');
    expect(teamColors['Red Bull Racing']).toBe('#3671C6');
    expect(teamColors['NOR']).toBe('#FF8000');
    expect(teamLogos['Ferrari']).toBeDefined();
  });
});
