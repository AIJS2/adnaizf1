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
  /** Present on the FastF1 error envelope instead of the fields above. */
  error?: string;
  /** FastAPI validation errors also arrive under `detail`. */
  detail?: string;
  [key: string]: unknown;
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

// ---------------------------------------------------------------------------
// `/api/race/{year}/{round}` payload shapes
// ---------------------------------------------------------------------------

/** One row of the practice/qualifying/sprint-qualifying result tables. */
export interface SessionResultRow {
  position: NumericString;
  driver_number: NumericString;
  full_name: string;
  team_name: string;
  abbreviation?: string;
  time: string | null;
  status?: string;
  q1?: string | null;
  q2?: string | null;
  q3?: string | null;
  laps?: NumericString;
  points?: NumericString;
  gap_to_leader?: string | null;
  interval?: string | null;
}

/**
 * One row of the starting-grid table. `grid_position` is read either directly
 * or through the `posKey` prop (a dynamic key), so the index signature keeps
 * that lookup legal while the reserved keys keep their exact types.
 */
export interface GridRow extends SessionResultRow {
  grid_position?: NumericString;
  [gridKey: string]: unknown;
}

/** One stint inside a driver's `tyre_strategy` entry. */
export interface TyreStint {
  stint: NumericString;
  compound: string;
  start_lap: NumericString;
  end_lap: NumericString;
  laps: NumericString;
}

/** One driver's entry in the `tyre_strategy` array. */
export interface TyreStrategyEntry {
  driver: string;
  full_name?: string;
  team_name: string;
  driver_number?: NumericString;
  position: NumericString;
  total_laps?: NumericString;
  stints?: TyreStint[];
  pit_laps?: NumericString[];
}

/** One driver's entry in the `speed_traps` array. */
export interface SpeedTrapEntry {
  driver: string;
  full_name?: string;
  team_name: string;
  driver_number?: NumericString;
  speed: number;
  position: NumericString;
  rank?: NumericString;
}

/**
 * One driver's entry in the `sector_matrix` array. `s1`/`s2`/`s3` hold the
 * formatted best-sector times and the matching `*_purple` flags mark session
 * bests; `${sector}_purple` is read with a template key, so the index
 * signature keeps that lookup legal.
 */
export interface SectorMatrixEntry {
  driver: string;
  full_name?: string;
  team_name: string;
  driver_number?: NumericString;
  position: NumericString;
  s1: string;
  s1_purple?: boolean;
  s2: string;
  s2_purple?: boolean;
  s3: string;
  s3_purple?: boolean;
  ideal_lap?: string;
  actual_lap?: string;
  potential_gain?: number;
  top_speed?: number;
  [sectorKey: string]: unknown;
}

/** One row of the `weather_info` array. */
export interface WeatherSample {
  time_offset: number;
  air_temp: number;
  track_temp: number;
  humidity: number;
  rainfall: boolean;
}

/** One FIA race-control message rendered by RaceControlMessages. */
export interface RaceControlMessage {
  time?: string;
  category?: string;
  flag?: string;
  message: string;
  [key: string]: unknown;
}

/** The `race_control_messages` payload plus the session status flag. */
export interface RaceControlFeed {
  messages?: RaceControlMessage[];
  status?: string;
}

/** Payload accepted by every `RaceTables` table component. */
export interface RaceTableProps {
  data?: SessionResultRow[];
}

/** Payload accepted by `GridTable`. */
export interface GridTableProps {
  data?: GridRow[];
  posKey?: string;
}

/** Payload accepted by `TyreStrategyTable`. */
export interface TyreStrategyTableProps {
  tyreData?: TyreStrategyEntry[];
}

/** Payload accepted by `SpeedSectorsTable`. */
export interface SpeedSectorsTableProps {
  speedTraps?: SpeedTrapEntry[];
  sectorMatrix?: SectorMatrixEntry[];
}

/** Payload accepted by `WeatherChart`. */
export interface WeatherChartProps {
  weatherData?: WeatherSample[];
}

