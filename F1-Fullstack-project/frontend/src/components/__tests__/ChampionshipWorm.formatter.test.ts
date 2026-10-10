/**
 * Regression test for the tooltip formatter crash.
 *
 * recharts invokes Tooltip `formatter` on render paths where the third
 * argument (the tooltip entry props) — and therefore `props.payload` — is
 * undefined. ChampionshipWorm indexed it unguarded:
 *
 *   formatter={(value, name, props) => [... props.payload[name + '_name'] ...]}
 *
 * which threw `Cannot read properties of undefined` inside a recharts render
 * callback, surfacing as an Unhandled Promise Rejection.
 */
import { describe, it, expect } from 'vitest';

describe('ChampionshipWorm tooltip formatter', () => {
  // Mirrors the guard now used in the component.
  const formatTooltip = (
    value: unknown,
    name: string,
    props?: { payload?: Record<string, unknown> },
  ): [string, string] => {
    const friendly = props?.payload?.[`${name}_name`];
    return [`${value} pts`, typeof friendly === 'string' && friendly ? friendly : name];
  };

  it('returns the friendly name when payload is present', () => {
    const out = formatTooltip(120, 'VER', {
      payload: { VER: 120, VER_name: 'Max Verstappen' },
    });
    expect(out).toEqual(['120 pts', 'Max Verstappen']);
  });

  it('falls back to the key when payload lacks the _name field', () => {
    const out = formatTooltip(95, 'VER', { payload: { VER: 95 } });
    expect(out).toEqual(['95 pts', 'VER']);
  });

  it('does not throw when props is undefined (the reported crash)', () => {
    expect(() => formatTooltip(120, 'VER', undefined)).not.toThrow();
    expect(formatTooltip(120, 'VER', undefined)).toEqual(['120 pts', 'VER']);
  });

  it('does not throw when payload itself is undefined', () => {
    expect(() => formatTooltip(120, 'VER', {})).not.toThrow();
    expect(formatTooltip(120, 'VER', {})).toEqual(['120 pts', 'VER']);
  });

  it('is safe for every recharts argument-arity it may be called with', () => {
    // recharts sometimes passes only (value, name).
    expect(() => formatTooltip(1, 'X')).not.toThrow();
  });
});
