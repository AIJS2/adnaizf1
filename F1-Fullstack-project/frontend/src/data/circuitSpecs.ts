// Official FIA Formula 1 Circuit Specifications for calendar venues.
// Updated for 2026 Regulations: DRS abolished, replaced by Active Aerodynamics
// (X-Mode straight / Z-Mode cornering) and Manual Override Mode (MOM) electrical boost.
export interface CircuitSpec {
  circuitName: string;
  length: string;          // e.g. "4.304 km"
  turns: number;           // e.g. 17
  laps: number;            // e.g. 71
  raceDistance: string;    // e.g. "305.35 km"
  activeAeroZones: number; // 2026 designated straight-line Active Aero (X-Mode) zones
  drsZones?: number;       // Legacy pre-2026 DRS zones for historical reference
  lapRecord?: string;      // e.g. "1:17.774"
}

export const CIRCUIT_SPECS: Record<string, CircuitSpec> = {
  // Mexico City
  "mexico": {
    circuitName: "Autódromo Hermanos Rodríguez",
    length: "4.304 km",
    turns: 17,
    laps: 71,
    raceDistance: "305.35 km",
    activeAeroZones: 3,
    drsZones: 3,
    lapRecord: "1:17.774",
  },
  // Australia
  "australia": {
    circuitName: "Albert Park Circuit",
    length: "5.278 km",
    turns: 14,
    laps: 58,
    raceDistance: "306.12 km",
    activeAeroZones: 4,
    drsZones: 4,
    lapRecord: "1:19.813",
  },
  // China
  "china": {
    circuitName: "Shanghai International Circuit",
    length: "5.451 km",
    turns: 16,
    laps: 56,
    raceDistance: "305.07 km",
    activeAeroZones: 2,
    drsZones: 2,
    lapRecord: "1:32.238",
  },
  // Japan
  "japan": {
    circuitName: "Suzuka Circuit",
    length: "5.807 km",
    turns: 18,
    laps: 53,
    raceDistance: "307.47 km",
    activeAeroZones: 1,
    drsZones: 1,
    lapRecord: "1:30.983",
  },
  // Bahrain
  "bahrain": {
    circuitName: "Bahrain International Circuit",
    length: "5.412 km",
    turns: 15,
    laps: 57,
    raceDistance: "308.24 km",
    activeAeroZones: 3,
    drsZones: 3,
    lapRecord: "1:31.447",
  },
  // Saudi Arabia
  "saudi": {
    circuitName: "Jeddah Corniche Circuit",
    length: "6.174 km",
    turns: 27,
    laps: 50,
    raceDistance: "308.45 km",
    activeAeroZones: 3,
    drsZones: 3,
    lapRecord: "1:30.734",
  },
  // Miami
  "miami": {
    circuitName: "Miami International Autodrome",
    length: "5.412 km",
    turns: 19,
    laps: 57,
    raceDistance: "308.33 km",
    activeAeroZones: 3,
    drsZones: 3,
    lapRecord: "1:29.708",
  },
  // Imola
  "imola": {
    circuitName: "Autodromo Enzo e Dino Ferrari",
    length: "4.909 km",
    turns: 19,
    laps: 63,
    raceDistance: "309.05 km",
    activeAeroZones: 1,
    drsZones: 1,
    lapRecord: "1:15.484",
  },
  // Monaco
  "monaco": {
    circuitName: "Circuit de Monaco",
    length: "3.337 km",
    turns: 19,
    laps: 78,
    raceDistance: "260.29 km",
    activeAeroZones: 1,
    drsZones: 1,
    lapRecord: "1:12.909",
  },
  // Canada
  "canada": {
    circuitName: "Circuit Gilles-Villeneuve",
    length: "4.361 km",
    turns: 14,
    laps: 70,
    raceDistance: "305.27 km",
    activeAeroZones: 3,
    drsZones: 3,
    lapRecord: "1:13.078",
  },
  // Spain
  "spain": {
    circuitName: "Circuit de Barcelona-Catalunya",
    length: "4.657 km",
    turns: 14,
    laps: 66,
    raceDistance: "307.24 km",
    activeAeroZones: 2,
    drsZones: 2,
    lapRecord: "1:16.330",
  },
  // Austria
  "austria": {
    circuitName: "Red Bull Ring",
    length: "4.318 km",
    turns: 10,
    laps: 71,
    raceDistance: "306.45 km",
    activeAeroZones: 3,
    drsZones: 3,
    lapRecord: "1:05.619",
  },
  // Great Britain
  "britain": {
    circuitName: "Silverstone Circuit",
    length: "5.891 km",
    turns: 18,
    laps: 52,
    raceDistance: "306.20 km",
    activeAeroZones: 2,
    drsZones: 2,
    lapRecord: "1:27.097",
  },
  // Hungary
  "hungary": {
    circuitName: "Hungaroring",
    length: "4.381 km",
    turns: 14,
    laps: 70,
    raceDistance: "306.63 km",
    activeAeroZones: 2,
    drsZones: 2,
    lapRecord: "1:16.627",
  },
  // Belgium
  "belgium": {
    circuitName: "Circuit de Spa-Francorchamps",
    length: "7.004 km",
    turns: 19,
    laps: 44,
    raceDistance: "308.05 km",
    activeAeroZones: 2,
    drsZones: 2,
    lapRecord: "1:44.701",
  },
  // Netherlands
  "netherlands": {
    circuitName: "Circuit Zandvoort",
    length: "4.259 km",
    turns: 14,
    laps: 72,
    raceDistance: "306.59 km",
    activeAeroZones: 2,
    drsZones: 2,
    lapRecord: "1:11.097",
  },
  // Italy / Monza
  "monza": {
    circuitName: "Autodromo Nazionale Monza",
    length: "5.793 km",
    turns: 11,
    laps: 53,
    raceDistance: "306.72 km",
    activeAeroZones: 2,
    drsZones: 2,
    lapRecord: "1:21.046",
  },
  // Azerbaijan
  "azerbaijan": {
    circuitName: "Baku City Circuit",
    length: "6.003 km",
    turns: 20,
    laps: 51,
    raceDistance: "306.05 km",
    activeAeroZones: 2,
    drsZones: 2,
    lapRecord: "1:43.009",
  },
  // Singapore
  "singapore": {
    circuitName: "Marina Bay Street Circuit",
    length: "4.940 km",
    turns: 19,
    laps: 62,
    raceDistance: "306.14 km",
    activeAeroZones: 3,
    drsZones: 3,
    lapRecord: "1:34.486",
  },
  // USA / Austin
  "united states": {
    circuitName: "Circuit of the Americas",
    length: "5.513 km",
    turns: 20,
    laps: 56,
    raceDistance: "308.41 km",
    activeAeroZones: 2,
    drsZones: 2,
    lapRecord: "1:36.169",
  },
  // Brazil
  "brazil": {
    circuitName: "Autódromo José Carlos Pace",
    length: "4.309 km",
    turns: 15,
    laps: 71,
    raceDistance: "305.88 km",
    activeAeroZones: 2,
    drsZones: 2,
    lapRecord: "1:10.540",
  },
  // Las Vegas
  "las vegas": {
    circuitName: "Las Vegas Strip Circuit",
    length: "6.201 km",
    turns: 17,
    laps: 50,
    raceDistance: "309.96 km",
    activeAeroZones: 2,
    drsZones: 2,
    lapRecord: "1:35.490",
  },
  // Qatar
  "qatar": {
    circuitName: "Lusail International Circuit",
    length: "5.419 km",
    turns: 16,
    laps: 57,
    raceDistance: "308.61 km",
    activeAeroZones: 1,
    drsZones: 1,
    lapRecord: "1:24.319",
  },
  // Abu Dhabi
  "abu dhabi": {
    circuitName: "Yas Marina Circuit",
    length: "5.281 km",
    turns: 16,
    laps: 58,
    raceDistance: "306.18 km",
    activeAeroZones: 2,
    drsZones: 2,
    lapRecord: "1:26.103",
  },
};

/**
 * Resolves circuit specs by querying location, country, or event name.
 */
export function getCircuitSpec(query?: string | null): CircuitSpec {
  if (!query) {
    return {
      circuitName: "FIA Championship Circuit",
      length: "5.300 km",
      turns: 16,
      laps: 57,
      raceDistance: "306.00 km",
      activeAeroZones: 2,
      drsZones: 2,
    };
  }

  const normalized = query.toLowerCase().trim();

  // Direct key lookup
  for (const [key, spec] of Object.entries(CIRCUIT_SPECS)) {
    if (normalized.includes(key)) {
      return spec;
    }
  }

  // Common aliases
  if (normalized.includes("albert park") || normalized.includes("melbourne")) return CIRCUIT_SPECS["australia"];
  if (normalized.includes("shanghai")) return CIRCUIT_SPECS["china"];
  if (normalized.includes("suzuka")) return CIRCUIT_SPECS["japan"];
  if (normalized.includes("sakhir")) return CIRCUIT_SPECS["bahrain"];
  if (normalized.includes("jeddah")) return CIRCUIT_SPECS["saudi"];
  if (normalized.includes("silverstone") || normalized.includes("british") || normalized.includes("uk")) return CIRCUIT_SPECS["britain"];
  if (normalized.includes("hungaroring") || normalized.includes("budapest")) return CIRCUIT_SPECS["hungary"];
  if (normalized.includes("spa") || normalized.includes("francorchamps")) return CIRCUIT_SPECS["belgium"];
  if (normalized.includes("zandvoort") || normalized.includes("dutch")) return CIRCUIT_SPECS["netherlands"];
  if (normalized.includes("baku")) return CIRCUIT_SPECS["azerbaijan"];
  if (normalized.includes("marina bay")) return CIRCUIT_SPECS["singapore"];
  if (normalized.includes("cota") || normalized.includes("austin") || normalized.includes("texas")) return CIRCUIT_SPECS["united states"];
  if (normalized.includes("hermanos rodriguez") || normalized.includes("mexico city")) return CIRCUIT_SPECS["mexico"];
  if (normalized.includes("interlagos") || normalized.includes("sao paulo") || normalized.includes("são paulo")) return CIRCUIT_SPECS["brazil"];
  if (normalized.includes("vegas") || normalized.includes("strip")) return CIRCUIT_SPECS["las vegas"];
  if (normalized.includes("lusail") || normalized.includes("doha")) return CIRCUIT_SPECS["qatar"];
  if (normalized.includes("yas marina") || normalized.includes("yas island")) return CIRCUIT_SPECS["abu dhabi"];
  if (normalized.includes("catalunya") || normalized.includes("barcelona")) return CIRCUIT_SPECS["spain"];
  if (normalized.includes("spielberg") || normalized.includes("red bull ring")) return CIRCUIT_SPECS["austria"];
  if (normalized.includes("montreal") || normalized.includes("gilles")) return CIRCUIT_SPECS["canada"];
  if (normalized.includes("monte carlo")) return CIRCUIT_SPECS["monaco"];
  if (normalized.includes("emilia romagna")) return CIRCUIT_SPECS["imola"];
  if (normalized.includes("italy") || normalized.includes("italian")) return CIRCUIT_SPECS["monza"];

  return {
    circuitName: "Grand Prix Circuit",
    length: "5.300 km",
    turns: 16,
    laps: 57,
    raceDistance: "306.00 km",
    activeAeroZones: 2,
    drsZones: 2,
  };
}
