import { useState, useEffect, useMemo, useRef } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import {
  Trophy, Medal, AlertTriangle, ArrowLeftRight, Crown,
  Database, Sparkles, ChevronDown,
  Search, Zap, Swords, Flame, TrendingUp, Star,
  Download, Hash, Gauge, Scale, CircleDot, Flag, Users,
  BarChart3, Shield, Minus, Crosshair, Ban
} from 'lucide-react';
import { teamLogos, teamColors } from '../data/teamData';
import { fetchChampionship, fetchDriverProfile } from '../services/api';
import type { ChampionshipPayload, DriverProfilePayload } from '../services/api';
import { toNumber } from '../utils/data';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer } from 'recharts';
import html2canvas from 'html2canvas';
import DriverRadarChart from '../components/DriverRadarChart';

interface CompareDriver {
  id: string;
  name: string;
  team: string;
  teamId: string;
  position: number;
  points: number;
  wins: number;
  podiums: number;
  dnfs: number;
  dnss: number;
  pointsLastRace: number;
  abbreviation: string;
  driverNumber?: number;
  color: string;
}

interface StatMetric {
  key: string;
  label: string;
  val1: number;
  val2: number;
  unit?: string;
  invert?: boolean;
  icon: typeof Trophy;
  /** Custom value formatter, e.g. finishing positions as `P3` / `-`. */
  format?: (v: number) => string;
}

interface MergedProgressionRow {
  round: number;
  race_name: string;
  location: string;
  d1_points: number;
  d1_cum: number;
  d1_pos: number | string;
  d1_sprint_pos: number | string | null;
  d1_sprint_points: number;
  d2_points: number;
  d2_cum: number;
  d2_pos: number | string;
  d2_sprint_pos: number | string | null;
  d2_sprint_points: number;
  winner: string | null;
}

/**
 * Sprint-aware incident count: the driver-profile endpoint is the source of
 * truth (identical numbers to DriverProfilePage and /stats); the championship
 * payload is only the fallback while that request is in flight.
 */
const incidentCount = (
  profile: DriverProfilePayload | undefined,
  fallback: number | undefined,
  key: 'dnfs' | 'dnss',
): number => (profile ? toNumber(profile[key]) : toNumber(fallback));

/**
 * Sprint-aware session rows identify drivers by FullName, while the
 * championship table can carry a shorter display name (e.g. FastF1's
 * "Andrea Kimi Antonelli" vs the table's "Kimi Antonelli"). Match on the FIA
 * abbreviation first — unique per driver — then fall back to a normalized
 * name comparison so every round maps to both drivers 100% of the time.
 */
const normalizeDriverName = (value: unknown): string =>
  String(value ?? '').toLowerCase().replace(/[^a-z]/g, '');

const rowMatchesDriver = (
  row: { FullName?: unknown; Abbreviation?: unknown },
  driver: CompareDriver,
): boolean => {
  const rowAbbr = String(row.Abbreviation ?? '').toLowerCase();
  const driverAbbr = driver.abbreviation.toLowerCase();
  if (driverAbbr && rowAbbr && rowAbbr === driverAbbr) return true;
  const rowName = normalizeDriverName(row.FullName);
  const driverName = normalizeDriverName(driver.name);
  return (
    rowName !== '' &&
    driverName !== '' &&
    (rowName === driverName || rowName.endsWith(driverName))
  );
};

interface DriverSelectorProps {
  label: string;
  selectedId: string;
  otherSelectedId: string;
  drivers: CompareDriver[];
  onSelect: (id: string) => void;
  accentColor: string;
}

const DriverSelector = ({
  label,
  selectedId,
  otherSelectedId,
  drivers,
  onSelect,
  accentColor,
}: DriverSelectorProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const [filter, setFilter] = useState('');
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedDriver = drivers.find((d) => d.id === selectedId);

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const filteredDrivers = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return drivers;
    return drivers.filter(
      (d) =>
        d.name.toLowerCase().includes(q) ||
        d.team.toLowerCase().includes(q) ||
        d.abbreviation.toLowerCase().includes(q) ||
        (d.driverNumber && d.driverNumber.toString().includes(q))
    );
  }, [drivers, filter]);

  return (
    <div className="relative w-full" ref={dropdownRef}>
      <span className="block text-[10px] font-mono uppercase tracking-widest text-neutral-400 mb-1.5 font-bold">
        {label}
      </span>
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-3 px-4 py-3 bg-neutral-900/90 hover:bg-neutral-850 border border-neutral-800 rounded-xl text-left transition-all shadow-lg group focus:outline-none focus:border-neutral-600"
        style={{ borderLeftColor: accentColor, borderLeftWidth: '4px' }}
      >
        {selectedDriver ? (
          <div className="flex items-center gap-3 min-w-0">
            {selectedDriver.driverNumber && (
              <span className="font-mono text-xs font-black px-1.5 py-0.5 rounded bg-neutral-800 text-neutral-300 border border-neutral-700">
                #{selectedDriver.driverNumber}
              </span>
            )}
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <span className="text-white font-black text-sm uppercase italic truncate">
                  {selectedDriver.name}
                </span>
                <span className="text-[10px] font-mono font-bold text-neutral-500">
                  {selectedDriver.abbreviation}
                </span>
              </div>
              <span className="text-[11px] text-neutral-400 truncate block font-medium">
                {selectedDriver.team}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-neutral-500 text-sm font-mono">Select driver...</span>
        )}
        <div className="flex items-center gap-2 flex-shrink-0">
          {selectedDriver && (
            <span
              className="text-[10px] font-mono font-black px-2 py-0.5 rounded"
              style={{
                backgroundColor: `${accentColor}20`,
                color: accentColor,
                border: `1px solid ${accentColor}40`,
              }}
            >
              P{selectedDriver.position}
            </span>
          )}
          <ChevronDown
            size={16}
            className={`text-neutral-500 transition-transform ${isOpen ? 'rotate-180' : ''}`}
          />
        </div>
      </button>

      {isOpen && (
        <div className="absolute top-full left-0 right-0 mt-2 z-50 bg-neutral-950/95 backdrop-blur-xl border border-neutral-800 rounded-2xl shadow-2xl p-2 max-h-72 flex flex-col">
          <div className="relative mb-2">
            <Search
              size={14}
              className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500"
            />
            <input
              type="text"
              placeholder="Search driver, team, or #..."
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              className="w-full bg-neutral-900 border border-neutral-800 rounded-lg pl-8 pr-3 py-1.5 text-xs text-white placeholder-neutral-500 font-mono focus:outline-none focus:border-red-500"
              autoFocus
            />
          </div>

          <div className="overflow-y-auto space-y-1 pr-1 flex-1 custom-scrollbar">
            {filteredDrivers.map((driver) => {
              const isSelected = driver.id === selectedId;
              const isOther = driver.id === otherSelectedId;
              const teamCol = driver.color;

              return (
                <button
                  key={driver.id}
                  type="button"
                  onClick={() => {
                    onSelect(driver.id);
                    setIsOpen(false);
                    setFilter('');
                  }}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl text-left transition-all ${
                    isSelected
                      ? 'bg-neutral-800/90 text-white border border-neutral-700'
                      : 'hover:bg-neutral-900/80 text-neutral-300'
                  }`}
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span
                      className="w-2 h-6 rounded-full flex-shrink-0"
                      style={{ backgroundColor: teamCol }}
                    />
                    {driver.driverNumber && (
                      <span className="font-mono text-[10px] text-neutral-400 w-6">
                        #{driver.driverNumber}
                      </span>
                    )}
                    <div className="min-w-0">
                      <span className="text-xs font-bold truncate block text-white">
                        {driver.name}
                      </span>
                      <span className="text-[10px] text-neutral-500 truncate block">
                        {driver.team}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center gap-2 flex-shrink-0">
                    {isOther && (
                      <span className="text-[9px] font-mono text-neutral-500 uppercase bg-neutral-900 px-1.5 py-0.5 rounded">
                        Rival
                      </span>
                    )}
                    <span className="text-[10px] font-mono font-bold text-neutral-400">
                      P{driver.position}
                    </span>
                    <span className="text-[10px] font-mono font-black text-white w-12 text-right">
                      {driver.points} pts
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};

interface ComparativeMetricBarProps {
  metric: StatMetric;
  driver1: CompareDriver;
  driver2: CompareDriver;
}

const ComparativeMetricBar = ({ metric, driver1, driver2 }: ComparativeMetricBarProps) => {
  const { label, val1, val2, unit = '', invert = false, icon: Icon, format } = metric;
  const display1 = format ? format(val1) : `${val1}${unit}`;
  const display2 = format ? format(val2) : `${val2}${unit}`;

  let winner: 1 | 2 | 0 = 0;
  if (val1 !== val2) {
    if (invert) {
      winner = val1 < val2 ? 1 : 2;
    } else {
      winner = val1 > val2 ? 1 : 2;
    }
  }

  let p1Width = 50;
  let p2Width = 50;

  if (invert) {
    if (val1 === 0 && val2 === 0) {
      p1Width = 50;
      p2Width = 50;
    } else {
      const total = val1 + val2;
      p1Width = (1 - val1 / total) * 100;
      p2Width = (1 - val2 / total) * 100;
      const sum = p1Width + p2Width;
      p1Width = (p1Width / sum) * 100;
      p2Width = (p2Width / sum) * 100;
    }
  } else {
    const total = val1 + val2;
    if (total > 0) {
      p1Width = (val1 / total) * 100;
      p2Width = (val2 / total) * 100;
    } else {
      p1Width = 50;
      p2Width = 50;
    }
  }

  if (p1Width < 10) {
    p1Width = 10;
    p2Width = 90;
  } else if (p1Width > 90) {
    p1Width = 90;
    p2Width = 10;
  }

  return (
    <div className="bg-neutral-950/60 border border-neutral-800/80 rounded-2xl p-4 shadow-sm hover:border-neutral-700 transition-colors">
      <div className="flex justify-between items-center text-xs mb-2">
        <span className={`font-black text-sm font-mono ${winner === 1 ? 'text-white' : 'text-neutral-500'}`}>
          {display1}
          {winner === 1 && <Flame size={12} className="inline ml-1 text-orange-400" />}
        </span>
        <span className="text-neutral-400 font-bold uppercase tracking-wider text-[11px] flex items-center gap-1.5">
          <Icon size={13} />
          {label}
        </span>
        <span className={`font-black text-sm font-mono ${winner === 2 ? 'text-white' : 'text-neutral-500'}`}>
          {winner === 2 && <Flame size={12} className="inline mr-1 text-orange-400" />}
          {display2}
        </span>
      </div>
      <div className="w-full bg-neutral-800 rounded-full h-2.5 overflow-hidden flex">
        <div className="h-full transition-all duration-700 rounded-l-full" style={{ width: `${p1Width}%`, backgroundColor: driver1.color }} />
        <div className="h-full transition-all duration-700 rounded-r-full" style={{ width: `${p2Width}%`, backgroundColor: driver2.color }} />
      </div>
      <div className="flex justify-between items-center mt-2 text-[10px] font-mono text-neutral-500 font-medium">
        <span>{driver1.abbreviation}</span>
        <span>{invert ? 'Lower is better' : 'Higher is better'}</span>
        <span>{driver2.abbreviation}</span>
      </div>
    </div>
  );
};

const ComparePage = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const currentYear = new Date().getFullYear();
  const [activeTab, setActiveTab] = useState('overview');

  const { data, isLoading, error } = useQuery<ChampionshipPayload>({
    // Dedicated championship key: StatsPage caches the SQLite standings
    // (no session_results) under ['standings', year], and with the global
    // 5-minute staleTime that payload used to satisfy this query without a
    // refetch, leaving the battle log empty. Same key + queryFn as the
    // Simulator page, so the championship payload is shared and never
    // confused with the relational standings.
    queryKey: ['championship', currentYear],
    queryFn: async () => {
      // Championship endpoint includes session_results needed for real
      // per-race progression; standings endpoint (SQLite) does not.
      return await fetchChampionship(currentYear);
    },
  });

  const drivers: CompareDriver[] = useMemo(() => {
    if (!data?.drivers) return [];
    return data.drivers.map((d, index) => {
      const id = d.id || (d.name ? d.name.toLowerCase().replace(/\s+/g, '_') : `driver_${index}`);
      const team = d.team || 'Unknown';
      const color = teamColors[team] || d.teamColor || '#EF4444';
      return {
        id,
        name: d.name || '-',
        team,
        teamId: (d as { team_id?: string }).team_id || team.toLowerCase().replace(/\s+/g, '_'),
        position: toNumber(d.position) || index + 1,
        points: toNumber(d.points),
        wins: toNumber(d.wins),
        podiums: toNumber(d.podiums),
        dnfs: toNumber(d.dnfs),
        dnss: toNumber(d.dnss),
        pointsLastRace: toNumber(d.points_last_race),
        abbreviation: d.abbreviation || d.code || '',
        driverNumber: d.driver_number || d.number,
        color,
      };
    });
  }, [data]);

  const [driver1Id, setDriver1Id] = useState<string>('');
  const [driver2Id, setDriver2Id] = useState<string>('');

  useEffect(() => {
    if (drivers.length < 2) return;

    const p1 = searchParams.get('d1');
    const p2 = searchParams.get('d2');

    const validIds = new Set(drivers.map((d) => d.id));

    const defaultD1 = p1 && validIds.has(p1) ? p1 : drivers[0]?.id || '';
    let defaultD2 = p2 && validIds.has(p2) ? p2 : drivers[1]?.id || '';

    if (defaultD1 === defaultD2 && drivers.length > 1) {
      defaultD2 = drivers.find((d) => d.id !== defaultD1)?.id || drivers[1]?.id || '';
    }

    setDriver1Id(defaultD1);
    setDriver2Id(defaultD2);
  }, [drivers, searchParams]);

  const handleSelectDriver1 = (id: string) => {
    setDriver1Id(id);
    setSearchParams({ d1: id, d2: driver2Id });
  };

  const handleSelectDriver2 = (id: string) => {
    setDriver2Id(id);
    setSearchParams({ d1: driver1Id, d2: id });
  };

  const handleSwapDrivers = () => {
    setDriver1Id(driver2Id);
    setDriver2Id(driver1Id);
    setSearchParams({ d1: driver2Id, d2: driver1Id });
  };

  const driver1 = useMemo(() => drivers.find((d) => d.id === driver1Id), [drivers, driver1Id]);
  const driver2 = useMemo(() => drivers.find((d) => d.id === driver2Id), [drivers, driver2Id]);

  // Full driver profiles power the Pole/Best/Avg metrics and guarantee the
  // DNF/DNS numbers are byte-identical with the driver profile pages and
  // /stats (same endpoint, same Sprint-aware predicates). Failures are
  // tolerated: the championship values remain as fallback.
  const { data: profile1 } = useQuery<DriverProfilePayload>({
    queryKey: ['driverProfile', currentYear, driver1Id],
    queryFn: () => fetchDriverProfile(currentYear, driver1Id),
    enabled: !!driver1Id,
  });
  const { data: profile2 } = useQuery<DriverProfilePayload>({
    queryKey: ['driverProfile', currentYear, driver2Id],
    queryFn: () => fetchDriverProfile(currentYear, driver2Id),
    enabled: !!driver2Id,
  });

  // Teammate color collision logic
  let d1Color = driver1?.color || '#EF4444';
  let d2Color = driver2?.color || '#3B82F6';
  if (driver1 && driver2 && driver1.team === driver2.team) {
    d1Color = teamColors[driver1.team] || '#EF4444';
    d2Color = '#FACC15'; // Yellow/gold for teammate distinction
  }

  const metrics: StatMetric[] = useMemo(() => {
    if (!driver1 || !driver2) return [];
    // Sprint-aware incident counts (Grand Prix + Sprint), exactly the values
    // DriverProfilePage and /stats render.
    const d1Dnfs = incidentCount(profile1, driver1.dnfs, 'dnfs');
    const d2Dnfs = incidentCount(profile2, driver2.dnfs, 'dnfs');
    const d1Dnss = incidentCount(profile1, driver1.dnss, 'dnss');
    const d2Dnss = incidentCount(profile2, driver2.dnss, 'dnss');
    return [
      {
        key: 'points',
        label: 'Championship Points',
        val1: driver1.points,
        val2: driver2.points,
        unit: ' PTS',
        icon: Star,
      },
      {
        key: 'wins',
        label: 'Race Wins',
        val1: driver1.wins,
        val2: driver2.wins,
        icon: Trophy,
      },
      {
        key: 'podiums',
        label: 'Podium Finishes',
        val1: driver1.podiums,
        val2: driver2.podiums,
        icon: Medal,
      },
      {
        key: 'poles',
        label: 'Pole Positions',
        val1: toNumber(profile1?.poles),
        val2: toNumber(profile2?.poles),
        icon: Crosshair,
      },
      {
        key: 'best',
        label: 'Best Finish',
        val1: toNumber(profile1?.best_finish),
        val2: toNumber(profile2?.best_finish),
        invert: true,
        icon: Crown,
        format: (v) => (v > 0 ? `P${v}` : '-'),
      },
      {
        key: 'avg',
        label: 'Average Finish',
        val1: toNumber(profile1?.avg_finish),
        val2: toNumber(profile2?.avg_finish),
        invert: true,
        icon: Gauge,
        format: (v) => (v > 0 ? `P${v}` : '-'),
      },
      {
        key: 'dnfs',
        label: 'Did Not Finish (DNFs)',
        val1: d1Dnfs,
        val2: d2Dnfs,
        invert: true,
        icon: AlertTriangle,
      },
      {
        key: 'dnss',
        label: 'Did Not Start (DNSs)',
        val1: d1Dnss,
        val2: d2Dnss,
        invert: true,
        icon: Ban,
      },
      {
        key: 'pointsLastRace',
        label: 'Last GP Points',
        val1: driver1.pointsLastRace,
        val2: driver2.pointsLastRace,
        unit: ' PTS',
        icon: Flame,
      },
      {
        key: 'position',
        label: 'Standing Position',
        val1: driver1.position,
        val2: driver2.position,
        invert: true,
        icon: Crown,
      },
    ];
  }, [driver1, driver2, profile1, profile2]);

  const mergedProgression: MergedProgressionRow[] = useMemo(() => {
    const sessionResults = data?.session_results;
    if (!driver1 || !driver2 || !sessionResults) return [];

    // Build real per-round progression from the championship session_results.
    // Grand Prix and Sprint rows are merged per round so Sprint points are
    // included (R17 Singapore: a race DNF can still carry sprint points) and
    // the cumulative totals match the official championship figures.
    type Entry = (typeof sessionResults)[number];

    const isPointsSession = (t: unknown) => t === 'R' || t === 'Sprint';
    const d1Results = sessionResults.filter(
      (r) => isPointsSession(r.SessionType) && rowMatchesDriver(r, driver1)
    );
    const d2Results = sessionResults.filter(
      (r) => isPointsSession(r.SessionType) && rowMatchesDriver(r, driver2)
    );

    const byRound = (rows: Entry[]) => {
      const map = new Map<number, { race?: Entry; sprint?: Entry }>();
      for (const r of rows) {
        if (typeof r.RoundNumber !== 'number') continue;
        const slot = map.get(r.RoundNumber) ?? {};
        if (r.SessionType === 'Sprint') slot.sprint = r;
        else slot.race = r;
        map.set(r.RoundNumber, slot);
      }
      return map;
    };

    const d1ByRound = byRound(d1Results);
    const d2ByRound = byRound(d2Results);

    const roundsSet = new Set<number>();
    for (const r of [...d1Results, ...d2Results]) {
      if (typeof r.RoundNumber === 'number') roundsSet.add(r.RoundNumber);
    }
    const rounds = [...roundsSet].sort((a, b) => a - b);

    // Never surface the legacy 99 "missing position" sentinel as P99; a
    // retired/absent driver shows the real DNF/DNS label instead (DNS takes
    // precedence, mirroring the backend predicates).
    const resultLabel = (row?: Entry): number | string => {
      if (!row) return '--';
      const status = String((row as { Status?: unknown }).Status ?? '').toLowerCase();
      if (status.includes('did not start') || status.includes('dns')) return 'DNS';
      const classified = String((row as { ClassifiedPosition?: unknown }).ClassifiedPosition ?? '');
      if (['R', 'D', 'E', 'W'].includes(classified)) return 'DNF';
      const pos = (row as { Position?: unknown }).Position;
      return typeof pos === 'number' ? (pos < 90 ? pos : '--') : pos != null ? String(pos) : '--';
    };

    const trajectory: MergedProgressionRow[] = [];
    let d1Cum = 0;
    let d2Cum = 0;

    for (const round of rounds) {
      const d1 = d1ByRound.get(round) ?? {};
      const d2 = d2ByRound.get(round) ?? {};

      const d1Pts = (Number(d1.race?.Points) || 0) + (Number(d1.sprint?.Points) || 0);
      const d2Pts = (Number(d2.race?.Points) || 0) + (Number(d2.sprint?.Points) || 0);

      d1Cum += d1Pts;
      d2Cum += d2Pts;

      const d1Pos = resultLabel(d1.race);
      const d2Pos = resultLabel(d2.race);

      const num1 = typeof d1Pos === 'number' ? d1Pos : 999;
      const num2 = typeof d2Pos === 'number' ? d2Pos : 999;
      const winner = num1 < num2 ? driver1.name : num2 < num1 ? driver2.name : null;

      const raceInfo = d1.race ?? d2.race ?? d1.sprint ?? d2.sprint;
      trajectory.push({
        round,
        race_name: (raceInfo?.EventName as string) || `Round ${round}`,
        location: (raceInfo?.Location as string) || '',
        d1_points: d1Pts,
        d1_cum: d1Cum,
        d1_pos: d1Pos,
        d1_sprint_pos: d1.sprint ? resultLabel(d1.sprint) : null,
        d1_sprint_points: Number(d1.sprint?.Points) || 0,
        d2_points: d2Pts,
        d2_cum: d2Cum,
        d2_pos: d2Pos,
        d2_sprint_pos: d2.sprint ? resultLabel(d2.sprint) : null,
        d2_sprint_points: Number(d2.sprint?.Points) || 0,
        winner,
      });
    }

    return trajectory;
  }, [driver1, driver2, data?.session_results]);

  // The centre badge is the race-by-race head-to-head record (R1..R17
  // winners from the battle log), not a count of the metric bars above —
  // that is what "Race H2H" promises, and it stays consistent with WINS and
  // the DriverProfilePage results.
  const h2hScore = useMemo(() => {
    let score1 = 0;
    let score2 = 0;
    for (const row of mergedProgression) {
      if (driver1 && row.winner === driver1.name) score1 += 1;
      else if (driver2 && row.winner === driver2.name) score2 += 1;
    }

    let leader: 'd1' | 'd2' | 'tied' = 'tied';
    if (score1 > score2) leader = 'd1';
    else if (score2 > score1) leader = 'd2';

    return { score1, score2, leader };
  }, [mergedProgression, driver1, driver2]);

  const handleExportPNG = async () => {
    const el = document.getElementById('h2h-card');
    if (!el) return;
    try {
      const canvas = await html2canvas(el, { backgroundColor: '#0a0a0a', scale: 2 });
      const image = canvas.toDataURL('image/png');
      const link = document.createElement('a');
      link.href = image;
      link.download = `H2H_${driver1?.name}_vs_${driver2?.name}.png`;
      link.click();
    } catch (err: unknown) {
      console.error('Export failed', err);
    }
  };

  const tabs = [
    { key: 'overview', label: 'OVERVIEW', icon: BarChart3 },
    { key: 'chart', label: 'POINTS CHART', icon: TrendingUp },
    { key: 'h2h', label: 'RACE H2H', icon: Swords },
  ];

  return (
    <div className="bg-[#0a0a0a] min-h-screen text-white font-sans relative selection:bg-red-500 selection:text-white">
      <div className="fixed inset-0 xl:left-72 bg-[radial-gradient(#1f2937_1px,transparent_1px)] [background-size:24px_24px] opacity-15 pointer-events-none" />
      <div className="fixed inset-0 xl:left-72 bg-gradient-to-b from-red-950/20 via-neutral-950/95 to-neutral-950 pointer-events-none" />

      {driver1 && (
        <div
          className="fixed top-20 left-10 xl:left-80 w-96 h-96 blur-[150px] opacity-25 rounded-full pointer-events-none transition-all duration-700"
          style={{ backgroundColor: d1Color }}
        />
      )}
      {driver2 && (
        <div
          className="fixed top-20 right-10 w-96 h-96 blur-[150px] opacity-25 rounded-full pointer-events-none transition-all duration-700"
          style={{ backgroundColor: d2Color }}
        />
      )}

      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-10 py-6 md:py-8 xl:py-10 relative z-10">
        <header className="mb-8">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-neutral-800/80 pb-6">
            <div>
              <div className="flex items-center gap-2 mb-2 font-mono text-[11px] text-neutral-400">
                <span className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-neutral-900 border border-neutral-800 text-neutral-300">
                  <Database size={12} className="text-red-500" />
                  SQLITE TELEMETRY COMPARATOR
                </span>
                <span className="flex items-center gap-1 px-2 py-1 rounded-md bg-neutral-900/60 border border-neutral-800/80 text-cyan-400">
                  <Zap size={12} className="animate-pulse" />
                  HEAD-TO-HEAD DUEL
                </span>
              </div>
              <h1 className="text-3xl md:text-5xl font-black tracking-tight uppercase italic flex items-center gap-3">
                <Swords className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" size={38} />
                Driver <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Comparison</span>
              </h1>
              <p className="text-neutral-400 mt-1 text-xs md:text-sm font-medium">
                Direct head-to-head performance telemetry & championship statistics comparison.
              </p>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleSwapDrivers}
                className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-200 border border-neutral-800 hover:border-neutral-700 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all shadow-lg hover:-translate-y-0.5"
                title="Swap Drivers"
              >
                <ArrowLeftRight size={14} className="text-red-400" /> Swap Positions
              </button>
              <Link
                to="/stats"
                className="flex items-center gap-2 px-4 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-neutral-300 hover:text-white border border-neutral-800 rounded-xl text-xs font-mono font-bold uppercase tracking-wider transition-all"
              >
                <Trophy size={14} className="text-yellow-500" /> Full Standings
              </Link>
            </div>
          </div>
        </header>

        {isLoading && (
          <div className="space-y-6 animate-pulse">
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <div className="h-64 bg-neutral-900/40 border border-neutral-800 rounded-2xl" />
              <div className="h-64 bg-neutral-900/40 border border-neutral-800 rounded-2xl" />
            </div>
            <div className="h-48 bg-neutral-900/40 border border-neutral-800 rounded-2xl" />
          </div>
        )}

        {error && (
          <div className="bg-red-950/40 border border-red-500/50 rounded-2xl p-8 text-center max-w-lg mx-auto mb-8 shadow-xl">
            <AlertTriangle className="text-red-500 mx-auto mb-4" size={36} />
            <h3 className="font-bold text-red-400 text-lg uppercase tracking-wider">
              Failed to load comparison data
            </h3>
            <p className="text-neutral-400 text-xs mt-2">{error.message}</p>
          </div>
        )}

        {!isLoading && driver1 && driver2 && (
          <div className="space-y-8">
            <div className="relative z-30 bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-5 md:p-6 shadow-2xl mb-8">
              <div className="flex flex-col md:flex-row items-center justify-between gap-4">
                <div className="w-full md:w-5/12">
                  <DriverSelector
                    label="Driver 1"
                    selectedId={driver1.id}
                    otherSelectedId={driver2.id}
                    drivers={drivers}
                    onSelect={handleSelectDriver1}
                    accentColor={d1Color}
                  />
                </div>

                <button
                  onClick={handleSwapDrivers}
                  title="Swap Drivers"
                  className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-neutral-800 to-neutral-900 hover:from-neutral-700 hover:to-neutral-800 border border-neutral-700 hover:border-neutral-500 flex items-center justify-center text-white transition-all hover:scale-110 active:scale-95 flex-shrink-0 shadow-lg hover:shadow-xl group"
                >
                  <ArrowLeftRight size={20} className="group-hover:rotate-180 transition-transform duration-300" />
                </button>

                <div className="w-full md:w-5/12">
                  <DriverSelector
                    label="Driver 2"
                    selectedId={driver2.id}
                    otherSelectedId={driver1.id}
                    drivers={drivers}
                    onSelect={handleSelectDriver2}
                    accentColor={d2Color}
                  />
                </div>
              </div>

              {driver1.team === driver2.team && (
                <div className="mt-4 flex items-center gap-2 text-xs text-amber-400 bg-amber-500/10 border border-amber-500/20 px-3 py-2 rounded-xl">
                  <Users size={14} /> Teammate battle! Both drivers race for <span className="font-bold">{driver1.team}</span>
                </div>
              )}
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-11 gap-4 items-stretch">
              <div
                className="xl:col-span-5 bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden group"
                style={{ borderLeftWidth: '6px', borderLeftColor: d1Color }}
              >
                <div className="absolute right-4 -bottom-6 text-[8rem] font-black opacity-[0.04] pointer-events-none select-none font-mono leading-none" style={{ color: d1Color }}>
                  {driver1.driverNumber}
                </div>
                <div className="absolute -right-10 -top-10 w-32 h-32 rounded-full blur-[60px] opacity-10 pointer-events-none" style={{ backgroundColor: d1Color }} />

                <div className="flex items-center gap-3 mb-3">
                  {teamLogos[driver1.team] && <img src={teamLogos[driver1.team]} alt={driver1.team} className="h-5 w-auto object-contain opacity-70" />}
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">{driver1.team}</span>
                  <span className="font-mono text-xs font-bold bg-neutral-800 px-2 py-0.5 rounded text-neutral-300 flex items-center gap-1">
                    <Hash size={10} />{driver1.driverNumber}
                  </span>
                </div>
                <Link to={`/driver/${driver1.id}`} className="block group-hover:text-red-400 transition-colors">
                  <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{driver1.name}</h2>
                </Link>
                <div className="mt-5 flex flex-wrap items-center gap-3">
                  <div className="bg-neutral-950/80 border border-neutral-800 px-4 py-2.5 rounded-2xl">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold flex items-center gap-1"><Shield size={10} /> Championship</span>
                    <span className="text-2xl font-black font-mono text-white">P{driver1.position}</span>
                  </div>
                  <div className="bg-neutral-950/80 border border-neutral-800 px-4 py-2.5 rounded-2xl">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold flex items-center gap-1"><Star size={10} /> Points</span>
                    <span className="text-2xl font-black font-mono" style={{ color: d1Color }}>{driver1.points}</span>
                  </div>
                  <div className="bg-neutral-950/80 border border-neutral-800 px-4 py-2.5 rounded-2xl">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold flex items-center gap-1"><Trophy size={10} /> Wins</span>
                    <span className="text-2xl font-black font-mono text-white">{driver1.wins}</span>
                  </div>
                </div>
              </div>

              <div className="xl:col-span-1 flex flex-col items-center justify-center text-center py-2">
                <div className="w-14 h-14 rounded-full bg-gradient-to-tr from-red-600 to-orange-500 font-black text-white flex items-center justify-center shadow-lg shadow-red-600/30 text-base font-mono tracking-tighter relative">
                  <Swords size={22} />
                  <div className="absolute inset-0 rounded-full bg-red-500/20 animate-ping" />
                </div>
                <div className="mt-3 text-center">
                  <span className="text-[10px] uppercase font-bold text-neutral-500 tracking-wider block">Race H2H</span>
                  <div
                    className="font-mono font-black text-base mt-0.5 flex items-center gap-1 justify-center"
                    aria-label={`Race H2H ${h2hScore.score1} - ${h2hScore.score2}`}
                  >
                    <span style={{ color: d1Color }}>{h2hScore.score1}</span>
                    <Minus size={12} className="text-neutral-600" />
                    <span style={{ color: d2Color }}>{h2hScore.score2}</span>
                  </div>
                </div>
              </div>

              <div
                className="xl:col-span-5 bg-gradient-to-br from-neutral-900 to-neutral-950 border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl relative overflow-hidden group text-right xl:text-left"
                style={{ borderRightWidth: '6px', borderRightColor: d2Color }}
              >
                <div className="absolute left-4 -bottom-6 text-[8rem] font-black opacity-[0.04] pointer-events-none select-none font-mono leading-none" style={{ color: d2Color }}>
                  {driver2.driverNumber}
                </div>
                <div className="absolute -left-10 -top-10 w-32 h-32 rounded-full blur-[60px] opacity-10 pointer-events-none" style={{ backgroundColor: d2Color }} />

                <div className="flex items-center gap-3 mb-3 justify-end xl:justify-start">
                  {teamLogos[driver2.team] && <img src={teamLogos[driver2.team]} alt={driver2.team} className="h-5 w-auto object-contain opacity-70" />}
                  <span className="text-xs font-bold uppercase tracking-wider text-neutral-400">{driver2.team}</span>
                  <span className="font-mono text-xs font-bold bg-neutral-800 px-2 py-0.5 rounded text-neutral-300 flex items-center gap-1">
                    <Hash size={10} />{driver2.driverNumber}
                  </span>
                </div>
                <Link to={`/driver/${driver2.id}`} className="block group-hover:text-red-400 transition-colors">
                  <h2 className="text-3xl sm:text-4xl font-black text-white tracking-tight">{driver2.name}</h2>
                </Link>
                <div className="mt-5 flex flex-wrap items-center gap-3 justify-end xl:justify-start">
                  <div className="bg-neutral-950/80 border border-neutral-800 px-4 py-2.5 rounded-2xl">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold flex items-center gap-1"><Shield size={10} /> Championship</span>
                    <span className="text-2xl font-black font-mono text-white">P{driver2.position}</span>
                  </div>
                  <div className="bg-neutral-950/80 border border-neutral-800 px-4 py-2.5 rounded-2xl">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold flex items-center gap-1"><Star size={10} /> Points</span>
                    <span className="text-2xl font-black font-mono" style={{ color: d2Color }}>{driver2.points}</span>
                  </div>
                  <div className="bg-neutral-950/80 border border-neutral-800 px-4 py-2.5 rounded-2xl">
                    <span className="text-[10px] text-neutral-500 uppercase font-bold flex items-center gap-1"><Trophy size={10} /> Wins</span>
                    <span className="text-2xl font-black font-mono text-white">{driver2.wins}</span>
                  </div>
                </div>
              </div>
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div className="flex flex-wrap gap-2">
                {tabs.map((t) => (
                  <button
                    key={t.key}
                    onClick={() => setActiveTab(t.key)}
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold uppercase tracking-wider transition-all duration-200 ${
                      activeTab === t.key
                        ? 'bg-red-600/90 text-white shadow-[0_0_15px_rgba(220,38,38,0.3)] border border-red-500'
                        : 'bg-neutral-900/60 text-neutral-400 hover:text-white hover:bg-neutral-800 border border-neutral-800 hover:border-neutral-600'
                    }`}
                  >
                    <t.icon size={14} />
                    {t.label}
                  </button>
                ))}
              </div>
              <button
                onClick={handleExportPNG}
                className="flex items-center gap-2 bg-neutral-800 hover:bg-neutral-700 text-white text-xs font-bold py-2.5 px-4 rounded-xl transition-all shadow-md hover:shadow-lg border border-neutral-700 hover:border-neutral-600 uppercase tracking-wider"
              >
                <Download size={14} /> Export PNG
              </button>
            </div>

            <div id="h2h-card" className="space-y-6 p-4 md:p-6 bg-neutral-950/90 rounded-3xl">
              {activeTab === 'overview' && (
                <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                    <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                      <Scale size={20} className="text-cyan-400" />
                      Performance Comparison
                    </h3>
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <span className="flex items-center gap-1.5"><CircleDot size={10} style={{ color: d1Color }} /> {driver1.name}</span>
                      <span className="flex items-center gap-1.5"><CircleDot size={10} style={{ color: d2Color }} /> {driver2.name}</span>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
                    <div className="w-full">
                      <DriverRadarChart
                        profile1={{
                          name: driver1.name,
                          team: driver1.team,
                          points: driver1.points,
                          poles: toNumber(profile1?.poles),
                          wins: driver1.wins,
                          podiums: driver1.podiums,
                          dnfs: incidentCount(profile1, driver1.dnfs, 'dnfs'),
                          avg_finish: profile1?.avg_finish ?? driver1.position,
                          teammate: profile1?.teammate ?? null,
                        }}
                        profile2={{
                          name: driver2.name,
                          team: driver2.team,
                          points: driver2.points,
                          poles: toNumber(profile2?.poles),
                          wins: driver2.wins,
                          podiums: driver2.podiums,
                          dnfs: incidentCount(profile2, driver2.dnfs, 'dnfs'),
                          avg_finish: profile2?.avg_finish ?? driver2.position,
                          teammate: profile2?.teammate ?? null,
                        }}
                        color1={d1Color}
                        color2={d2Color}
                      />
                    </div>

                    <div className="space-y-4">
                      {metrics.map((m) => (
                        <ComparativeMetricBar key={m.key} metric={m} driver1={driver1} driver2={driver2} />
                      ))}
                    </div>
                  </div>
                </section>
              )}

              {activeTab === 'chart' && (
                <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between mb-6 gap-3">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                        <TrendingUp size={20} className="text-emerald-400" />
                        Points Trajectory Duel
                      </h3>
                      <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5">
                        <Sparkles size={12} className="text-neutral-500" /> Round-by-round cumulative championship points
                      </p>
                    </div>
                    <div className="flex items-center gap-4 text-xs font-bold">
                      <span className="flex items-center gap-1.5"><CircleDot size={10} style={{ color: d1Color }} /> {driver1.name}</span>
                      <span className="flex items-center gap-1.5"><CircleDot size={10} style={{ color: d2Color }} /> {driver2.name}</span>
                    </div>
                  </div>

                  <div className="h-[360px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <AreaChart data={mergedProgression} margin={{ top: 10, right: 20, left: 0, bottom: 5 }}>
                        <defs>
                          <linearGradient id="colorD1" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={d1Color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={d1Color} stopOpacity={0} />
                          </linearGradient>
                          <linearGradient id="colorD2" x1="0" y1="0" x2="0" y2="1">
                            <stop offset="5%" stopColor={d2Color} stopOpacity={0.3} />
                            <stop offset="95%" stopColor={d2Color} stopOpacity={0} />
                          </linearGradient>
                        </defs>
                        <CartesianGrid strokeDasharray="3 3" stroke="#262626" vertical={false} />
                        <XAxis dataKey="location" stroke="#666" tick={{ fill: '#888', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <YAxis stroke="#666" tick={{ fill: '#888', fontSize: 11 }} tickLine={false} axisLine={false} />
                        <RechartsTooltip
                          contentStyle={{ backgroundColor: 'rgba(15,15,15,0.95)', border: '1px solid #333', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                          formatter={(val) => [`${val} PTS`, 'Points']}
                          labelFormatter={(loc) => loc}
                        />
                        <Area type="monotone" dataKey="d1_cum" name={driver1.name} stroke={d1Color} strokeWidth={3} fill="url(#colorD1)" dot={{ r: 4, fill: d1Color, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
                        <Area type="monotone" dataKey="d2_cum" name={driver2.name} stroke={d2Color} strokeWidth={3} fill="url(#colorD2)" dot={{ r: 4, fill: d2Color, strokeWidth: 0 }} activeDot={{ r: 6, strokeWidth: 2, stroke: '#fff' }} />
                      </AreaChart>
                    </ResponsiveContainer>
                  </div>
                </section>
              )}

              {activeTab === 'h2h' && (
                <section className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl overflow-hidden shadow-2xl">
                  <div className="p-6 border-b border-neutral-800 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                    <div>
                      <h3 className="text-xl font-black tracking-tight text-white flex items-center gap-2">
                        <Flag size={20} className="text-red-500" />
                        Grand Prix Battle Log
                      </h3>
                      <p className="text-xs text-neutral-400 mt-1 flex items-center gap-1.5">
                        <Gauge size={12} className="text-neutral-500" /> Race-by-race head-to-head finishes
                      </p>
                    </div>
                  </div>
                  <div className="p-6 space-y-3">
                    {mergedProgression.length > 0 ? (
                      <div className="space-y-3">
                        {mergedProgression.map((race) => {
                          // `winner` is computed numerically in the memo (a
                          // finisher beats a DNF/DNS; both retired = draw).
                          const d1Ahead = race.winner === driver1?.name;
                          const d2Ahead = race.winner === driver2?.name;
                          const tie = !race.winner;

                          return (
                            <div
                              key={race.round}
                              className="bg-neutral-950/80 border border-neutral-800/60 rounded-xl p-4 hover:border-neutral-700 transition-colors"
                            >
                              <div className="flex items-center justify-between mb-3">
                                <div className="flex items-center gap-3">
                                  <div className="bg-neutral-800/60 text-neutral-400 text-xs font-black px-2.5 py-1 rounded-md">
                                    R{race.round}
                                  </div>
                                  <div>
                                    <div className="text-white font-bold text-sm">{race.race_name}</div>
                                    <div className="text-neutral-500 text-xs">{race.location}</div>
                                  </div>
                                </div>
                                {!tie && (
                                  <div className="text-xs font-bold uppercase tracking-wider text-emerald-400">
                                    {d1Ahead ? driver1?.name.split(' ').pop() : driver2?.name.split(' ').pop()} WINS
                                  </div>
                                )}
                              </div>

                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                <div
                                  className="relative bg-neutral-900/40 rounded-lg p-3 border-l-4"
                                  style={{
                                    borderLeftColor: d1Color,
                                    backgroundColor: d1Ahead ? `${d1Color}15` : 'rgb(23 23 23 / 0.4)',
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm"
                                        style={{
                                          backgroundColor: `${d1Color}20`,
                                          color: d1Color,
                                          border: `1px solid ${d1Color}40`,
                                        }}
                                      >
                                        {typeof race.d1_pos === 'number' ? `P${race.d1_pos}` : race.d1_pos}
                                      </div>
                                      <div>
                                        <div className="text-white text-xs font-bold">
                                          {driver1?.name.split(' ').pop()}
                                        </div>
                                        <div className="text-neutral-500 text-[10px] font-mono">
                                          +{race.d1_points} pts
                                        </div>
                                        {race.d1_sprint_pos != null && (
                                          <div className="text-orange-400 text-[9px] font-mono font-bold mt-0.5">
                                            SPRINT {typeof race.d1_sprint_pos === 'number' ? `P${race.d1_sprint_pos}` : race.d1_sprint_pos}
                                            {race.d1_sprint_points > 0 ? ` (+${race.d1_sprint_points})` : ''}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {d1Ahead && (
                                      <Trophy size={14} className="text-yellow-400" />
                                    )}
                                  </div>
                                </div>

                                <div
                                  className="relative bg-neutral-900/40 rounded-lg p-3 border-l-4"
                                  style={{
                                    borderLeftColor: d2Color,
                                    backgroundColor: d2Ahead ? `${d2Color}15` : 'rgb(23 23 23 / 0.4)',
                                  }}
                                >
                                  <div className="flex items-center justify-between">
                                    <div className="flex items-center gap-2">
                                      <div
                                        className="w-8 h-8 rounded-lg flex items-center justify-center font-black text-sm"
                                        style={{
                                          backgroundColor: `${d2Color}20`,
                                          color: d2Color,
                                          border: `1px solid ${d2Color}40`,
                                        }}
                                      >
                                        {typeof race.d2_pos === 'number' ? `P${race.d2_pos}` : race.d2_pos}
                                      </div>
                                      <div>
                                        <div className="text-white text-xs font-bold">
                                          {driver2?.name.split(' ').pop()}
                                        </div>
                                        <div className="text-neutral-500 text-[10px] font-mono">
                                          +{race.d2_points} pts
                                        </div>
                                        {race.d2_sprint_pos != null && (
                                          <div className="text-orange-400 text-[9px] font-mono font-bold mt-0.5">
                                            SPRINT {typeof race.d2_sprint_pos === 'number' ? `P${race.d2_sprint_pos}` : race.d2_sprint_pos}
                                            {race.d2_sprint_points > 0 ? ` (+${race.d2_sprint_points})` : ''}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                    {d2Ahead && (
                                      <Trophy size={14} className="text-yellow-400" />
                                    )}
                                  </div>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <p className="text-neutral-400 text-sm text-center py-6">
                        {driver1 && driver2
                          ? 'No race results are available for this pairing yet.'
                          : 'Select two drivers to see their head-to-head battle history.'}
                      </p>
                    )}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
};

export default ComparePage;
