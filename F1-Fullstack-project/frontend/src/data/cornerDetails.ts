import type { CircuitLookup } from './circuitPaths';

export interface CornerDetail {
  number: number;
  letter?: string;
  name: string;
  isIconic?: boolean;
  type: string;
  speedCategory: 'Slow' | 'Medium' | 'High Speed' | 'Flat Out';
  gear?: string;
  speedKmh?: number | string;
  description: string;
  funFact?: string;
}

/**
 * Curated iconic corners and technical lore for the Formula 1 World Championship circuits.
 */
export const ICONIC_CORNERS_DATABASE: Record<string, Record<string, Partial<CornerDetail>>> = {
  // Australia - Albert Park
  melbourne: {
    '1': {
      name: 'Jones Chicane',
      isIconic: true,
      type: 'Heavy Braking / Overtake Zone',
      speedCategory: 'Medium',
      gear: '3rd',
      speedKmh: '150 km/h',
      description: 'Named after 1980 World Champion Alan Jones. The premier overtaking battleground off the main straight with notorious opening-lap drama.',
      funFact: 'Cars brake from ~325 km/h down to 150 km/h in just 1.8 seconds.',
    },
    '2': {
      name: 'Brabham Chicane',
      type: 'Switchback Exit',
      speedCategory: 'Medium',
      gear: '4th',
      speedKmh: '180 km/h',
      description: 'Named after Sir Jack Brabham. Demands aggressive kerb usage while accelerating toward the lake.',
    },
    '3': {
      name: 'Sports Center',
      isIconic: true,
      type: 'Heavy Braking',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '105 km/h',
      description: 'Sharp 90° right-hander following DRS Zone 2. Prime late-braking divebomb hotspot.',
    },
    '9': {
      name: 'Waite Chicane (Turn 9)',
      isIconic: true,
      type: 'High-Speed Flick',
      speedCategory: 'High Speed',
      gear: '6th',
      speedKmh: '255 km/h',
      description: 'Part of Melbourne\'s circuit redesign. Cars fly past Albert Park Lake at breathtaking lateral load.',
      funFact: 'Drivers pull up to 4.8G of lateral acceleration here.',
    },
    '10': {
      name: 'Waite Exit (Turn 10)',
      type: 'High-Speed Exit',
      speedCategory: 'High Speed',
      gear: '7th',
      speedKmh: '270 km/h',
      description: 'Flat-out commitment over the exit kerb feeding into the back straight DRS zone.',
    },
    '11': {
      name: 'Clark Chicane (Turn 11)',
      isIconic: true,
      type: 'Technical Chicane',
      speedCategory: 'Medium',
      gear: '3rd',
      speedKmh: '135 km/h',
      description: 'Honoring Jim Clark. High kerbs punish any driver carrying too much entry momentum.',
    },
    '13': {
      name: 'Ascari',
      type: 'Braking Zone',
      speedCategory: 'Medium',
      gear: '3rd',
      speedKmh: '125 km/h',
      description: 'Tight right-hander with deceptive camber that frequently provokes front-left lockups.',
    },
    '14': {
      name: 'Prost Corner',
      isIconic: true,
      type: 'Final Corner',
      speedCategory: 'Medium',
      gear: '3rd',
      speedKmh: '155 km/h',
      description: 'Named after 4-time World Champion Alain Prost. Vital exit traction onto the main straight.',
    },
  },

  // Monaco - Circuit de Monaco
  monaco: {
    '1': {
      name: 'Sainte Dévote',
      isIconic: true,
      type: 'Heavy Braking',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '110 km/h',
      description: 'Named after Monaco\'s patron saint whose chapel stands on the runoff. Infamous first-lap pinch point.',
      funFact: 'A famous proverb in Monaco says: "Win or lose, you must survive Sainte Dévote first."',
    },
    '3': {
      name: 'Massenet',
      isIconic: true,
      type: 'High-Speed Sweep',
      speedCategory: 'Medium',
      gear: '4th',
      speedKmh: '160 km/h',
      description: 'Blind uphill left sweeper grazing the steel armco barriers past the iconic Casino Opera House.',
    },
    '4': {
      name: 'Casino Square',
      isIconic: true,
      type: 'Blind Crest',
      speedCategory: 'Medium',
      gear: '3rd',
      speedKmh: '125 km/h',
      description: 'Cars crest over a bumpy road crown directly in front of the legendary Hotel de Paris and Monte-Carlo Casino.',
    },
    '5': {
      name: 'Mirabeau Haute',
      isIconic: true,
      type: 'Downhill Braking',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '80 km/h',
      description: 'Steep downhill right with negative camber where drivers feather the brake pedal to avoid the barrier.',
    },
    '6': {
      name: 'Grand Hotel Hairpin (Fairmont)',
      isIconic: true,
      type: 'Slowest Corner in F1',
      speedCategory: 'Slow',
      gear: '1st',
      speedKmh: '48 km/h',
      description: 'The slowest and tightest corner in all of Formula 1. Teams install custom steering racks to achieve full lock.',
      funFact: 'Formerly known as Loews Hairpin. At 48 km/h, photographers can literally snap clear portraits of drivers through their visors.',
    },
    '8': {
      name: 'Portier',
      isIconic: true,
      type: 'Tunnel Launchpad',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '75 km/h',
      description: 'Famous corner where Ayrton Senna crashed out of a massive lead in 1988. Vital launch into the Tunnel.',
    },
    '9': {
      name: 'The Tunnel',
      isIconic: true,
      type: 'Flat-Out Blind Bend',
      speedCategory: 'High Speed',
      gear: '7th',
      speedKmh: '285 km/h',
      description: 'The only covered flat-out bend in F1. Deafening engine roar and dramatic daylight transition onto the harbour.',
    },
    '10': {
      name: 'Nouvelle Chicane (Turn 10)',
      isIconic: true,
      type: 'Maximum Deceleration',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '70 km/h',
      description: 'Brutal deceleration dropping from 290 km/h to 70 km/h immediately exiting the Tunnel.',
    },
    '12': {
      name: 'Tabac',
      isIconic: true,
      type: 'Blind High-Speed Left',
      speedCategory: 'Medium',
      gear: '4th',
      speedKmh: '165 km/h',
      description: 'Named after the historic tobacco shop on the harbour quayside. Ultra close to the steel barriers.',
    },
    '13': {
      name: 'Louis Chiron (Swimming Pool 1)',
      isIconic: true,
      type: 'High-Speed Chicane Entry',
      speedCategory: 'High Speed',
      gear: '5th',
      speedKmh: '215 km/h',
      description: 'Blindingly fast chicane entry skimming the mega-yachts and the Monte-Carlo swimming pool.',
    },
    '15': {
      name: 'Swimming Pool Chicane',
      isIconic: true,
      type: 'Kerb-Hopping Chicane',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '105 km/h',
      description: 'Aggressive suspension test where cars violently bounce off the raised kerbs right next to the water.',
    },
    '18': {
      name: 'La Rascasse',
      isIconic: true,
      type: 'Slow Hairpin',
      speedCategory: 'Slow',
      gear: '1st',
      speedKmh: '55 km/h',
      description: 'Famous corner wrapping around the Rascasse restaurant. Scene of Michael Schumacher\'s famous 2006 qualifying pole controversy.',
    },
    '19': {
      name: 'Antony Noghès',
      isIconic: true,
      type: 'Final Turn',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '90 km/h',
      description: 'Named after the founder of the Monaco Grand Prix. Tight right-hander setting up the blast to the start-finish line.',
    },
  },

  // Belgium - Spa-Francorchamps
  spa: {
    '1': {
      name: 'La Source',
      isIconic: true,
      type: 'Hairpin Braking',
      speedCategory: 'Slow',
      gear: '1st',
      speedKmh: '70 km/h',
      description: 'Tight downhill hairpin right after the start line. Opening lap chaos hotspot with huge run-off on exit.',
    },
    '2': {
      name: 'Eau Rouge',
      isIconic: true,
      type: 'Legendary Compression',
      speedCategory: 'Flat Out',
      gear: '7th',
      speedKmh: '310 km/h',
      description: 'The stream compression at the valley floor where drivers plunge down before the steep Raidillon climb.',
      funFact: 'Named "Red Water" after the iron-rich stream flowing under the track.',
    },
    '3': {
      name: 'Raidillon (Turn 3 & 4)',
      isIconic: true,
      type: 'Blind Uphill Crest',
      speedCategory: 'Flat Out',
      gear: '8th',
      speedKmh: '305 km/h',
      description: 'Steep 17% blind gradient launched flat-out into Kemmel Straight. Revered as the pinnacle of racing bravery.',
      funFact: 'Drivers pull 4G+ vertical compression at the bottom, then experience weightlessness over the crest.',
    },
    '5': {
      name: 'Les Combes',
      isIconic: true,
      type: 'Overtaking Chicane',
      speedCategory: 'Medium',
      gear: '3rd',
      speedKmh: '140 km/h',
      description: 'Highest point of the circuit. The prime slipstream overtaking battleground at the end of Kemmel Straight.',
    },
    '8': {
      name: 'Bruxelles (Rivage)',
      isIconic: true,
      type: 'Off-Camber Downhill',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '115 km/h',
      description: 'Long downhill sweeping hairpin with negative camber that constantly drags front tyres wide.',
    },
    '10': {
      name: 'Pouhon (Double Gauche)',
      isIconic: true,
      type: 'Ultra High-Speed Left',
      speedCategory: 'High Speed',
      gear: '6th',
      speedKmh: '290 km/h',
      description: 'Mind-bending double-apex downhill left-hander. The ultimate showcase of modern aerodynamic downforce.',
      funFact: 'Drivers pull over 5.1G of lateral load for nearly 4 continuous seconds.',
    },
    '14': {
      name: 'Campus / Stavelot',
      type: 'Accelerating Sweeper',
      speedCategory: 'Medium',
      gear: '4th',
      speedKmh: '180 km/h',
      description: 'Right-hander launching cars into the ultra-fast downhill blast towards Blanchimont.',
    },
    '16': {
      name: 'Blanchimont',
      isIconic: true,
      type: 'Flat-Out Sweeper',
      speedCategory: 'Flat Out',
      gear: '8th',
      speedKmh: '315 km/h',
      description: 'Terrifying 315 km/h flat-out blind left bend taken without lifting in modern high-downforce cars.',
    },
    '18': {
      name: 'Bus Stop Chicane',
      isIconic: true,
      type: 'Final Chicane',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '80 km/h',
      description: 'Violent deceleration from 320 km/h to 80 km/h before the start-finish line. Last-lap overtake drama guaranteed.',
    },
  },

  // Italy - Monza
  monza: {
    '1': {
      name: 'Variante del Rettifilo (Turn 1 & 2)',
      isIconic: true,
      type: 'Maximum Deceleration',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '75 km/h',
      description: 'Braking from 355+ km/h down to 75 km/h. Hardest braking zone on the entire F1 calendar.',
      funFact: 'Drivers exert over 140 kg of force on the brake pedal, pulling 5.5G of deceleration.',
    },
    '3': {
      name: 'Curva Grande (Curva Biassono)',
      isIconic: true,
      type: 'Flat-Out Right',
      speedCategory: 'Flat Out',
      gear: '7th',
      speedKmh: '300 km/h',
      description: 'Endless sweeping right-hander tearing through the centuries-old royal park of Monza.',
    },
    '4': {
      name: 'Variante della Roggia',
      isIconic: true,
      type: 'Tight Chicane',
      speedCategory: 'Medium',
      gear: '3rd',
      speedKmh: '115 km/h',
      description: 'Left-right chicane between the tall trees where slipstreaming battles continue.',
    },
    '6': {
      name: 'Curva di Lesmo 1',
      isIconic: true,
      type: 'Fast Right',
      speedCategory: 'High Speed',
      gear: '4th',
      speedKmh: '185 km/h',
      description: 'Historic mid-speed right-hander requiring surgical throttle balance on Monza\'s ultra-skinny downforce wing.',
    },
    '7': {
      name: 'Curva di Lesmo 2',
      isIconic: true,
      type: 'Technical Right',
      speedCategory: 'Medium',
      gear: '4th',
      speedKmh: '165 km/h',
      description: 'Tighter sister corner to Lesmo 1. Critical exit speed leading underneath the old banked oval bridge.',
    },
    '8': {
      name: 'Variante Ascari (Turn 8-10)',
      isIconic: true,
      type: 'High-Speed S-Complex',
      speedCategory: 'High Speed',
      gear: '5th',
      speedKmh: '200 km/h',
      description: 'Named after Alberto Ascari. High-speed left-right-left chicane demanding aggressive kerb riding.',
    },
    '11': {
      name: 'Curva Parabolica (Curva Alboreto)',
      isIconic: true,
      type: 'Parabolic Sweeper',
      speedCategory: 'High Speed',
      gear: '5th',
      speedKmh: '215 km/h',
      description: 'Legendary 180° opening-radius corner named in honor of Michele Alboreto. Launchpad onto the Monza straight.',
    },
  },

  // Great Britain - Silverstone
  silverstone: {
    '1': {
      name: 'Abbey',
      isIconic: true,
      type: 'Flat-Out Right',
      speedCategory: 'Flat Out',
      gear: '7th',
      speedKmh: '290 km/h',
      description: 'Flat-out entry from the modern pit straight into the Arena section, pulling 4.8G.',
    },
    '3': {
      name: 'Village & The Loop',
      type: 'Slow Chicane',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '90 km/h',
      description: 'Tight technical switchback in the infield designed for close overtaking.',
    },
    '6': {
      name: 'Brooklands',
      type: 'Heavy Braking Left',
      speedCategory: 'Medium',
      gear: '3rd',
      speedKmh: '145 km/h',
      description: 'Braking zone after the Wellington Straight with alternative racing lines.',
    },
    '7': {
      name: 'Luffield',
      isIconic: true,
      type: 'Long Carousel',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '105 km/h',
      description: 'Endless right-hand carousel where drivers must patiently wait for traction.',
    },
    '9': {
      name: 'Copse',
      isIconic: true,
      type: 'Legendary Fast Right',
      speedCategory: 'High Speed',
      gear: '7th',
      speedKmh: '290 km/h',
      description: 'Famous 290 km/h blind right turn. Scene of the intense Hamilton-Verstappen 2021 collision.',
      funFact: 'Drivers brake for a fraction of a second before committing at 5.2G lateral.',
    },
    '10': {
      name: 'Maggotts & Becketts (Turn 10-14)',
      isIconic: true,
      type: 'Pinnacle Flow Complex',
      speedCategory: 'High Speed',
      gear: '7th',
      speedKmh: '300 km/h',
      description: 'The greatest high-speed direction-change sequence in motorsport. Test of sheer aerodynamic downforce.',
      funFact: 'Direction changes from left to right at 300 km/h produce over 5.5G on the driver\'s neck.',
    },
    '15': {
      name: 'Stowe',
      isIconic: true,
      type: 'Fast 6th-Gear Right',
      speedCategory: 'High Speed',
      gear: '5th',
      speedKmh: '200 km/h',
      description: 'High-speed corner at the end of the 320 km/h Hangar Straight with prominent tailwinds.',
    },
    '16': {
      name: 'Vale & Club',
      isIconic: true,
      type: 'Final Chicane',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '95 km/h',
      description: 'Downhill braking chicane into the accelerating sweep across the Hamilton Straight.',
    },
  },

  // Japan - Suzuka
  suzuka: {
    '1': {
      name: 'First Curve (Turn 1 & 2)',
      isIconic: true,
      type: 'Double Apex Right',
      speedCategory: 'High Speed',
      gear: '5th',
      speedKmh: '230 km/h',
      description: 'High-speed downhill turn that tightens rapidly on entry.',
    },
    '3': {
      name: 'The S-Curves (Turn 3-6)',
      isIconic: true,
      type: 'Rhythmic Flow Section',
      speedCategory: 'High Speed',
      gear: '5th',
      speedKmh: '210 km/h',
      description: 'Suzuka\'s signature rhythmic S-bends. One mistake in Turn 3 destroys the entire sector flow.',
      funFact: 'Designed by John Hugenholtz. Drivers describe it as a rollercoaster on asphalt.',
    },
    '7': {
      name: 'Dunlop Curve',
      isIconic: true,
      type: 'Uphill Sweeper',
      speedCategory: 'High Speed',
      gear: '5th',
      speedKmh: '220 km/h',
      description: 'Blind uphill sweeping left with zero runoff margin for error.',
    },
    '8': {
      name: 'Degner 1 & 2 (Turn 8 & 9)',
      isIconic: true,
      type: 'Fast Right into 90°',
      speedCategory: 'High Speed',
      gear: '4th',
      speedKmh: '195 km/h',
      description: 'Named after Ernst Degner. Extreme commitment over kerbs followed by treacherous underpass braking.',
    },
    '11': {
      name: 'Hairpin',
      isIconic: true,
      type: 'Slowest Hairpin',
      speedCategory: 'Slow',
      gear: '1st',
      speedKmh: '70 km/h',
      description: 'Classic Suzuka overtaking spot with rich historical drama (Senna vs Prost).',
    },
    '13': {
      name: 'Spoon Curve (Turn 13 & 14)',
      isIconic: true,
      type: 'Double Apex Left',
      speedCategory: 'High Speed',
      gear: '4th',
      speedKmh: '190 km/h',
      description: 'Shaped like a spoon bowl. Demands high mid-corner stability before unleashing towards 130R.',
    },
    '15': {
      name: '130R',
      isIconic: true,
      type: 'Legendary 300+ km/h Bend',
      speedCategory: 'Flat Out',
      gear: '8th',
      speedKmh: '305 km/h',
      description: 'Named after its original 130-meter radius. A ferocious flat-out left-hand blast taken with nerves of steel.',
      funFact: 'Fernando Alonso pulled off one of the greatest overtakes in F1 history here on Michael Schumacher in 2005.',
    },
    '16': {
      name: 'Casio Triangle (Turn 16-18)',
      isIconic: true,
      type: 'Final Chicane',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '75 km/h',
      description: 'Tight chicane before start-finish. Epic site of the 1989 Senna-Prost championship collision.',
    },
  },

  // Netherlands - Zandvoort
  zandvoort: {
    '1': {
      name: 'Tarzanbocht',
      isIconic: true,
      type: 'Historic Hairpin',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '105 km/h',
      description: 'Cambered 180° hairpin at the end of the pit straight where brave late-brakers thrive on the outside.',
    },
    '3': {
      name: 'Hugenholtzbocht',
      isIconic: true,
      type: '19° Banked Bowl',
      speedCategory: 'Medium',
      gear: '3rd',
      speedKmh: '115 km/h',
      description: 'Spectacular 19-degree parabolic banking. Allows two cars to race side-by-side using progressive incline.',
      funFact: 'Steeper than the banking at Indianapolis Motor Speedway!',
    },
    '7': {
      name: 'Scheivlak',
      isIconic: true,
      type: 'Blind Dune Crest',
      speedCategory: 'High Speed',
      gear: '6th',
      speedKmh: '245 km/h',
      description: 'Fast blind right plunging down through coastal sand dunes. Unforgiving gravel traps.',
    },
    '14': {
      name: 'Arie Luyendykbocht',
      isIconic: true,
      type: '18° High-Speed Banking',
      speedCategory: 'Flat Out',
      gear: '7th',
      speedKmh: '265 km/h',
      description: 'Steep 18° banked final corner launched flat-out with DRS wide open onto the pit straight.',
    },
  },

  // Brazil - Interlagos
  interlagos: {
    '1': {
      name: 'Senna S (Turn 1 & 2)',
      isIconic: true,
      type: 'Downhill S-Curve',
      speedCategory: 'Medium',
      gear: '2nd',
      speedKmh: '120 km/h',
      description: 'Named after the immortal Ayrton Senna. Plunging left-right switchback with iconic overtaking battles.',
      funFact: 'One of the most famous opening-lap corners in Formula 1 history.',
    },
    '3': {
      name: 'Curva do Sol',
      isIconic: true,
      type: 'Uphill Sweeper',
      speedCategory: 'High Speed',
      gear: '5th',
      speedKmh: '215 km/h',
      description: 'Fast uphill left leading into Reta Oposta back straight.',
    },
    '8': {
      name: 'Ferradura',
      type: 'Double Apex Right',
      speedCategory: 'Medium',
      gear: '4th',
      speedKmh: '175 km/h',
      description: 'The "Horseshoe" right-hander with tricky bumps on turn-in.',
    },
    '10': {
      name: 'Bico de Pato',
      isIconic: true,
      type: 'Duck Bill Hairpin',
      speedCategory: 'Slow',
      gear: '1st',
      speedKmh: '75 km/h',
      description: 'Tight hairpin resembling a duck\'s beak. Slowest point of the Interlagos circuit.',
    },
    '12': {
      name: 'Mergulho',
      isIconic: true,
      type: 'Downhill Compression',
      speedCategory: 'High Speed',
      gear: '5th',
      speedKmh: '235 km/h',
      description: 'Meaning "The Dive". Fast downhill compression right before the final climb.',
    },
    '13': {
      name: 'Junção',
      isIconic: true,
      type: 'Launchpad Corner',
      speedCategory: 'Medium',
      gear: '3rd',
      speedKmh: '125 km/h',
      description: 'Critical left-hander deciding top speed on the long uphill drag to the finish line.',
    },
  },

  // Mexico - Autódromo Hermanos Rodríguez
  mexico: {
    '1': {
      name: 'Moisés Solana Chicane (Turn 1-3)',
      isIconic: true,
      type: 'Heavy Braking',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '115 km/h',
      description: 'Deceleration from 360+ km/h at the end of the 1.2km straight in thin high-altitude air.',
      funFact: 'Because of Mexico City\'s 2,200m altitude, top speeds rival Monza despite running maximum downforce wings.',
    },
    '7': {
      name: 'The Esses (Turn 7-11)',
      isIconic: true,
      type: 'High-Speed Rhythm',
      speedCategory: 'High Speed',
      gear: '5th',
      speedKmh: '210 km/h',
      description: 'Flowing left-right S-complex testing balance with reduced aerodynamic air density.',
    },
    '12': {
      name: 'Foro Sol Stadium Entry',
      isIconic: true,
      type: 'Stadium Section',
      speedCategory: 'Medium',
      gear: '3rd',
      speedKmh: '135 km/h',
      description: 'Cars dive through a narrow portal directly into the roaring 30,000-seat baseball stadium.',
    },
    '14': {
      name: 'Foro Sol Hairpin (Turn 13-15)',
      isIconic: true,
      type: 'Amphitheater Hairpin',
      speedCategory: 'Slow',
      gear: '1st',
      speedKmh: '70 km/h',
      description: 'Tight stadium hairpin surrounded by towering grandstands filled with passionate fans.',
    },
  },

  // Canada - Montreal
  montreal: {
    '1': {
      name: 'Virage Senna (Turn 1 & 2)',
      isIconic: true,
      type: 'Tight S-Complex',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '105 km/h',
      description: 'Downhill left-right flick named after Ayrton Senna at the start of the Île Notre-Dame lap.',
    },
    '10': {
      name: 'L\'Épingle (Hairpin)',
      isIconic: true,
      type: 'Key Hairpin',
      speedCategory: 'Slow',
      gear: '1st',
      speedKmh: '65 km/h',
      description: 'Heavy braking amphitheater hairpin surrounded by passionate Canadian grandstands.',
    },
    '13': {
      name: 'Wall of Champions (Turn 13 & 14)',
      isIconic: true,
      type: 'Notorious Chicane',
      speedCategory: 'Medium',
      gear: '3rd',
      speedKmh: '135 km/h',
      description: 'Final chicane where World Champions Damon Hill, Michael Schumacher, and Jacques Villeneuve all crashed in 1999.',
      funFact: 'Bearing the slogan "Bienvenue au Québec", this wall has claimed countless race leaders.',
    },
  },

  // Azerbaijan - Baku
  baku: {
    '8': {
      name: 'Old City / Castle Section (Turn 8-10)',
      isIconic: true,
      type: 'Narrowest Section in F1',
      speedCategory: 'Slow',
      gear: '2nd',
      speedKmh: '80 km/h',
      description: 'The narrowest section in modern Formula 1 (just 7.6m wide). Cars snake millimeters from 12th-century stone fortress walls.',
      funFact: 'Charles Leclerc famously radioed "I am stupid" after clipping the inside wall here in 2019.',
    },
    '16': {
      name: 'Caspian Turn',
      type: 'Final Hairpin',
      speedCategory: 'Medium',
      gear: '3rd',
      speedKmh: '125 km/h',
      description: 'Sharp left turn unleashing drivers onto the relentless 2.2-kilometer flat-out blast along the Caspian shoreline.',
    },
  },
};

function matchCircuitKey(circuit?: CircuitLookup | null): string | null {
  if (!circuit) return null;
  const raw = `${circuit.name || ''} ${circuit.location || ''} ${circuit.country || ''}`.toLowerCase();

  if (raw.includes('melbourne') || raw.includes('albert park')) return 'melbourne';
  if (raw.includes('monaco') || raw.includes('monte carlo')) return 'monaco';
  if (raw.includes('spa') || raw.includes('francorchamps')) return 'spa';
  if (raw.includes('monza')) return 'monza';
  if (raw.includes('silverstone')) return 'silverstone';
  if (raw.includes('suzuka')) return 'suzuka';
  if (raw.includes('zandvoort')) return 'zandvoort';
  if (raw.includes('interlagos') || raw.includes('pace') || raw.includes('brazil') || raw.includes('paulo')) return 'interlagos';
  if (raw.includes('mexico') || raw.includes('rodriguez')) return 'mexico';
  if (raw.includes('montreal') || raw.includes('villeneuve') || raw.includes('canada')) return 'montreal';
  if (raw.includes('baku') || raw.includes('azerbaijan')) return 'baku';

  return null;
}

/**
 * Returns rich corner lore or smart telemetry breakdown for any corner on any circuit.
 */
export function getCornerDetail(
  circuit?: CircuitLookup | null,
  turnNumber?: number,
  letter?: string,
): CornerDetail {
  const num = turnNumber ?? 1;
  const numStr = String(num);
  const circuitKey = matchCircuitKey(circuit);

  if (circuitKey && ICONIC_CORNERS_DATABASE[circuitKey]?.[numStr]) {
    const entry = ICONIC_CORNERS_DATABASE[circuitKey][numStr];
    return {
      number: num,
      letter,
      name: entry.name || `Turn ${num}${letter || ''}`,
      isIconic: entry.isIconic ?? false,
      type: entry.type || 'Apex Corner',
      speedCategory: entry.speedCategory || 'Medium',
      gear: entry.gear,
      speedKmh: entry.speedKmh,
      description: entry.description || `Apex turning point at Turn ${num}.`,
      funFact: entry.funFact,
    };
  }

  // Generic intelligent descriptor for non-iconic corners
  const isEarly = num <= 2;
  const isLate = num >= 14;

  let fallbackType = 'Technical Corner';
  let speedCat: 'Slow' | 'Medium' | 'High Speed' | 'Flat Out' = 'Medium';

  if (isEarly) {
    fallbackType = 'Opening Sequence / Braking Zone';
    speedCat = 'Medium';
  } else if (isLate) {
    fallbackType = 'Final Sector Launchpad';
    speedCat = 'Medium';
  }

  return {
    number: num,
    letter,
    name: `Turn ${num}${letter || ''}`,
    isIconic: false,
    type: fallbackType,
    speedCategory: speedCat,
    description: `Apex Turn ${num}${letter || ''} on the circuit. Drivers balance braking, turn-in geometry, and throttle traction.`,
  };
}
