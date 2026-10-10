export interface Race {
  id: string;
  name: string;
  circuit: string;
  date: string;
  round: number;
  season: number;
  status: 'upcoming' | 'ongoing' | 'completed' | 'Upcoming' | 'Ongoing' | 'Finished' | string;
}

export interface DriverProfile {
  driverId: string;
  number: number;
  code: string;
  firstName: string;
  lastName: string;
  name?: string;
  team: string;
  teamColor: string;
  countryCode?: string;
  points?: number;
  position?: number;
  wins?: number;
  podiums?: number;
  points_share?: number;
  id?: string;
  abbreviation?: string;
  driver_number?: number;
}

export interface SectorTimeData {
  time: string;
  color: 'purple' | 'green' | 'yellow' | 'neutral' | '';
}

export interface LiveTimingLine {
  position: string | number;
  driver: string;
  team: string;
  status: string;
  gap: string;
  interval: string;
  lastLap: string;
  lap_color: string;
  sector1: string;
  s1_color: string;
  sector2: string;
  s2_color: string;
  sector3: string;
  s3_color: string;
  pits: number;
  tyre: string;
  tyre_age: number;
  progress?: number;
}


export interface LiveTimingWeather {
  air: string;
  track: string;
  humidity: string;
  rain: string;
}

export interface LiveTimingMessage {
  time: string;
  msg: string;
  type?: string;
}

export interface LiveTimingData {
  lines: LiveTimingLine[];
  trackStatus: string;
  weather: LiveTimingWeather;
  messages: LiveTimingMessage[];
  isLiveSession?: boolean;
}

export interface TelemetryDataPoint {
  x?: number;
  y?: number;
  distance: number;
  dominant_driver?: string;
  speed?: Record<string, number>;
  throttle?: Record<string, number>;
  brake?: Record<string, number>;
  gear?: Record<string, number>;
  rpm?: Record<string, number>;
  [key: string]: unknown; // fallback for dynamic driver data
}

export interface TeamDriverInfo {
  team: string;
  color?: string;
  name?: string;
}

export interface TelemetryFlatPoint {
  distance: number;
  [key: string]: string | number | undefined;
}

export interface DriverStatsInfo {
  team: string;
  name?: string;
  lap_time?: string;
  compound?: string;
  max_speed?: number;
  avg_speed?: number;
}

export interface TelemetryResponse {
  telemetry: TelemetryFlatPoint[];
  drivers: string[];
  driver_info: Record<string, DriverStatsInfo>;
  unavailable_drivers?: string[];
  unavailable_reasons?: Record<string, string>;
}

export interface TeamProfile { 
  id: string; 
  name: string; 
  position?: number; 
  points?: number; 
  wins?: number; 
  podiums?: number; 
  points_last_race?: number; 
  drivers?: DriverProfile[]; 
  progression?: Record<string, number>[]; 
}

/**
 * A driver/team entry inside the race `results` array.
 * Only the fields consumed by the race chart components are declared;
 * extra FastF1 payload fields are permitted via the index signature.
 */
export interface RaceResultEntry {
  full_name?: string;
  abbreviation?: string;
  team_name?: string;
  [key: string]: unknown;
}

/**
 * A single row of the per-driver race series charts (lap chart, gap chart,
 * lap times chart). `lap` is the X axis; every other key is a driver
 * abbreviation mapped to that driver's value for the lap.
 */
export interface RaceSeriesPoint {
  lap: number | string;
  [driverAbbr: string]: number | string | null | undefined;
}

/**
 * A single row of the championship session-results payload.
 * `Points` arrives as a numeric string from FastF1, hence parseFloat() at
 * every call site.
 */
export interface SessionResultEntry {
  RoundNumber: number;
  Points?: NumericString;
  FullName?: string;
  TeamName?: string;
  [key: string]: unknown;
}

/** A value that may arrive as a JSON number or a numeric string. */
export type NumericString = string | number;
