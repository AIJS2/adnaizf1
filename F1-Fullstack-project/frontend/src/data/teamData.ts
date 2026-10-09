// src/data/teamData.js
// ─────────────────────────────────────────────────────────────
// SINGLE SOURCE OF TRUTH untuk logo & warna semua tim F1.
// Import dari sini di semua halaman — jangan copy-paste lagi!
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
  "Aston Martin":       astonMartinLogo,
  "Audi":               audiLogo,
  "Audi F1 Team":       audiLogo,
  "Cadillac":           cadillacLogo,
  "Andretti Cadillac":  cadillacLogo,
  "Ferrari":            ferrariLogo,
  "Haas F1 Team":       haasLogo,
  "McLaren":            mclarenLogo,
  "Mercedes":           mercedesLogo,
  "RB":                 rbLogo,
  "Racing Bulls":       rbLogo,
  "Red Bull Racing":    redBullLogo,
  "Sauber":             sauberLogo,
  "Kick Sauber":        sauberLogo,
  "Williams":           williamsLogo,
};

export const teamColors: Record<string, string> = {
  "Red Bull Racing":  "#3671C6",
  "Mercedes":         "#27F4D2",
  "Ferrari":          "#E8002D",
  "McLaren":          "#FF8000",
  "Aston Martin":     "#229971",
  "Alpine":           "#0090FF",
  "Williams":         "#00A3E0",
  "RB":               "#6692FF",
  "Racing Bulls":     "#6692FF",
  "Sauber":           "#52E252",
  "Kick Sauber":      "#52E252",
  "Haas F1 Team":     "#B6BABD",
  "Audi":             "#F51917",
  "Audi F1 Team":     "#F51917",
  "Cadillac":         "#FFD700",
  "Andretti Cadillac":"#FFD700",
};
