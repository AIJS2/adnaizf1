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
  // Zero-pad month and day so the key sorts correctly as a string: without
  // padding, "2026-9-11" < "2026-9-9" (day 11 mis-sorts before day 9), which
  // breaks the >= today filter for same-month races across the single/double
  // digit boundary.
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Today's calendar-day key. */
export function todayKey(now: Date = new Date()): string {
  return dayKey(now);
}

/**
 * Return the date part only (time set to 00:00:00) for calendar-day comparisons.
 * Accepts both "YYYY-MM-DD" and "YYYY-MM-DDTHH:MM:SSZ" strings.
 */
function toDay(r: NextRaceCandidate): Date | null {
  if (!r.date) return null;
  const dateStr = r.date;
  const d = /^\d{4}-\d{2}-\d{2}/.test(dateStr)
    ? new Date(`${dateStr.slice(0, 10)}T00:00:00`)
    : new Date(dateStr);
  return Number.isNaN(d.getTime()) ? null : d;
}

/**
 * Return the exact timestamp from the date string, preserving time if available.
 * If the string lacks time, assumes 00:00:00 (midnight).
 */
function toTimestamp(r: NextRaceCandidate): Date | null {
  if (!r.date) return null;
  const dateStr = r.date;
  // If it's a full ISO timestamp (contains T or Z or is longer than 10 chars),
  // parse directly; otherwise treat as date-only with known race start (12:00 UTC).
  const hasTime = dateStr.length > 10 || /[TZ]/.test(dateStr);
  const d = hasTime ? new Date(dateStr) : new Date(`${dateStr}T12:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
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
  /**
   * The resolved lifecycle phase of the winning event:
   *  - 'future'   — a race on a later day (plain countdown).
   *  - 'race_day' — today's race, but its start time has NOT yet arrived
   *                 (show countdown + a "RACE DAY"/"TODAY" badge, never LIVE).
   *  - 'live'     — today's race and its start time HAS passed (show LIVE).
   */
  phase: RacePhase;
  /** Kept for backward compatibility: true only in the 'live' phase. */
  isOngoing: boolean;
  /** The parsed start timestamp of the winning event, when one exists. */
  startTime: Date | null;
}

export type RacePhase = 'future' | 'race_day' | 'live';

/**
 * Build the ISO timestamp the countdown components should target. Full ISO
 * strings are used as-is; date-only strings get the known race start
 * (12:00 UTC = 19:00 WIB, the standard F1 race start for the Asian rounds in
 * this season) appended so the timer points at the real start time instead of
 * local midnight.
 */
export function countdownTarget(date?: string | null): string | null {
  if (!date) return null;
  return /^\d{4}-\d{2}-\d{2}T/.test(date) ? date : `${date}T12:00:00Z`;
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
    return fallback ? { ...fallback, phase: 'future', isOngoing: false, startTime: toTimestamp(fallback) } : null;
  }

  candidates.sort((a, b) => {
    const da = toDay(a);
    const db = toDay(b);
    if (da && db) {
      const ka = dayKey(da);
      const kb = dayKey(db);
      if (ka !== kb) return da.getTime() - db.getTime();
      // Same calendar day. A full timestamp (e.g. next_race_event) is strictly
      // more informative than a date-only string (race_analytics), because
      // only it lets us resolve race_day vs live. It therefore wins the
      // tie-break BEFORE the ongoing-status check — next_race_event often
      // carries no status field at all, so the status check would otherwise
      // demote it behind a date-only "Ongoing" entry and force a 12:00Z
      // default start, mislabeling a race that has already begun.
      const hasTimeA = Boolean(a.date && a.date.length > 10);
      const hasTimeB = Boolean(b.date && b.date.length > 10);
      if (hasTimeA !== hasTimeB) return hasTimeA ? -1 : 1;
      // Same day AND same time precision: an ongoing race outranks an
      // upcoming one.
      if (isOngoing(a) !== isOngoing(b)) return isOngoing(a) ? -1 : 1;
    }
    // Tie-break on round so the banner never flips between same-day events.
    const ra = Number(a.round);
    const rb = Number(b.round);
    if (Number.isFinite(ra) && Number.isFinite(rb)) return ra - rb;
    return 0;
  });

  const winner = candidates[0];
  const winnerDayCalendar = toDay(winner);
  const winnerStartTime = toTimestamp(winner);

  // ── 3-state lifecycle ──────────────────────────────────────────────────
  // The status field alone cannot distinguish "today, waiting for lights"
  // from "today, race underway". Both carry status 'Ongoing', but only the
  // second should read LIVE. We therefore compare the parsed start
  // timestamp against `now`, treating the timestamp as authoritative when the
  // event is happening today:
  //   now < start, day is today   -> 'race_day'  (countdown + RACE DAY badge)
  //   now >= start, day is today  -> 'live'      (LIVE badge, no countdown)
  //   day is later                -> 'future'    (plain countdown)
  //
  // Two ways an event counts as "happening today":
  //   1. it carries an Ongoing status, OR
  //   2. it has no status at all (the backend's next_race_event pointer), in
  //      which case the calendar day + start timestamp alone decide.
  // A Finished race never reaches here (it is filtered out above), and a
  // date-only string with no usable time degrades to 'future'.
  let phase: RacePhase = 'future';
  const happeningToday =
    winnerDayCalendar !== null && dayKey(winnerDayCalendar) === tk;
  if (happeningToday && winnerStartTime !== null && (isOngoing(winner) || winner.status === undefined || winner.status === null)) {
    phase = now.getTime() >= winnerStartTime.getTime() ? 'live' : 'race_day';
  }

  return {
    ...winner,
    phase,
    isOngoing: phase === 'live',
    startTime: winnerStartTime,
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
