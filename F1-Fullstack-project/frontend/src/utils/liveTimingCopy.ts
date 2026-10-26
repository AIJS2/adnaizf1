/**
 * Shared copy for the live-timing paywall state.
 *
 * The backend reports `status: "unavailable_subscription"` when a session is
 * live but the upstream feed is gated. Keep the wording in one place so the
 * timing page and the team-radio panel cannot drift apart.
 */
export const LIVE_TIMING_UNAVAILABLE_TITLE = 'LIVE TIMING UNAVAILABLE';

export const LIVE_TIMING_UNAVAILABLE_MESSAGE =
  "Real-time timing requires a paid data feed that isn't connected yet. Live timing is coming soon.";

export const REAL_DATA_ONLY_NOTE =
  'This feed reports real data only and never simulates telemetry.';
