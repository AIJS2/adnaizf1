// ============================================================================
// Guards for payloads that may legitimately be empty or partially missing.
// ============================================================================

/**
 * Turn a driver full name into the slug used by the driver route.
 * Returns an empty string when the name is missing, so callers can skip the
 * link instead of navigating to "/driver/".
 */
export function driverSlug(fullName?: string | null): string {
  if (!fullName || typeof fullName !== 'string') return '';
  return fullName.trim().toLowerCase().replace(/\s+/g, '_');
}

/** Same, for team routes. */
export function teamSlug(teamName?: string | null): string {
  if (!teamName || typeof teamName !== 'string') return '';
  return teamName.trim().toLowerCase().replace(/\s+/g, '_');
}

/** True when the value is a usable, non-empty array. */
export function hasItems<T>(value?: T[] | null): value is T[] {
  return Array.isArray(value) && value.length > 0;
}

/**
 * Coerce a backend numeric field (JSON number or numeric string) to a number.
 * Non-numeric and missing values fall back to `fallback`, so charts never
 * receive NaN and tables never render "NaN".
 */
export function toNumber(value: unknown, fallback: number = 0): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return fallback;
}

/**
 * Format seconds as m:ss.mmm. Returns an em dash for 0/NaN rather than a
 * meaningless "0:00.000".
 */
export function formatLapTime(seconds?: number | string | null): string {
  const value = toNumber(seconds, NaN);
  if (!Number.isFinite(value) || value <= 0) return '—';
  const m = Math.floor(value / 60);
  const s = Math.floor(value % 60);
  const ms = Math.floor((value % 1) * 1000);
  return `${m}:${s.toString().padStart(2, '0')}.${ms.toString().padStart(3, '0')}`;
}

/**
 * Max of an array of numbers, with a safe fallback.
 * `Math.max(...[])` is -Infinity, which silently breaks every chart domain
 * built from it when the payload is empty.
 */
export function safeMax(values: number[], fallback: number = 0): number {
  const finite = values.filter((v) => Number.isFinite(v));
  return finite.length ? Math.max(...finite) : fallback;
}
