export interface Race {
  id: string;
  name: string;
  circuit: string;
  date: string;
  round: number;
  season: number;
  status: 'upcoming' | 'ongoing' | 'completed';
}

export interface DriverProfile {
  driverId: string;
  number: number;
  code: string;
  firstName: string;
  lastName: string;
  team: string;
  teamColor: string;
  countryCode?: string;
  points?: number;
  position?: number;
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