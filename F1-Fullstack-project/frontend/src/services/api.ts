// ---------------------------------------------------------------------------
// Payload types mirroring the FastF1 backend responses.
// ---------------------------------------------------------------------------

import { API_URL } from '../config';
import type {
  DashboardData,
  DashboardDriverStanding,
  DashboardTeamStanding,
  DriverProfile,
  DriverProgressionEntry,
  DriverStatsInfo,
  DriverTeammateInfo,
  NumericString,
  Race,
  RaceSummary,
  SessionResultEntry,
  TelemetryFlatPoint,
  TeamProgressionEntry,
  TeamProfile,
} from '../types/f1';

/** `/api/driver/{year}/{driver_id}` response body. */
export interface DriverProfilePayload {
  name: string;
  id: string;
  abbreviation?: string;
  driver_number?: NumericString;
  team: string;
  position?: NumericString;
  points?: NumericString;
  wins?: NumericString;
  podiums?: NumericString;
  poles?: NumericString;
  best_finish?: NumericString | null;
  avg_finish?: NumericString | null;
  dnfs?: NumericString;
  dnss?: NumericString;
  progression?: DriverProgressionEntry[];
  teammate?: DriverTeammateInfo | null;
}

export type {
  DashboardData,
  DashboardDriverStanding,
  DashboardTeamStanding,
  DriverProgressionEntry,
  DriverTeammateInfo,
  RaceSummary,
};

/** `/api/races/{year}` response body. */
export interface RacesPayload {
  races?: Race[];
  [key: string]: unknown;
}

/** `/api/race/{year}/{round}` response body. */
export interface RaceDetailsPayload {
  [key: string]: unknown;
}

/** `/api/championship/{year}` response body. */
export interface ChampionshipPayload {
  drivers?: DriverProfile[];
  teams?: TeamProfile[];
  session_results?: SessionResultEntry[];
  [key: string]: unknown;
}

/** `/api/team/{year}/{team_id}` response body. */
export interface TeamProfilePayload {
  id?: string;
  name?: string;
  position?: NumericString;
  points?: NumericString;
  wins?: NumericString;
  podiums?: NumericString;
  points_last_race?: NumericString;
  drivers?: DriverProfile[];
  progression?: TeamProgressionEntry[];
  [key: string]: unknown;
}

/** `/api/telemetry/{year}/{round}?drivers=...` response body. */
export interface TelemetryComparePayload {
  telemetry?: TelemetryFlatPoint[];
  drivers?: string[];
  driver_info?: Record<string, DriverStatsInfo>;
  unavailable_drivers?: string[];
  unavailable_reasons?: Record<string, string>;
  [key: string]: unknown;
}

/** Error envelope returned by the FastF1 backend on failure. */
export interface ApiErrorPayload {
  error?: string;
  [key: string]: unknown;
}

/**
 * Shape returned by every endpoint: either the success payload or the
 * `{ error: "..." }` envelope. Callers that only handle the success case can
 * narrow with `if (isApiError(data)) throw ...`.
 */
export type ApiResult<T> = T | ApiErrorPayload;

/** Narrow an API result to the success payload, throwing on the error envelope. */
export function isApiError<T>(payload: ApiResult<T>): payload is ApiErrorPayload {
  return (
    typeof payload === 'object' &&
    payload !== null &&
    'error' in payload &&
    typeof (payload as ApiErrorPayload).error === 'string'
  );
}

/** Fetch one endpoint and narrow the JSON body to `T`. */
async function fetchJson<T>(path: string, fallbackMessage: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) throw new Error(fallbackMessage);
  const payload: unknown = await response.json();
  if (isApiError(payload)) throw new Error(payload.error ?? fallbackMessage);
  return payload as T;
}

// ---------------------------------------------------------------------------
// Fetch functions
// ---------------------------------------------------------------------------

export const fetchDashboardData = async (year: number): Promise<DashboardData> =>
  fetchJson<DashboardData>(`/api/dashboard/${year}`, 'Failed to fetch dashboard data');

export const fetchAllRaces = async (year: number): Promise<RacesPayload> =>
  fetchJson<RacesPayload>(`/api/races/${year}`, 'Failed to fetch races');

export const fetchRaceDetails = async (
  year: number,
  round: number | string,
): Promise<RaceDetailsPayload> =>
  fetchJson<RaceDetailsPayload>(`/api/race/${year}/${round}`, 'Failed to fetch race details');

export const fetchChampionship = async (year: number): Promise<ChampionshipPayload> =>
  fetchJson<ChampionshipPayload>(`/api/championship/${year}`, 'Failed to fetch championship standings');

export const fetchDriverProfile = async (
  year: number,
  id: string,
): Promise<DriverProfilePayload> =>
  fetchJson<DriverProfilePayload>(`/api/driver/${year}/${id}`, 'Failed to fetch driver profile');

export const fetchTeamProfile = async (
  year: number,
  id: string,
): Promise<TeamProfilePayload> =>
  fetchJson<TeamProfilePayload>(`/api/team/${year}/${id}`, 'Failed to fetch team profile');

export const fetchTelemetryCompare = async (
  year: number,
  round: number | string,
  drivers: string,
): Promise<TelemetryComparePayload> =>
  fetchJson<TelemetryComparePayload>(
    `/api/telemetry/${year}/${round}?drivers=${encodeURIComponent(drivers)}`,
    'Failed to fetch telemetry',
  );
