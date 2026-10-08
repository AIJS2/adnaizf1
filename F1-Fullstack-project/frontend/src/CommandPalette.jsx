import React, { useState, useEffect, useRef, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { 
  Search, X, User, Users, Flag, Trophy, Activity, 
  LayoutDashboard, MapPin, ArrowRight, CornerDownLeft, Sparkles 
} from 'lucide-react';
import { teamColors, teamLogos } from './data/teamData';
import { API_URL } from './config';

const year = new Date().getFullYear();

// Static base items for instant zero-latency search
const defaultSearchItems = [
  // Pages & Tools
  {
    id: 'page-dashboard',
    type: 'Pages',
    title: 'Live Dashboard',
    subtitle: 'Upcoming Grand Prix countdown, weather & recent podiums',
    link: '/dashboard',
    icon: LayoutDashboard,
    keywords: ['home', 'race', 'live', 'countdown', 'weather', 'beranda', 'jadwal']
  },
  {
    id: 'page-races',
    type: 'Pages',
    title: 'Race Calendar & Circuits',
    subtitle: 'All season Grand Prix events, track maps & session details',
    link: '/races',
    icon: Flag,
    keywords: ['calendar', 'schedule', 'circuit', 'tracks', 'jadwal', 'balapan']
  },
  {
    id: 'page-stats',
    type: 'Pages',
    title: 'Championship Standings',
    subtitle: 'Official Driver & Constructor Championship leaderboard',
    link: '/stats',
    icon: Trophy,
    keywords: ['standings', 'leaderboard', 'points', 'klasemen', 'poin', 'rank']
  },
  {
    id: 'page-compare',
    type: 'Pages',
    title: 'Driver H2H Compare',
    subtitle: 'Universal head-to-head battle comparator & progression charts',
    link: '/compare',
    icon: Users,
    keywords: ['compare', 'h2h', 'versus', 'head to head', 'duel', 'bandingkan']
  },
  {
    id: 'page-telemetry',
    type: 'Pages',
    title: 'Race Telemetry Pro',
    subtitle: 'Pick a race weekend, then dive into speed, throttle & delta analysis',
    link: '/races',
    icon: Activity,
    keywords: ['telemetry', 'data', 'speed', 'delta', 'throttle', 'brake', 'gear', 'grafik']
  },

  // Teams
  {
    id: 'team-red_bull_racing',
    type: 'Teams',
    title: 'Red Bull Racing',
    subtitle: 'Formula One Team · Milton Keynes, UK',
    team: 'Red Bull Racing',
    link: '/team/red_bull_racing',
    icon: Users,
    keywords: ['red bull', 'rbr', 'verstappen', 'perez', 'honda']
  },
  {
    id: 'team-ferrari',
    type: 'Teams',
    title: 'Scuderia Ferrari',
    subtitle: 'Formula One Team · Maranello, Italy',
    team: 'Ferrari',
    link: '/team/ferrari',
    icon: Users,
    keywords: ['ferrari', 'scuderia', 'leclerc', 'hamilton']
  },
  {
    id: 'team-mclaren',
    type: 'Teams',
    title: 'McLaren F1 Team',
    subtitle: 'Formula One Team · Woking, UK',
    team: 'McLaren',
    link: '/team/mclaren',
    icon: Users,
    keywords: ['mclaren', 'norris', 'piastri', 'papaya']
  },
  {
    id: 'team-mercedes',
    type: 'Teams',
    title: 'Mercedes-AMG PETRONAS',
    subtitle: 'Formula One Team · Brackley, UK',
    team: 'Mercedes',
    link: '/team/mercedes',
    icon: Users,
    keywords: ['mercedes', 'russell', 'antonelli', 'silver arrows']
  },
  {
    id: 'team-aston_martin',
    type: 'Teams',
    title: 'Aston Martin Aramco',
    subtitle: 'Formula One Team · Silverstone, UK',
    team: 'Aston Martin',
    link: '/team/aston_martin',
    icon: Users,
    keywords: ['aston martin', 'alonso', 'stroll']
  },
  {
    id: 'team-alpine',
    type: 'Teams',
    title: 'Alpine F1 Team',
    subtitle: 'Formula One Team · Enstone, UK',
    team: 'Alpine',
    link: '/team/alpine',
    icon: Users,
    keywords: ['alpine', 'gasly', 'doohan', 'renault']
  },
  {
    id: 'team-williams',
    type: 'Teams',
    title: 'Williams Racing',
    subtitle: 'Formula One Team · Grove, UK',
    team: 'Williams',
    link: '/team/williams',
    icon: Users,
    keywords: ['williams', 'albon', 'sainz', 'colapinto']
  },
  {
    id: 'team-rb',
    type: 'Teams',
    title: 'Visa Cash App RB (Racing Bulls)',
    subtitle: 'Formula One Team · Faenza, Italy',
    team: 'RB',
    link: '/team/rb',
    icon: Users,
    keywords: ['rb', 'racing bulls', 'alpha tauri', 'tsunoda', 'lawson']
  },
  {
    id: 'team-sauber',
    type: 'Teams',
    title: 'Stake F1 Team Kick Sauber',
    subtitle: 'Formula One Team · Hinwil, Switzerland',
    team: 'Sauber',
    link: '/team/sauber',
    icon: Users,
    keywords: ['sauber', 'kick sauber', 'stake', 'hulkenberg', 'bortoleto', 'audi']
  },
  {
    id: 'team-haas_f1_team',
    type: 'Teams',
    title: 'Haas F1 Team',
    subtitle: 'Formula One Team · Kannapolis, USA',
    team: 'Haas F1 Team',
    link: '/team/haas_f1_team',
    icon: Users,
    keywords: ['haas', 'bearman', 'ocon']
  },

  // Drivers
  {
    id: 'driver-max_verstappen',
    type: 'Drivers',
    title: 'Max Verstappen',
    code: 'VER',
    number: 1,
    team: 'Red Bull Racing',
    subtitle: '#1 · Red Bull Racing',
    link: '/driver/max_verstappen',
    icon: User,
    keywords: ['max', 'verstappen', 'ver', 'red bull', 'champion', '1']
  },
  {
    id: 'driver-lando_norris',
    type: 'Drivers',
    title: 'Lando Norris',
    code: 'NOR',
    number: 4,
    team: 'McLaren',
    subtitle: '#4 · McLaren',
    link: '/driver/lando_norris',
    icon: User,
    keywords: ['lando', 'norris', 'nor', 'mclaren', '4']
  },
  {
    id: 'driver-charles_leclerc',
    type: 'Drivers',
    title: 'Charles Leclerc',
    code: 'LEC',
    number: 16,
    team: 'Ferrari',
    subtitle: '#16 · Ferrari',
    link: '/driver/charles_leclerc',
    icon: User,
    keywords: ['charles', 'leclerc', 'lec', 'ferrari', '16']
  },
  {
    id: 'driver-oscar_piastri',
    type: 'Drivers',
    title: 'Oscar Piastri',
    code: 'PIA',
    number: 81,
    team: 'McLaren',
    subtitle: '#81 · McLaren',
    link: '/driver/oscar_piastri',
    icon: User,
    keywords: ['oscar', 'piastri', 'pia', 'mclaren', '81']
  },
  {
    id: 'driver-carlos_sainz',
    type: 'Drivers',
    title: 'Carlos Sainz',
    code: 'SAI',
    number: 55,
    team: 'Ferrari',
    subtitle: '#55 · Ferrari',
    link: '/driver/carlos_sainz',
    icon: User,
    keywords: ['carlos', 'sainz', 'sai', 'ferrari', 'smooth operator', '55']
  },
  {
    id: 'driver-lewis_hamilton',
    type: 'Drivers',
    title: 'Lewis Hamilton',
    code: 'HAM',
    number: 44,
    team: 'Mercedes',
    subtitle: '#44 · Mercedes',
    link: '/driver/lewis_hamilton',
    icon: User,
    keywords: ['lewis', 'hamilton', 'ham', 'mercedes', '7x champion', '44']
  },
  {
    id: 'driver-george_russell',
    type: 'Drivers',
    title: 'George Russell',
    code: 'RUS',
    number: 63,
    team: 'Mercedes',
    subtitle: '#63 · Mercedes',
    link: '/driver/george_russell',
    icon: User,
    keywords: ['george', 'russell', 'rus', 'mercedes', '63']
  },
  {
    id: 'driver-sergio_perez',
    type: 'Drivers',
    title: 'Sergio Perez',
    code: 'PER',
    number: 11,
    team: 'Red Bull Racing',
    subtitle: '#11 · Red Bull Racing',
    link: '/driver/sergio_perez',
    icon: User,
    keywords: ['sergio', 'checo', 'perez', 'per', 'red bull', '11']
  },
  {
    id: 'driver-fernando_alonso',
    type: 'Drivers',
    title: 'Fernando Alonso',
    code: 'ALO',
    number: 14,
    team: 'Aston Martin',
    subtitle: '#14 · Aston Martin',
    link: '/driver/fernando_alonso',
    icon: User,
    keywords: ['fernando', 'alonso', 'alo', 'aston martin', 'el nano', '14']
  },
  {
    id: 'driver-lance_stroll',
    type: 'Drivers',
    title: 'Lance Stroll',
    code: 'STR',
    number: 18,
    team: 'Aston Martin',
    subtitle: '#18 · Aston Martin',
    link: '/driver/lance_stroll',
    icon: User,
    keywords: ['lance', 'stroll', 'str', 'aston martin', '18']
  },
  {
    id: 'driver-pierre_gasly',
    type: 'Drivers',
    title: 'Pierre Gasly',
    code: 'GAS',
    number: 10,
    team: 'Alpine',
    subtitle: '#10 · Alpine',
    link: '/driver/pierre_gasly',
    icon: User,
    keywords: ['pierre', 'gasly', 'gas', 'alpine', '10']
  },
  {
    id: 'driver-esteban_ocon',
    type: 'Drivers',
    title: 'Esteban Ocon',
    code: 'OCO',
    number: 31,
    team: 'Alpine',
    subtitle: '#31 · Alpine',
    link: '/driver/esteban_ocon',
    icon: User,
    keywords: ['esteban', 'ocon', 'oco', 'alpine', 'haas', '31']
  },
  {
    id: 'driver-alexander_albon',
    type: 'Drivers',
    title: 'Alexander Albon',
    code: 'ALB',
    number: 23,
    team: 'Williams',
    subtitle: '#23 · Williams',
    link: '/driver/alexander_albon',
    icon: User,
    keywords: ['alexander', 'albon', 'alb', 'williams', '23']
  },
  {
    id: 'driver-franco_colapinto',
    type: 'Drivers',
    title: 'Franco Colapinto',
    code: 'COL',
    number: 43,
    team: 'Williams',
    subtitle: '#43 · Williams',
    link: '/driver/franco_colapinto',
    icon: User,
    keywords: ['franco', 'colapinto', 'col', 'williams', 'argentina', '43']
  },
  {
    id: 'driver-nico_hulkenberg',
    type: 'Drivers',
    title: 'Nico Hulkenberg',
    code: 'HUL',
    number: 27,
    team: 'Haas F1 Team',
    subtitle: '#27 · Haas F1 Team',
    link: '/driver/nico_hulkenberg',
    icon: User,
    keywords: ['nico', 'hulkenberg', 'hul', 'haas', 'sauber', 'hulk', '27']
  },
  {
    id: 'driver-kevin_magnussen',
    type: 'Drivers',
    title: 'Kevin Magnussen',
    code: 'MAG',
    number: 20,
    team: 'Haas F1 Team',
    subtitle: '#20 · Haas F1 Team',
    link: '/driver/kevin_magnussen',
    icon: User,
    keywords: ['kevin', 'magnussen', 'mag', 'haas', 'kmag', '20']
  },
  {
    id: 'driver-yuki_tsunoda',
    type: 'Drivers',
    title: 'Yuki Tsunoda',
    code: 'TSU',
    number: 22,
    team: 'RB',
    subtitle: '#22 · RB',
    link: '/driver/yuki_tsunoda',
    icon: User,
    keywords: ['yuki', 'tsunoda', 'tsu', 'rb', 'japan', '22']
  },
  {
    id: 'driver-daniel_ricciardo',
    type: 'Drivers',
    title: 'Daniel Ricciardo',
    code: 'RIC',
    number: 3,
    team: 'RB',
    subtitle: '#3 · RB',
    link: '/driver/daniel_ricciardo',
    icon: User,
    keywords: ['daniel', 'ricciardo', 'ric', 'rb', 'honey badger', '3']
  },
  {
    id: 'driver-liam_lawson',
    type: 'Drivers',
    title: 'Liam Lawson',
    code: 'LAW',
    number: 30,
    team: 'RB',
    subtitle: '#30 · RB',
    link: '/driver/liam_lawson',
    icon: User,
    keywords: ['liam', 'lawson', 'law', 'rb', 'red bull', '30']
  },
  {
    id: 'driver-valtteri_bottas',
    type: 'Drivers',
    title: 'Valtteri Bottas',
    code: 'BOT',
    number: 77,
    team: 'Sauber',
    subtitle: '#77 · Kick Sauber',
    link: '/driver/valtteri_bottas',
    icon: User,
    keywords: ['valtteri', 'bottas', 'bot', 'sauber', '77']
  },
  {
    id: 'driver-zhou_guanyu',
    type: 'Drivers',
    title: 'Zhou Guanyu',
    code: 'ZHO',
    number: 24,
    team: 'Sauber',
    subtitle: '#24 · Kick Sauber',
    link: '/driver/zhou_guanyu',
    icon: User,
    keywords: ['zhou', 'guanyu', 'zho', 'sauber', 'china', '24']
  },
  {
    id: 'driver-oliver_bearman',
    type: 'Drivers',
    title: 'Oliver Bearman',
    code: 'BEA',
    number: 38,
    team: 'Haas F1 Team',
    subtitle: '#38 · Haas / Ferrari',
    link: '/driver/oliver_bearman',
    icon: User,
    keywords: ['oliver', 'bearman', 'bea', 'ferrari', 'haas', '38']
  },
  {
    id: 'driver-andrea_kimi_antonelli',
    type: 'Drivers',
    title: 'Kimi Antonelli',
    code: 'ANT',
    number: 12,
    team: 'Mercedes',
    subtitle: '#12 · Mercedes',
    link: '/driver/andrea_kimi_antonelli',
    icon: User,
    keywords: ['kimi', 'antonelli', 'andrea', 'ant', 'mercedes', '12']
  },

  // Grand Prix Circuits & Races
  {
    id: 'race-bahrain',
    type: 'Circuits',
    title: 'Bahrain Grand Prix',
    subtitle: 'Bahrain International Circuit · Round 1',
    round: 1,
    link: `/race/${year}/1`,
    icon: MapPin,
    keywords: ['bahrain', 'sakhir', 'round 1', 'desert']
  },
  {
    id: 'race-saudi',
    type: 'Circuits',
    title: 'Saudi Arabian Grand Prix',
    subtitle: 'Jeddah Corniche Circuit · Round 2',
    round: 2,
    link: `/race/${year}/2`,
    icon: MapPin,
    keywords: ['saudi arabia', 'jeddah', 'round 2', 'corniche']
  },
  {
    id: 'race-australia',
    type: 'Circuits',
    title: 'Australian Grand Prix',
    subtitle: 'Albert Park Circuit, Melbourne · Round 3',
    round: 3,
    link: `/race/${year}/3`,
    icon: MapPin,
    keywords: ['australia', 'melbourne', 'albert park', 'round 3']
  },
  {
    id: 'race-japan',
    type: 'Circuits',
    title: 'Japanese Grand Prix',
    subtitle: 'Suzuka International Racing Course · Round 4',
    round: 4,
    link: `/race/${year}/4`,
    icon: MapPin,
    keywords: ['japan', 'suzuka', 'round 4', 'figure 8']
  },
  {
    id: 'race-china',
    type: 'Circuits',
    title: 'Chinese Grand Prix',
    subtitle: 'Shanghai International Circuit · Round 5',
    round: 5,
    link: `/race/${year}/5`,
    icon: MapPin,
    keywords: ['china', 'shanghai', 'round 5']
  },
  {
    id: 'race-miami',
    type: 'Circuits',
    title: 'Miami Grand Prix',
    subtitle: 'Miami International Autodrome · Round 6',
    round: 6,
    link: `/race/${year}/6`,
    icon: MapPin,
    keywords: ['miami', 'florida', 'usa', 'round 6', 'hard rock stadium']
  },
  {
    id: 'race-monaco',
    type: 'Circuits',
    title: 'Monaco Grand Prix',
    subtitle: 'Circuit de Monaco, Monte Carlo · Round 8',
    round: 8,
    link: `/race/${year}/8`,
    icon: MapPin,
    keywords: ['monaco', 'monte carlo', 'round 8', 'street circuit', 'principality']
  },
  {
    id: 'race-silverstone',
    type: 'Circuits',
    title: 'British Grand Prix',
    subtitle: 'Silverstone Circuit · Round 12',
    round: 12,
    link: `/race/${year}/12`,
    icon: MapPin,
    keywords: ['britain', 'silverstone', 'england', 'uk', 'round 12', 'copse', 'maggotts']
  },
  {
    id: 'race-spa',
    type: 'Circuits',
    title: 'Belgian Grand Prix',
    subtitle: 'Circuit de Spa-Francorchamps · Round 14',
    round: 14,
    link: `/race/${year}/14`,
    icon: MapPin,
    keywords: ['belgium', 'spa', 'francorchamps', 'eau rouge', 'raidillon', 'round 14']
  },
  {
    id: 'race-monza',
    type: 'Circuits',
    title: 'Italian Grand Prix',
    subtitle: 'Autodromo Nazionale Monza · Round 16',
    round: 16,
    link: `/race/${year}/16`,
    icon: MapPin,
    keywords: ['italy', 'monza', 'temple of speed', 'round 16', 'tifosi']
  },
  {
    id: 'race-singapore',
    type: 'Circuits',
    title: 'Singapore Grand Prix',
    subtitle: 'Marina Bay Street Circuit · Round 18',
    round: 18,
    link: `/race/${year}/18`,
    icon: MapPin,
    keywords: ['singapore', 'marina bay', 'night race', 'round 18']
  },
  {
    id: 'race-brazil',
    type: 'Circuits',
    title: 'Sao Paulo Grand Prix',
    subtitle: 'Autodromo Jose Carlos Pace, Interlagos · Round 21',
    round: 21,
    link: `/race/${year}/21`,
    icon: MapPin,
    keywords: ['brazil', 'interlagos', 'sao paulo', 'senna', 'round 21']
  },
  {
    id: 'race-las-vegas',
    type: 'Circuits',
    title: 'Las Vegas Grand Prix',
    subtitle: 'Las Vegas Strip Circuit · Round 22',
    round: 22,
    link: `/race/${year}/22`,
    icon: MapPin,
    keywords: ['las vegas', 'vegas', 'strip', 'nevada', 'round 22']
  },
  {
    id: 'race-abu-dhabi',
    type: 'Circuits',
    title: 'Abu Dhabi Grand Prix',
    subtitle: 'Yas Marina Circuit · Round 24',
    round: 24,
    link: `/race/${year}/24`,
    icon: MapPin,
    keywords: ['abu dhabi', 'yas marina', 'season finale', 'round 24']
  }
];

const CATEGORIES = ['All', 'Drivers', 'Teams', 'Circuits', 'Pages'];

export default function CommandPalette({ isOpen, setIsOpen }) {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('All');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [items, setItems] = useState(defaultSearchItems);
  
  const inputRef = useRef(null);
  const listRef = useRef(null);
  const navigate = useNavigate();

  // Focus input whenever opened
  useEffect(() => {
    if (isOpen) {
      setQuery('');
      setSelectedIndex(0);
      setTimeout(() => {
        inputRef.current?.focus();
      }, 50);
    }
  }, [isOpen]);

  // Optional background fetch from API to ensure dynamic races or new drivers are incorporated
  useEffect(() => {
    const fetchDynamicItems = async () => {
      try {
        const year = new Date().getFullYear();
        const res = await fetch(`${API_URL}/api/races/${year}`);
        if (!res.ok) return;
        const racesData = await res.json();
        if (Array.isArray(racesData) && racesData.length > 0) {
          const dynamicRaces = racesData.map(r => ({
            id: `race-${r.round_number}`,
            type: 'Circuits',
            title: r.event_name || `Round ${r.round_number}`,
            subtitle: `${r.location || 'F1 Circuit'} · Round ${r.round_number}`,
            round: r.round_number,
            link: `/race/${year}/${r.round_number}`,
            icon: MapPin,
            keywords: [r.event_name, r.location, `round ${r.round_number}`].filter(Boolean)
          }));
          
          setItems(prev => {
            const staticNonRaces = prev.filter(i => i.type !== 'Circuits');
            return [...staticNonRaces, ...dynamicRaces];
          });
        }
      } catch {
        // Silent fallback to defaultSearchItems
      }
    };
    fetchDynamicItems();
  }, []);

  // Filtered results
  const filteredItems = useMemo(() => {
    const cleanQuery = query.trim().toLowerCase();
    
    return items.filter(item => {
      // Category filter
      if (selectedCategory !== 'All' && item.type !== selectedCategory) {
        return false;
      }

      if (!cleanQuery) return true;

      const titleMatch = item.title?.toLowerCase().includes(cleanQuery);
      const subtitleMatch = item.subtitle?.toLowerCase().includes(cleanQuery);
      const codeMatch = item.code?.toLowerCase().includes(cleanQuery);
      const teamMatch = item.team?.toLowerCase().includes(cleanQuery);
      const keywordsMatch = item.keywords?.some(k => k.toLowerCase().includes(cleanQuery));

      return titleMatch || subtitleMatch || codeMatch || teamMatch || keywordsMatch;
    });
  }, [query, selectedCategory, items]);

  // Reset selected index when filtered list changes
  useEffect(() => {
    setSelectedIndex(0);
  }, [query, selectedCategory]);

  // Scroll active item into view
  useEffect(() => {
    if (listRef.current) {
      const activeEl = listRef.current.querySelector(`[data-index="${selectedIndex}"]`);
      if (activeEl) {
        activeEl.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
      }
    }
  }, [selectedIndex]);

  // Handle keyboard events (ArrowUp, ArrowDown, Enter, Esc)
  const handleKeyDown = (e) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex(prev => (prev < filteredItems.length - 1 ? prev + 1 : 0));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex(prev => (prev > 0 ? prev - 1 : Math.max(0, filteredItems.length - 1)));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      if (filteredItems[selectedIndex]) {
        handleSelect(filteredItems[selectedIndex]);
      }
    } else if (e.key === 'Escape') {
      e.preventDefault();
      setIsOpen(false);
    }
  };

  const handleSelect = (item) => {
    setIsOpen(false);
    if (item.link) {
      navigate(item.link);
    }
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-start justify-center pt-16 md:pt-24 px-4 bg-black/80 backdrop-blur-md animate-fadeIn transition-all"
      onClick={() => setIsOpen(false)}
    >
      <div 
        className="w-full max-w-2xl bg-neutral-900/95 border border-neutral-700/80 rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh] backdrop-blur-2xl ring-1 ring-white/10"
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Bar */}
        <div className="relative flex items-center px-4 py-3.5 border-b border-neutral-800 bg-neutral-950/60">
          <Search className="text-red-500 mr-3 shrink-0" size={20} />
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search drivers, teams, circuits, or tools... (e.g. Verstappen, Ferrari, Monaco, Compare)"
            className="w-full bg-transparent text-white text-base placeholder-neutral-500 focus:outline-none"
          />
          {query && (
            <button 
              onClick={() => setQuery('')}
              className="text-neutral-400 hover:text-white p-1 rounded-md transition-colors mr-2"
            >
              <X size={16} />
            </button>
          )}
          <span className="hidden sm:inline-block px-2 py-0.5 text-[11px] font-mono font-bold bg-neutral-800 text-neutral-400 rounded border border-neutral-700">
            ESC
          </span>
        </div>

        {/* Filter Category Pills */}
        <div className="flex items-center gap-1.5 px-4 py-2 border-b border-neutral-800/80 bg-neutral-900/50 overflow-x-auto text-xs scrollbar-none">
          {CATEGORIES.map(cat => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3 py-1 rounded-full font-medium transition-all duration-150 shrink-0 ${
                selectedCategory === cat 
                  ? 'bg-red-600 text-white shadow-sm shadow-red-600/30 font-semibold' 
                  : 'bg-neutral-800/70 text-neutral-400 hover:text-white hover:bg-neutral-700/60'
              }`}
            >
              {cat}
            </button>
          ))}
          <span className="ml-auto text-[11px] text-neutral-500 hidden sm:inline shrink-0 font-mono">
            {filteredItems.length} result{filteredItems.length === 1 ? '' : 's'}
          </span>
        </div>

        {/* Results List */}
        <div 
          ref={listRef}
          className="flex-1 overflow-y-auto p-2 space-y-1 divide-y divide-neutral-800/20 max-h-[50vh] scrollbar-thin scrollbar-thumb-neutral-700"
        >
          {filteredItems.length === 0 ? (
            <div className="py-12 text-center text-neutral-500">
              <Search className="mx-auto mb-2 opacity-30 text-red-500" size={36} />
              <p className="text-sm font-medium text-neutral-400">No results found for "{query}"</p>
              <p className="text-xs text-neutral-600 mt-1">Try searching for driver names (Leclerc), teams (McLaren), or tools (Telemetry).</p>
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const isSelected = idx === selectedIndex;
              const Icon = item.icon || Sparkles;
              const accentColor = item.team ? (teamColors[item.team] || '#EF4444') : '#EF4444';

              return (
                <div
                  key={item.id}
                  data-index={idx}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                  className={`flex items-center justify-between px-3.5 py-2.5 rounded-xl cursor-pointer transition-all duration-150 group ${
                    isSelected 
                      ? 'bg-neutral-800/90 text-white shadow-md border border-neutral-700/70' 
                      : 'hover:bg-neutral-800/50 text-neutral-300 border border-transparent'
                  }`}
                >
                  <div className="flex items-center gap-3 min-w-0">
                    {/* Item Avatar / Icon with team accent */}
                    <div 
                      className="w-9 h-9 rounded-lg flex items-center justify-center shrink-0 border relative overflow-hidden"
                      style={{ 
                        borderColor: item.team ? `${accentColor}55` : '#374151',
                        backgroundColor: isSelected ? '#18181b' : '#111827'
                      }}
                    >
                      {item.team && teamLogos[item.team] ? (
                        <img 
                          src={teamLogos[item.team]} 
                          alt={item.team} 
                          className="w-5 h-5 object-contain"
                        />
                      ) : (
                        <Icon size={18} style={{ color: item.team ? accentColor : '#EF4444' }} />
                      )}
                      {item.team && (
                        <div 
                          className="absolute bottom-0 left-0 right-0 h-0.5" 
                          style={{ backgroundColor: accentColor }} 
                        />
                      )}
                    </div>

                    {/* Title & Subtitle */}
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate text-white">
                          {item.title}
                        </span>
                        {item.code && (
                          <span className="px-1.5 py-0.2 text-[10px] font-mono font-bold bg-neutral-800 text-neutral-300 rounded border border-neutral-700">
                            {item.code}
                          </span>
                        )}
                        {item.number !== undefined && (
                          <span 
                            className="px-1.5 py-0.2 text-[10px] font-mono font-bold rounded"
                            style={{ 
                              backgroundColor: `${accentColor}25`, 
                              color: accentColor,
                              border: `1px solid ${accentColor}50` 
                            }}
                          >
                            #{item.number}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-neutral-400 truncate">
                        {item.subtitle}
                      </p>
                    </div>
                  </div>

                  {/* Right side category badge / arrow */}
                  <div className="flex items-center gap-2.5 shrink-0 ml-3">
                    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-neutral-800/90 text-neutral-400 border border-neutral-700/50">
                      {item.type}
                    </span>
                    <div className={`p-1 rounded-md transition-transform ${isSelected ? 'text-red-500 translate-x-0.5' : 'text-neutral-600'}`}>
                      <CornerDownLeft size={14} />
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer Shortcut Bar */}
        <div className="px-4 py-2.5 bg-neutral-950/80 border-t border-neutral-800 text-neutral-400 text-[11px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-300 font-mono text-[10px]">↑</kbd>
              <kbd className="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-300 font-mono text-[10px]">↓</kbd>
              <span>to navigate</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-300 font-mono text-[10px]">↵</kbd>
              <span>to select</span>
            </span>
            <span className="flex items-center gap-1">
              <kbd className="px-1.5 py-0.5 bg-neutral-800 border border-neutral-700 rounded text-neutral-300 font-mono text-[10px]">ESC</kbd>
              <span>to close</span>
            </span>
          </div>
          <span className="text-neutral-500 hidden md:inline">
            F1 Data Hub Quick Finder
          </span>
        </div>
      </div>
    </div>
  );
}
