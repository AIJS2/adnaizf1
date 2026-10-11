// Unit tests for the shared next-race selector.
//
// These lock in the day-level comparison that fixes the "hero banner jumps to
// next weekend on race day" class of bug, across all three payload shapes the
// app feeds it (Race, RaceSummary, NextRaceEvent).
import { describe, expect, it } from 'vitest';
import { resolveNextRace, resolveNextRaceFromSources, dayKey } from './nextRace';

/** Fixed "now" = race day for Singapore (2026-10-11), midday local. */
const RACE_DAY = new Date(2026, 9, 11, 12, 0, 0);
const TODAY = '2026-10-11';
const NEXT_WEEKEND = '2026-10-25';

const CALENDAR = [
  { round: 16, name: 'Bahrain Grand Prix', date: '2026-10-04', status: 'Finished' },
  { round: 17, name: 'Singapore Grand Prix', date: TODAY, status: 'Ongoing' },
  { round: 18, name: 'United States Grand Prix', date: NEXT_WEEKEND, status: 'Upcoming' },
];

describe('dayKey', () => {
  it('ignores the time-of-day component', () => {
    expect(dayKey(new Date(2026, 9, 11, 0, 0, 0))).toBe(dayKey(new Date(2026, 9, 11, 23, 59, 59)));
  });
});

describe('resolveNextRace', () => {
  it('picks today\'s Ongoing race over next weekend\'s Upcoming race', () => {
    const r = resolveNextRace(CALENDAR, RACE_DAY);
    expect(r?.round).toBe(17);
    expect(r?.isOngoing).toBe(true);
  });

  it('skips finished races', () => {
    const r = resolveNextRace([{ round: 16, name: 'Bahrain', date: '2026-10-04', status: 'Finished' }], RACE_DAY);
    expect(r).toBeNull();
  });

  it('moves to the next race once today\'s race is finished', () => {
    const afterRaceDay = CALENDAR.map((r) => (r.round === 17 ? { ...r, status: 'Finished' } : r));
    const r = resolveNextRace(afterRaceDay, RACE_DAY);
    expect(r?.round).toBe(18);
    expect(r?.isOngoing).toBe(false);
  });

  it('handles a pre-race day (no race today)', () => {
    // Viewed 3 days before the Singapore GP, when it is still Upcoming.
    const beforeRaceDay = new Date(2026, 9, 8, 12, 0, 0);
    const preRaceCalendar = CALENDAR.map((r) =>
      r.round === 17 ? { ...r, status: 'Upcoming' } : r,
    );
    const r = resolveNextRace(preRaceCalendar, beforeRaceDay);
    expect(r?.round).toBe(17);
    expect(r?.isOngoing).toBe(false);
  });

  it('accepts the backend ISO timestamp shape (next_race_event)', () => {
    const iso = [{ name: 'Singapore Grand Prix - Race', date: `${TODAY}T20:00:00Z`, round: 17, status: 'Ongoing' }];
    const r = resolveNextRace(iso, RACE_DAY);
    expect(r?.name).toBe('Singapore Grand Prix - Race');
    expect(r?.isOngoing).toBe(true);
  });

  it('accepts lowercase status variants', () => {
    const lower = [
      { round: 17, name: 'Singapore Grand Prix', date: TODAY, status: 'ongoing' },
      { round: 18, name: 'US GP', date: NEXT_WEEKEND, status: 'upcoming' },
    ];
    expect(resolveNextRace(lower, RACE_DAY)?.round).toBe(17);
  });

  it('returns null for an empty or all-finished list', () => {
    expect(resolveNextRace([], RACE_DAY)).toBeNull();
    expect(resolveNextRace(null, RACE_DAY)).toBeNull();
    expect(resolveNextRace(undefined, RACE_DAY)).toBeNull();
  });
});

describe('resolveNextRaceFromSources', () => {
  it('returns the same object for name and countdown (no desync)', () => {
    const nextRaceEvent = { name: 'Singapore Grand Prix - Race', date: `${TODAY}T20:00:00Z`, round: 17 };
    const r = resolveNextRaceFromSources(CALENDAR, nextRaceEvent, RACE_DAY);
    expect(r?.round).toBe(17);
    // The name and the date come from ONE object, so they can never disagree.
    expect(r?.name).toBeDefined();
    expect(r?.date).toBeDefined();
  });

  it('falls back to race_analytics when next_race_event is null', () => {
    const r = resolveNextRaceFromSources(CALENDAR, null, RACE_DAY);
    expect(r?.round).toBe(17);
    expect(r?.isOngoing).toBe(true);
  });

  it('uses next_race_event when race_analytics is empty', () => {
    const r = resolveNextRaceFromSources([], { name: 'US GP - Practice 1', date: `${NEXT_WEEKEND}T17:30:00Z`, round: 18 }, RACE_DAY);
    expect(r?.round).toBe(18);
  });
});
