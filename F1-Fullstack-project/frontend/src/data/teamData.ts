// src/data/teamData.ts
// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH untuk logo & warna semua tim F1 musim 2026.
// ─────────────────────────────────────────────────────────────

import alpineLogo      from '../assets/logos/alpine.svg';
import astonMartinLogo from '../assets/logos/aston-martin.svg';
import audiLogo        from '../assets/logos/audif1.svg';
import cadillacLogo    from '../assets/logos/cadillac.svg';
import ferrariLogo     from '../assets/logos/ferrari.svg';
import haasLogo        from '../assets/logos/haas.svg';
import mclarenLogo     from '../assets/logos/mclaren.svg';
import mercedesLogo    from '../assets/logos/mercedes-star.svg';
import rbLogo          from '../assets/logos/rb.svg';
import redBullLogo     from '../assets/logos/red-bull-racing.svg';
import sauberLogo      from '../assets/logos/sauber.svg';
import williamsLogo    from '../assets/logos/williams.svg';

export const teamLogos: Record<string, string> = {
  "Alpine":             alpineLogo,
  "Alpine F1 Team":     alpineLogo,
  "Aston Martin":       astonMartinLogo,
  "Audi":               audiLogo,
  "Audi F1 Team":       audiLogo,
  "Cadillac":           cadillacLogo,
  "Cadillac F1 Team":   cadillacLogo,
  "Andretti Cadillac":  cadillacLogo,
  "Ferrari":            ferrariLogo,
  "Scuderia Ferrari":   ferrariLogo,
  "Haas F1 Team":       haasLogo,
  "Haas":               haasLogo,
  "McLaren":            mclarenLogo,
  "Mercedes":           mercedesLogo,
  "RB":                 rbLogo,
  "RB F1 Team":         rbLogo,
  "Racing Bulls":       rbLogo,
  "Red Bull Racing":    redBullLogo,
  "Red Bull":           redBullLogo,
  "Sauber":             sauberLogo,
  "Kick Sauber":        sauberLogo,
  "Williams":           williamsLogo,
};

export const TEAM_COLORS_2026: Record<string, string> = {
  // Ferrari
  "ferrari": "#E8002D",
  "scuderia ferrari": "#E8002D",
  // McLaren
  "mclaren": "#FF8000",
  "mclaren f1 team": "#FF8000",
  // Red Bull Racing
  "red bull racing": "#3671C6",
  "red bull": "#3671C6",
  "oracle red bull racing": "#3671C6",
  // Mercedes
  "mercedes": "#27F4D2",
  "mercedes-amg": "#27F4D2",
  "mercedes-amg petronas": "#27F4D2",
  // Aston Martin
  "aston martin": "#229971",
  "aston martin aramco": "#229971",
  // Williams
  "williams": "#64C4FF",
  "williams racing": "#64C4FF",
  // Alpine — BWT Alpine Pink #FF87BC (secondary #0093CC) agar tidak bentrok
  // dengan garis biru Red Bull / Williams / Racing Bulls di Track Map
  "alpine": "#FF87BC",
  "alpine f1 team": "#FF87BC",
  "bwt alpine": "#FF87BC",
  "bwt alpine f1 team": "#FF87BC",
  "alpine secondary": "#0093CC",
  // Racing Bulls
  "racing bulls": "#6692FF",
  "rb": "#6692FF",
  "rb f1 team": "#6692FF",
  "vcarb": "#6692FF",
  "visa cash app rb": "#6692FF",
  // Audi / Kick Sauber — Neon Emerald / Electric Lime #00E701
  "audi": "#00E701",
  "audi f1 team": "#00E701",
  "sauber": "#00E701",
  "kick sauber": "#00E701",
  "stake f1 team kick sauber": "#00E701",
  // Haas F1 Team
  "haas f1 team": "#B6BABD",
  "haas": "#B6BABD",
  "moneygram haas f1 team": "#B6BABD",
  // Cadillac F1 Team
  "cadillac": "#D4AF37",
  "cadillac f1 team": "#D4AF37",
  "andretti cadillac": "#D4AF37",
};

export interface DriverColorConfig {
  primary: string;
  secondary: string;
  team: string;
  isTeammate2?: boolean;
}

export const DRIVER_TEAM_COLORS_2026: Record<string, DriverColorConfig> = {
  // Ferrari
  LEC: { primary: "#E8002D", secondary: "#FF5C77", team: "Ferrari" },
  HAM: { primary: "#E8002D", secondary: "#FF5C77", team: "Ferrari", isTeammate2: true },
  // McLaren
  NOR: { primary: "#FF8000", secondary: "#FFB703", team: "McLaren" },
  PIA: { primary: "#FF8000", secondary: "#FFB703", team: "McLaren", isTeammate2: true },
  // Red Bull Racing
  VER: { primary: "#3671C6", secondary: "#6096FD", team: "Red Bull Racing" },
  HAD: { primary: "#3671C6", secondary: "#6096FD", team: "Red Bull Racing", isTeammate2: true },
  // Mercedes
  RUS: { primary: "#27F4D2", secondary: "#00B4D8", team: "Mercedes" },
  ANT: { primary: "#27F4D2", secondary: "#00B4D8", team: "Mercedes", isTeammate2: true },
  // Aston Martin
  ALO: { primary: "#229971", secondary: "#2EC4B6", team: "Aston Martin" },
  STR: { primary: "#229971", secondary: "#2EC4B6", team: "Aston Martin", isTeammate2: true },
  // Williams
  ALB: { primary: "#64C4FF", secondary: "#38BDF8", team: "Williams" },
  SAI: { primary: "#64C4FF", secondary: "#38BDF8", team: "Williams", isTeammate2: true },
  // Alpine
  GAS: { primary: "#FF87BC", secondary: "#0093CC", team: "Alpine" },
  COL: { primary: "#FF87BC", secondary: "#0093CC", team: "Alpine", isTeammate2: true },
  // Racing Bulls
  LAW: { primary: "#6692FF", secondary: "#A3BFFA", team: "Racing Bulls" },
  LIN: { primary: "#6692FF", secondary: "#A3BFFA", team: "Racing Bulls", isTeammate2: true },
  // Audi
  HUL: { primary: "#00E701", secondary: "#69FF69", team: "Audi" },
  BOR: { primary: "#00E701", secondary: "#69FF69", team: "Audi", isTeammate2: true },
  // Haas F1 Team
  OCO: { primary: "#B6BABD", secondary: "#E5E7EB", team: "Haas F1 Team" },
  BEA: { primary: "#B6BABD", secondary: "#E5E7EB", team: "Haas F1 Team", isTeammate2: true },
  // Cadillac
  PER: { primary: "#D4AF37", secondary: "#FACC15", team: "Cadillac" },
  BOT: { primary: "#D4AF37", secondary: "#FACC15", team: "Cadillac", isTeammate2: true },
  // Other / reserves / potential entries
  TSU: { primary: "#6692FF", secondary: "#A3BFFA", team: "Racing Bulls" },
  SAR: { primary: "#64C4FF", secondary: "#38BDF8", team: "Williams" },
  ZHO: { primary: "#00E701", secondary: "#69FF69", team: "Audi" },
};

const baseTeamColorsRecord: Record<string, string> = {
  "Red Bull Racing": "#3671C6",
  "Red Bull": "#3671C6",
  "Mercedes": "#27F4D2",
  "Ferrari": "#E8002D",
  "Scuderia Ferrari": "#E8002D",
  "McLaren": "#FF8000",
  "Aston Martin": "#229971",
  "Alpine": "#FF87BC",
  "Alpine F1 Team": "#FF87BC",
  "Williams": "#64C4FF",
  "RB": "#6692FF",
  "RB F1 Team": "#6692FF",
  "Racing Bulls": "#6692FF",
  "VCARB": "#6692FF",
  "Sauber": "#00E701",
  "Kick Sauber": "#00E701",
  "Audi": "#00E701",
  "Audi F1 Team": "#00E701",
  "Haas F1 Team": "#B6BABD",
  "Haas": "#B6BABD",
  "Cadillac": "#D4AF37",
  "Cadillac F1 Team": "#D4AF37",
  "Andretti Cadillac": "#D4AF37",
};

export function getTeamColor(teamName?: string | null): string {
  if (!teamName || typeof teamName !== 'string') return '#888888';
  const clean = teamName.trim().toLowerCase();
  if (!clean) return '#888888';
  if (clean in TEAM_COLORS_2026) return TEAM_COLORS_2026[clean];

  if (clean.includes('ferrari')) return TEAM_COLORS_2026['ferrari'];
  if (clean.includes('mclaren')) return TEAM_COLORS_2026['mclaren'];
  if (clean.includes('red bull') || clean.includes('redbull')) return TEAM_COLORS_2026['red bull racing'];
  if (clean.includes('mercedes')) return TEAM_COLORS_2026['mercedes'];
  if (clean.includes('aston')) return TEAM_COLORS_2026['aston martin'];
  if (clean.includes('alpine')) return TEAM_COLORS_2026['alpine'];
  if (clean.includes('williams')) return TEAM_COLORS_2026['williams'];
  if (clean.includes('racing bulls') || clean.includes('rb') || clean.includes('vcarb')) return TEAM_COLORS_2026['racing bulls'];
  if (clean.includes('audi') || clean.includes('sauber')) return TEAM_COLORS_2026['audi'];
  if (clean.includes('haas')) return TEAM_COLORS_2026['haas'];
  if (clean.includes('cadillac') || clean.includes('andretti')) return TEAM_COLORS_2026['cadillac'];

  return '#888888';
}

export function getDriverColor(
  driverCode?: string | null,
  teamName?: string | null,
  useSecondary = false
): string {
  if (driverCode && typeof driverCode === 'string') {
    const code = driverCode.trim().toUpperCase();
    const config = DRIVER_TEAM_COLORS_2026[code];
    if (config) {
      return useSecondary ? config.secondary : config.primary;
    }
  }
  return getTeamColor(teamName);
}

export const teamColors: Record<string, string> = new Proxy(baseTeamColorsRecord, {
  get(target, prop: string | symbol) {
    if (typeof prop !== 'string') return undefined;
    if (prop in target) return target[prop];
    const clean = prop.trim().toLowerCase();
    if (!clean) return '#888888';
    if (clean in TEAM_COLORS_2026) return TEAM_COLORS_2026[clean];
    const driverUpper = prop.trim().toUpperCase();
    if (driverUpper in DRIVER_TEAM_COLORS_2026) {
      return DRIVER_TEAM_COLORS_2026[driverUpper].primary;
    }
    const derived = getTeamColor(clean);
    if (derived !== '#888888') return derived;
    return target[prop] || '#888888';
  }
});
