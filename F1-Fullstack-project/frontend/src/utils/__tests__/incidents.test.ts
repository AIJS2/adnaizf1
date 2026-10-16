import { describe, it, expect } from 'vitest';
import { incidentBreakdownLabel, incidentTooltip } from '../incidents';
import type { IncidentDetail } from '../../types/f1';

const incident = (overrides?: Partial<IncidentDetail>): IncidentDetail => ({
  round: 5,
  race_name: 'Canadian Grand Prix',
  location: 'Montréal',
  session_type: 'Race',
  status: 'Retired',
  grid: 1,
  position_text: 'DNF',
  ...overrides,
});

describe('incidentBreakdownLabel', () => {
  it('combines Grand Prix and Sprint counts', () => {
    expect(incidentBreakdownLabel(2, 1)).toBe('2 GP • 1 SPRINT');
  });

  it('keeps a zero side visible for sprint-only incidents', () => {
    expect(incidentBreakdownLabel(0, 1)).toBe('0 GP • 1 SPRINT');
  });

  it('returns undefined when there are no incidents', () => {
    expect(incidentBreakdownLabel(0, 0)).toBeUndefined();
  });
});

describe('incidentTooltip', () => {
  it('lists every incident with its session type', () => {
    const tooltip = incidentTooltip([
      incident(),
      incident({ round: 17, race_name: 'Singapore Grand Prix', session_type: 'Sprint' }),
    ]);
    expect(tooltip).toBe('Canadian Grand Prix (Race), Singapore Grand Prix (Sprint)');
  });

  it('returns undefined for an empty breakdown', () => {
    expect(incidentTooltip([])).toBeUndefined();
  });
});
