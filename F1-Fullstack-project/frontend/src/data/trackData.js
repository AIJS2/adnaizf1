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

export const trackMaps = {
  // Abu Dhabi
  "Abu Dhabi": abuDhabi, "Yas Island": abuDhabi, "Yas Marina": abuDhabi, "Abu Dhabi Grand Prix": abuDhabi, "United Arab Emirates": abuDhabi, "UAE": abuDhabi,
  // Australia
  "Australia": australia, "Melbourne": australia, "Australian Grand Prix": australia,
  // Austria
  "Austria": austria, "Spielberg": austria, "Austrian Grand Prix": austria, "Red Bull Ring": austria,
  // Azerbaijan
  "Azerbaijan": azerbaijan, "Baku": azerbaijan, "Azerbaijan Grand Prix": azerbaijan,
  // Bahrain
  "Bahrain": bahrain, "Sakhir": bahrain, "Bahrain Grand Prix": bahrain, "Kuala Lumpur": bahrain,
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

export const getTrackMap = (raceInfo) => {
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
