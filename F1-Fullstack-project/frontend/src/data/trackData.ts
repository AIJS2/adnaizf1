import abuDhabi from '../assets/tracks/Abu-Dhabi.png';
import australia from '../assets/tracks/Australia.png';
import austria from '../assets/tracks/Austria.png';
import azerbaijan from '../assets/tracks/Azerbaijan.png';
import bahrain from '../assets/tracks/Bahrain.png';
import belgium from '../assets/tracks/Belgium.png';
import brazil from '../assets/tracks/Brazil.png';
import canada from '../assets/tracks/Canada.png';
import china from '../assets/tracks/China.png';
import greatBritain from '../assets/tracks/Great-Britain.png';
import hungary from '../assets/tracks/Hungary.png';
import imola from '../assets/tracks/Imola.png';
import italy from '../assets/tracks/Italy.png';
import japan from '../assets/tracks/Japan.png';
import lasVegas from '../assets/tracks/LasVegas.png';
import mexico from '../assets/tracks/Mexico.png';
import miami from '../assets/tracks/Miami.png';
import monaco from '../assets/tracks/Monaco.png';
import netherlands from '../assets/tracks/Netherlands.png';
import qatar from '../assets/tracks/Qatar.png';
import saudiArabia from '../assets/tracks/Saudi-Arabia.png';
import singapore from '../assets/tracks/Singapore.png';
import spain from '../assets/tracks/Spain.png';
import usa from '../assets/tracks/Usa.png';

/**
 * Circuit-name → track-map asset. Keys are matched against a race's
 * `location`, `country` and `name` by `getTrackMap`, so aliases (city,
 * official GP name, country) are all present alongside the canonical name.
 */
export const trackMaps: Record<string, string> = {
  // Abu Dhabi
  "Abu Dhabi": abuDhabi, "Yas Island": abuDhabi, "Yas Marina": abuDhabi, "Abu Dhabi Grand Prix": abuDhabi, "United Arab Emirates": abuDhabi, "UAE": abuDhabi,
  // Australia
  "Australia": australia, "Melbourne": australia, "Australian Grand Prix": australia,
  // Austria
  "Austria": austria, "Spielberg": austria, "Austrian Grand Prix": austria, "Red Bull Ring": austria,
  // Azerbaijan
  "Azerbaijan": azerbaijan, "Baku": azerbaijan, "Azerbaijan Grand Prix": azerbaijan,
  // Bahrain
  "Bahrain": bahrain, "Sakhir": bahrain, "Bahrain Grand Prix": bahrain,
  // Belgium
  "Belgium": belgium, "Spa-Francorchamps": belgium, "Spa": belgium, "Belgian Grand Prix": belgium,
  // Brazil
  "Brazil": brazil, "São Paulo": brazil, "Sao Paulo": brazil, "Interlagos": brazil, "São Paulo Grand Prix": brazil, "Brazilian Grand Prix": brazil,
  // Canada
  "Canada": canada, "Montréal": canada, "Montreal": canada, "Canadian Grand Prix": canada,
  // China
  "China": china, "Shanghai": china, "Chinese Grand Prix": china,
  // Great Britain
  "Great Britain": greatBritain, "Silverstone": greatBritain, "UK": greatBritain, "United Kingdom": greatBritain, "British Grand Prix": greatBritain,
  // Hungary
  "Hungary": hungary, "Budapest": hungary, "Hungaroring": hungary, "Hungarian Grand Prix": hungary,
  // Imola
  "Imola": imola, "Emilia Romagna": imola, "Emilia Romagna Grand Prix": imola,
  // Italy
  "Italy": italy, "Monza": italy, "Italian Grand Prix": italy,
  // Japan
  "Japan": japan, "Suzuka": japan, "Japanese Grand Prix": japan,
  // Las Vegas
  "Las Vegas": lasVegas, "Las Vegas Grand Prix": lasVegas,
  // Mexico
  "Mexico": mexico, "Mexico City": mexico, "Mexico City Grand Prix": mexico, "Mexican Grand Prix": mexico,
  // Miami
  "Miami": miami, "Miami Gardens": miami, "Miami Grand Prix": miami,
  // Monaco
  "Monaco": monaco, "Monte Carlo": monaco, "Monaco Grand Prix": monaco,
  // Netherlands
  "Netherlands": netherlands, "Zandvoort": netherlands, "Dutch Grand Prix": netherlands,
  // Qatar
  "Qatar": qatar, "Lusail": qatar, "Qatar Grand Prix": qatar,
  // Saudi Arabia
  "Saudi Arabia": saudiArabia, "Jeddah": saudiArabia, "Saudi Arabian Grand Prix": saudiArabia,
  // Singapore
  "Singapore": singapore, "Marina Bay": singapore, "Singapore Grand Prix": singapore,
  // Spain
  "Spain": spain, "Barcelona": spain, "Madrid": spain, "Catalunya": spain, "Spanish Grand Prix": spain, "Barcelona Grand Prix": spain,
  // United States
  "United States": usa, "USA": usa, "Austin": usa, "COTA": usa, "United States Grand Prix": usa,
};

/**
 * Circuit-name → ISO 3166-1 alpha-2 country code. Keys mirror `trackMaps`
 * (city, official GP name, country) so `getCountryCode` resolves a flag for
 * the same aliases `getTrackMap` uses; the two utilities always agree.
 */
export const countryCodes: Record<string, string> = {
  // Abu Dhabi
  "Abu Dhabi": "AE", "Yas Island": "AE", "Yas Marina": "AE", "Abu Dhabi Grand Prix": "AE", "United Arab Emirates": "AE", "UAE": "AE",
  // Australia
  "Australia": "AU", "Melbourne": "AU", "Australian Grand Prix": "AU",
  // Austria
  "Austria": "AT", "Spielberg": "AT", "Austrian Grand Prix": "AT", "Red Bull Ring": "AT",
  // Azerbaijan
  "Azerbaijan": "AZ", "Baku": "AZ", "Azerbaijan Grand Prix": "AZ",
  // Bahrain
  "Bahrain": "BH", "Sakhir": "BH", "Bahrain Grand Prix": "BH",
  // Belgium
  "Belgium": "BE", "Spa-Francorchamps": "BE", "Spa": "BE", "Belgian Grand Prix": "BE",
  // Brazil
  "Brazil": "BR", "São Paulo": "BR", "Sao Paulo": "BR", "Interlagos": "BR", "São Paulo Grand Prix": "BR", "Brazilian Grand Prix": "BR",
  // Canada
  "Canada": "CA", "Montréal": "CA", "Montreal": "CA", "Canadian Grand Prix": "CA",
  // China
  "China": "CN", "Shanghai": "CN", "Chinese Grand Prix": "CN",
  // Great Britain
  "Great Britain": "GB", "Silverstone": "GB", "UK": "GB", "United Kingdom": "GB", "British Grand Prix": "GB",
  // Hungary
  "Hungary": "HU", "Budapest": "HU", "Hungaroring": "HU", "Hungarian Grand Prix": "HU",
  // Imola (Emilia Romagna)
  "Imola": "IT", "Emilia Romagna": "IT", "Emilia Romagna Grand Prix": "IT",
  // Italy
  "Italy": "IT", "Monza": "IT", "Italian Grand Prix": "IT",
  // Japan
  "Japan": "JP", "Suzuka": "JP", "Japanese Grand Prix": "JP",
  // Las Vegas
  "Las Vegas": "US", "Las Vegas Grand Prix": "US",
  // Mexico
  "Mexico": "MX", "Mexico City": "MX", "Mexico City Grand Prix": "MX", "Mexican Grand Prix": "MX",
  // Miami
  "Miami": "US", "Miami Gardens": "US", "Miami Grand Prix": "US",
  // Monaco
  "Monaco": "MC", "Monte Carlo": "MC", "Monaco Grand Prix": "MC",
  // Netherlands
  "Netherlands": "NL", "Zandvoort": "NL", "Dutch Grand Prix": "NL",
  // Qatar
  "Qatar": "QA", "Lusail": "QA", "Qatar Grand Prix": "QA",
  // Saudi Arabia
  "Saudi Arabia": "SA", "Jeddah": "SA", "Saudi Arabian Grand Prix": "SA",
  // Singapore
  "Singapore": "SG", "Marina Bay": "SG", "Singapore Grand Prix": "SG",
  // Spain
  "Spain": "ES", "Barcelona": "ES", "Madrid": "ES", "Catalunya": "ES", "Spanish Grand Prix": "ES", "Barcelona Grand Prix": "ES",
  // United States
  "United States": "US", "USA": "US", "Austin": "US", "COTA": "US", "United States Grand Prix": "US",
};

/** The race fields `getTrackMap` matches against; all optional and stringy. */
export interface TrackMapLookup {
  location?: string;
  country?: string;
  name?: string;
}

export const getTrackMap = (raceInfo?: TrackMapLookup | null): string | null => {
  if (!raceInfo) return null;
  const location = (raceInfo.location || '').trim();
  const country = (raceInfo.country || '').trim();
  const name = (raceInfo.name || '').trim();

  if (trackMaps[location]) return trackMaps[location];
  if (trackMaps[country]) return trackMaps[country];
  if (trackMaps[name]) return trackMaps[name];

  // Fuzzy check
  const locLower = location.toLowerCase();
  const nameLower = name.toLowerCase();
  for (const [key, mapImg] of Object.entries(trackMaps)) {
    const kLower = key.toLowerCase();
    if (kLower.length > 3 && (locLower.includes(kLower) || nameLower.includes(kLower))) {
      return mapImg;
    }
  }
  return null;
};

/**
 * Country flag code (ISO 3166-1 alpha-2) for a race. Tries `country`, then
 * `location`, then `name` — same matching strategy as `getTrackMap` (exact
 * alias lookup, then a fuzzy "contains" pass over location/name) so the flag
 * shown always matches the track map picked. Returns null when nothing matches.
 */
export const getCountryCode = (raceInfo?: TrackMapLookup | null): string | null => {
  if (!raceInfo) return null;
  const location = (raceInfo.location || '').trim();
  const country = (raceInfo.country || '').trim();
  const name = (raceInfo.name || '').trim();

  if (countryCodes[country]) return countryCodes[country];
  if (countryCodes[location]) return countryCodes[location];
  if (countryCodes[name]) return countryCodes[name];

  // Fuzzy check (mirrors getTrackMap: location and name only, keys > 3 chars)
  const locLower = location.toLowerCase();
  const nameLower = name.toLowerCase();
  for (const [key, code] of Object.entries(countryCodes)) {
    const kLower = key.toLowerCase();
    if (kLower.length > 3 && (locLower.includes(kLower) || nameLower.includes(kLower))) {
      return code;
    }
  }
  return null;
};
