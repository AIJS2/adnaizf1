import type { IncidentDetail } from '../types/f1';

/** "2 GP • 1 SPRINT" sub-label for an incident card, or undefined at zero. */
export const incidentBreakdownLabel = (
  raceCount: number,
  sprintCount: number,
): string | undefined =>
  raceCount + sprintCount > 0 ? `${raceCount} GP • ${sprintCount} SPRINT` : undefined;

/** Tooltip listing every incident of a DNF/DNS breakdown array. */
export const incidentTooltip = (details: IncidentDetail[]): string | undefined =>
  details.length > 0
    ? details.map((detail) => `${detail.race_name} (${detail.session_type})`).join(', ')
    : undefined;
