// ============================================================================
// Calendar-day helpers for "next / ongoing race" selection.
//
// Why these exist: comparing `new Date(race.date + 'T00:00:00')` against
// `new Date()` is a timestamp comparison. By midday on race day, local
// midnight is already in the past, so a race happening today gets skipped and
// every "next race" surface (Dashboard hero, Race Calendar banner, Landing
// page badge) jumps to the following weekend. Comparing by whole calendar day
// fixes that class of bug in one place.
// ============================================================================

/** A `YYYY-M-D` key that ignores the time-of-day component. */
export function dayKey(d: Date): string {
  return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

/** Today's calendar-day key. */
export function todayKey(now: Date = new Date()): string {
  return dayKey(now);
}

/**
 * The minimal shape every "next race" surface needs. `Race` (calendar),
 * `RaceSummary` (dashboard analytics) and `NextRaceEvent` (backend session)
 * all structurally satisfy it, so one selector serves all three callers.
 */
export interface NextRaceCandidate {
  name: string;
  date?: string | null;
  round?: number | string;
  location?: string;
  status?: string;
}

export interface ResolvedNextRace extends NextRaceCandidate {
  /** True when the winning event is happening today (status "Ongoing"). */
  isOngoing: boolean;
}

const isFinished = (r: NextRaceCandidate): boolean =>
  r.status === 'Finished' || r.status === 'finished' || r.status === 'completed';

const isOngoing = (r: NextRaceCandidate): boolean =>
  r.status === 'Ongoing' || r.status === 'ongoing';

/**
 * Pick the single event every "next race" surface should show: the earliest
 * race whose calendar day is today or later, preferring an "Ongoing" race over
 * an "Upcoming" one on the same day, then breaking ties by round.
 *
 * Falls back to the first Upcoming candidate and finally to null, so callers
 * can render an empty state instead of a wrong race.
 */
export function resolveNextRace(
  races: NextRaceCandidate[] | null | undefined,
  now: Date = new Date(),
): ResolvedNextRace | null {
  if (!Array.isArray(races) || races.length === 0) return null;

  const tk = todayKey(now);
  const toDay = (r: NextRaceCandidate): Date | null => {
    if (!r.date) return null;
    // Two date shapes reach this helper:
    //   - "YYYY-MM-DD"            (race_analytics / calendar — date only)
    //   - "YYYY-MM-DDTHH:MM:SSZ"  (next_race_event — full ISO, UTC)
    // Both must land on the same calendar-day key, so the ISO form is reduced
    // to its date portion first. Parsing "2026-10-11T20:00:00Z" as a raw Date
    // yields Oct 12 in UTC+7 and silently shifts the day.
    const dateStr = r.date;
    const d = /^\d{4}-\d{2}-\d{2}/.test(dateStr)
      ? new Date(`${dateStr.slice(0, 10)}T00:00:00`)
      : new Date(dateStr);
    return Number.isNaN(d.getTime()) ? null : d;
  };

  const candidates = races.filter((r) => {
    if (isFinished(r)) return false;
    const d = toDay(r);
    // A race with no parseable date can still be shown (better than nothing),
    // but it loses to any race with a known future day.
    return d === null ? true : dayKey(d) >= tk;
  });

  if (candidates.length === 0) {
    // Nothing dated today-or-later: fall back to any Upcoming race so the
    // surface still renders rather than going blank.
    const fallback = races.find((r) => r.status === 'Upcoming' || r.status === 'upcoming');
    return fallback ? { ...fallback, isOngoing: false } : null;
  }

  candidates.sort((a, b) => {
    const da = toDay(a);
    const db = toDay(b);
    if (da && db) {
      const ka = dayKey(da);
      const kb = dayKey(db);
      if (ka !== kb) return da.getTime() - db.getTime();
      // Same calendar day: an ongoing race outranks an upcoming one.
      if (isOngoing(a) !== isOngoing(b)) return isOngoing(a) ? -1 : 1;
    }
    // Tie-break on round so the banner never flips between same-day events.
    const ra = Number(a.round);
    const rb = Number(b.round);
    if (Number.isFinite(ra) && Number.isFinite(rb)) return ra - rb;
    return 0;
  });

  const winner = candidates[0];
  const winnerDay = toDay(winner);
  // `isOngoing` is only trustworthy when the backend's status field agrees AND
  // the event's day really is today. A stale status on a past date (or a
  // session-level next_race_event with no status) must not read as live.
  return {
    ...winner,
    isOngoing: winnerDay !== null && dayKey(winnerDay) === tk && isOngoing(winner),
  };
}

/**
 * Resolve the event to show from the two dashboard-style sources at once,
 * guaranteeing the NAME and the COUNTDOWN TARGET come from the same object.
 *
 * `raceAnalytics` is the per-race calendar; `nextRaceEvent` is the backend's
 * session-level pointer (carries a " - Session" suffix on its name). Both are
 * merged into one candidate list and run through `resolveNextRace`, so the two
 * surfaces can never disagree the way they did when each read a different
 * field.
 */
export function resolveNextRaceFromSources(
  raceAnalytics: NextRaceCandidate[] | null | undefined,
  nextRaceEvent: NextRaceCandidate | null | undefined,
  now: Date = new Date(),
): ResolvedNextRace | null {
  const merged: NextRaceCandidate[] = [];
  if (nextRaceEvent?.date) merged.push(nextRaceEvent);
  if (Array.isArray(raceAnalytics)) merged.push(...raceAnalytics);
  if (merged.length === 0) return null;
  return resolveNextRace(merged, now);
}
