// src/RaceDetailPage - FIXED: shared teamData & config, improved error state

import { useState, useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import ErrorState from '../components/layout/ErrorState';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Trophy, Calendar, Activity, TrendingUp, Wrench, Route, Gauge, Sun, List, LayoutGrid, Timer, Flag, Clock, ChevronDown } from 'lucide-react';
import { API_URL } from '../config';
import TelemetryTab from '../components/ui/TelemetryTab';
import { TrackMap } from '../components/ui/TrackMap';

// =======================================================================

import LapChartComponent from '../components/race/LapChart';
import GapChartComponent from '../components/race/GapChart';
import LapTimesChartComponent from '../components/race/LapTimesChart';
import RaceControlMessages from '../components/race/RaceControlMessages';
import { PracticeResultTable, QualifyingResultTable, SprintQualifyingResultTable, SprintResultTable, RaceResultTable, GridTable, TyreStrategyTable, SpeedSectorsTable, WeatherChart } from '../components/race/RaceTables';
import { type SummaryCardData } from '../components/race/RaceMiniComponents';
import type { Race, SessionResultRow, SectorMatrixEntry } from '../types/f1';


// --- KOMPONEN UTAMA HALAMAN DETAIL BALAPAN ---
// =======================================================================

const getTabIcon = (tab: string, isActive: boolean) => {
  const props = { size: 16, className: isActive ? 'text-white' : 'text-neutral-300 group-hover:text-white transition-colors' };
  switch (tab) {
    case 'Race': return <Trophy {...props} />;
    case 'Lap Telemetry': return <Timer {...props} />;
    case 'Race Progression': return <TrendingUp {...props} />;
    case 'Tyre Strategy': return <Wrench {...props} />;
    case 'Speed & Sectors': return <Gauge {...props} />;
    case 'Weather Data': return <Sun {...props} />;
    case 'Live Feed': return <Activity {...props} />;
    case 'Practice 1':
    case 'Practice 2':
    case 'Practice 3': return <Activity {...props} />;
    case 'Qualifying':
    case 'Sprint Qualifying': return <Timer {...props} />;
    case 'Starting Grid':
    case 'Sprint Grid': return <LayoutGrid {...props} />;
    case 'Sprint': return <Flag {...props} />;
    case 'Lap Chart': return <Route {...props} />;
    case 'Lap Times': return <Timer {...props} />;
    default: return <List {...props} />;
  }
};

const ALL_POSSIBLE_TABS = [
  'Practice 1', 'Practice 2', 'Practice 3',
  'Sprint Qualifying', 'Sprint Grid', 'Sprint',
  'Qualifying', 'Starting Grid', 'Race', 'Lap Chart',
  'Race Progression', 'Lap Times', 'Tyre Strategy', 'Speed & Sectors', 'Weather Data', 'Live Feed',
  'Lap Telemetry'
];

interface ResultWithFastestLap extends SessionResultRow {
  fastest_lap?: { lap_time?: string; lap_number?: number };
  fastest_lap_time?: string;
}

function RaceDetailPage() {
  const { year, round } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('Race');

  const { data, isLoading: loading, isFetching, error, refetch: fetchPageData } = useQuery({
    queryKey: ['raceDetail', year, round],
    queryFn: async () => {
      const [detailsResponse, scheduleResponse] = await Promise.all([
        fetch(`${API_URL}/api/race/${year}/${round}`),
        fetch(`${API_URL}/api/races/${year}`),
      ]);
      if (!detailsResponse.ok) throw new Error('Gagal mengambil detail balapan.');
      if (!scheduleResponse.ok) throw new Error('Gagal mengambil jadwal balapan.');

      const detailsData = await detailsResponse.json();
      const scheduleData = await scheduleResponse.json();
      if (detailsData.error) throw new Error(detailsData.message || detailsData.error);
      
      return { raceData: detailsData, schedule: scheduleData };
    },
    staleTime: 1000 * 60 * 5,
    gcTime: 1000 * 60 * 30,
    refetchOnWindowFocus: true,
    refetchInterval: (query) => {
      const race = query.state.data?.raceData;
      if (race?._cache_state === 'revalidating') {
        return 8000;
      }
      if (race?.status === 'Ongoing') {
        return 30000;
      }
      return false;
    }
  });

  const raceData = data?.raceData || null;
  const schedule = data?.schedule || [];

  // Compute available tabs early so keyboard nav can reference them
  const baseAvailableTabs = useMemo(() =>
    ALL_POSSIBLE_TABS.filter(tab => raceData?.available_tabs?.includes(tab)),
    [raceData?.available_tabs]
  );

  const availableTabs = useMemo(() => {
    const tabs = [...baseAvailableTabs];
    if (raceData?.lap_chart && !tabs.includes('Lap Chart')) tabs.push('Lap Chart');
    if (raceData?.gap_chart && !tabs.includes('Race Progression')) tabs.push('Race Progression');
    if (raceData?.lap_times_chart && !tabs.includes('Lap Times')) tabs.push('Lap Times');
    if (raceData?.tyre_strategy && !tabs.includes('Tyre Strategy')) tabs.push('Tyre Strategy');
    if ((raceData?.speed_traps || raceData?.sector_matrix) && !tabs.includes('Speed & Sectors')) tabs.push('Speed & Sectors');
    if (raceData?.weather_info && raceData.weather_info.length > 0 && !tabs.includes('Weather Data')) tabs.push('Weather Data');
    if (raceData?.race_control_messages && raceData.race_control_messages.length > 0 && !tabs.includes('Live Feed')) tabs.push('Live Feed');
    if (!tabs.includes('Lap Telemetry')) tabs.push('Lap Telemetry');
    return tabs;
  }, [baseAvailableTabs, raceData]);

  useEffect(() => {
    if (raceData) {
      const available = raceData.available_tabs || [];
      if (available.includes('Race')) {
        setActiveTab('Race');
      } else {
        const sessionCandidates = ['Practice 1', 'Practice 2', 'Practice 3', 'Sprint Qualifying', 'Sprint Grid', 'Sprint', 'Qualifying', 'Starting Grid', 'Race'];
        const availableSessionTabs = sessionCandidates.filter(t => available.includes(t));
        if (availableSessionTabs.length > 0) {
          setActiveTab(availableSessionTabs[availableSessionTabs.length - 1]);
        } else if (available.length > 0) {
          setActiveTab(available[0]);
        }
      }
    }
  }, [raceData]);

  const handleRaceChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    navigate(`/race/${year}/${event.target.value}`);
  };

  // Keyboard navigation: arrow keys cycle through tabs
  useEffect(() => {
    const handler = (e: globalThis.KeyboardEvent) => {
      if (!availableTabs || availableTabs.length === 0) return;
      const currentIndex = availableTabs.indexOf(activeTab);
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        const nextIndex = (currentIndex + 1) % availableTabs.length;
        setActiveTab(availableTabs[nextIndex]);
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + availableTabs.length) % availableTabs.length;
        setActiveTab(availableTabs[prevIndex]);
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [activeTab, availableTabs]);

  const SESSION_TAB_NAMES = [
    'Practice 1', 'Practice 2', 'Practice 3',
    'Sprint Qualifying', 'Sprint Grid', 'Sprint',
    'Qualifying', 'Starting Grid', 'Race'
  ];
  const sessionTabs = useMemo(
    () => availableTabs.filter(t => SESSION_TAB_NAMES.includes(t)),
    [availableTabs]
  );
  const telemetryTabs = useMemo(
    () => availableTabs.filter(t => !SESSION_TAB_NAMES.includes(t)),
    [availableTabs]
  );

  const SkeletonLoader = () => (
    <div className="bg-neutral-950 min-h-screen text-white font-sans motion-safe:animate-pulse">
      
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-10 py-6 md:py-8 xl:py-10">
        <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 gap-4">
          <div>
            <div className="h-4 w-40 bg-neutral-800 rounded-sm mb-4"></div>
            <div className="h-12 w-64 md:w-96 bg-neutral-800 rounded-sm"></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 shrink-0">
            <div className="h-10 w-24 bg-neutral-800 rounded-sm"></div>
            <div className="h-10 w-32 bg-neutral-800 rounded-sm"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-lg p-6 h-32">
              <div className="h-4 w-24 bg-neutral-800 rounded-sm mb-4"></div>
              <div className="h-6 w-32 bg-neutral-800 rounded-sm mb-2"></div>
              <div className="h-4 w-48 bg-neutral-800 rounded-sm"></div>
            </div>
          ))}
        </div>
        <div className="h-10 w-full bg-neutral-800 rounded-sm mb-4"></div>
        <div className="h-64 w-full bg-neutral-900 border border-neutral-800 rounded-lg"></div>
        <div className="mt-4 text-center text-neutral-500">
          Fetching comprehensive F1 data… this might take 1-2 minutes if cache is cold.
        </div>
      </main>
    </div>
  );

  if (loading && !data) return <SkeletonLoader />;

  if (error) return <ErrorState message={error.message} onRetry={fetchPageData} />;

  const raceWinnerData = raceData?.race_winner
    ? { ...raceData.race_winner, team_name: raceData.results?.[0]?.team_name }
    : null;
  const poleSitterData = raceData?.pole_position
    ? { ...raceData.pole_position, team_name: raceData.qualifying_results?.find((d: SessionResultRow) => d.full_name === raceData.pole_position.full_name)?.team_name }
    : null;
  const fastestLapData: SummaryCardData | null = (() => {
    // 1. Primary: backend provides fastest_lap directly
    if (raceData?.fastest_lap?.full_name) {
      const rawTime = raceData.fastest_lap.lap_time || raceData.fastest_lap.time;
      return { ...raceData.fastest_lap, time: rawTime, lap_time: rawTime };
    }

    // 2. Fallback: extract best lap from sector_matrix
    if (Array.isArray(raceData?.sector_matrix) && raceData.sector_matrix.length > 0) {
      const validEntries = raceData.sector_matrix.filter(
        (entry: SectorMatrixEntry) => entry.actual_lap && entry.actual_lap !== '-' && entry.actual_lap !== 'N/A'
      );
      if (validEntries.length > 0) {
        const toSeconds = (t: string) => {
          const parts = t.trim().split(':');
          if (parts.length === 2) {
            return parseFloat(parts[0]) * 60 + parseFloat(parts[1]);
          }
          return parseFloat(t) || Infinity;
        };

        const bestEntry = validEntries.reduce((best: SectorMatrixEntry, curr: SectorMatrixEntry) => {
          return toSeconds(curr.actual_lap!) < toSeconds(best.actual_lap!) ? curr : best;
        });

        if (bestEntry && bestEntry.actual_lap) {
          // Resolve full name from results or qualifying if driver abbreviation is used
          const driverLookup = raceData?.results?.find((r: SessionResultRow) => r.abbreviation === bestEntry.driver || r.full_name === bestEntry.driver || r.full_name === bestEntry.full_name);
          return {
            full_name: bestEntry.full_name || driverLookup?.full_name || bestEntry.driver,
            team_name: bestEntry.team_name || driverLookup?.team_name,
            time: bestEntry.actual_lap,
            lap_time: bestEntry.actual_lap,
          };
        }
      }
    }

    // 3. Fallback: extract fastest lap from results array
    if (Array.isArray(raceData?.results)) {
      const driverWithFastest = (raceData.results as ResultWithFastestLap[]).find(
        (r) => r.fastest_lap?.lap_time || r.fastest_lap_time
      );
      if (driverWithFastest) {
        const rawTime = driverWithFastest.fastest_lap?.lap_time || driverWithFastest.fastest_lap_time;
        return {
          full_name: driverWithFastest.full_name,
          team_name: driverWithFastest.team_name,
          time: rawTime,
          lap_time: rawTime,
          lap_number: driverWithFastest.fastest_lap?.lap_number,
        };
      }
    }

    return null;
  })();

  const renderActiveContent = () => {
    if (availableTabs.length === 0 || raceData?.status === 'Upcoming') {
      return (
        <div className="p-12 text-center flex flex-col items-center justify-center">
          <Calendar size={48} className="text-red-500 mb-4 opacity-80" />
          <h3 className="text-2xl font-black text-white mb-2">Upcoming Race Weekend</h3>
          <p className="text-neutral-400 max-w-md text-sm">
            {raceData?.message || "Data sesi dan telemetry untuk balapan ini akan tersedia begitu akhir pekan balapan dimulai dan sesi selesai."}
          </p>
        </div>
      );
    }
    const noData = (session: string) => (
      <div className="p-8 text-center text-neutral-500">Data for {session} is not yet available.</div>
    );
    switch (activeTab) {
      case 'Practice 1':        return raceData?.practice1_results        ? <PracticeResultTable data={raceData.practice1_results} />               : noData('Practice 1');
      case 'Practice 2':        return raceData?.practice2_results        ? <PracticeResultTable data={raceData.practice2_results} />               : noData('Practice 2');
      case 'Practice 3':        return raceData?.practice3_results        ? <PracticeResultTable data={raceData.practice3_results} />               : noData('Practice 3');
      case 'Sprint Qualifying': return raceData?.sprint_qualifying_results ? <SprintQualifyingResultTable data={raceData.sprint_qualifying_results} /> : noData('Sprint Qualifying');
      case 'Sprint Grid':       return raceData?.sprint_grid_results      ? <GridTable data={raceData.sprint_grid_results} />                       : noData('Sprint Grid');
      case 'Sprint':            return raceData?.sprint_results           ? <SprintResultTable data={raceData.sprint_results} />                    : noData('Sprint');
      case 'Qualifying':        return raceData?.qualifying_results       ? <QualifyingResultTable data={raceData.qualifying_results} />            : noData('Qualifying');
      case 'Starting Grid':     return raceData?.starting_grid           ? <GridTable data={raceData.starting_grid} />                             : noData('Starting Grid');
      case 'Race':              return raceData?.results                  ? <RaceResultTable data={raceData.results} />                             : noData('Race');
      case 'Lap Telemetry':     return <TelemetryTab year={year || ''} round={round || ''} raceInfo={raceData?.race_info} />;
      case 'Lap Chart':         return raceData?.lap_chart                ? <LapChartComponent lapChart={raceData.lap_chart} results={raceData.results} /> : noData('Lap Chart');
      case 'Race Progression':  return raceData?.gap_chart                ? <GapChartComponent gapChart={raceData.gap_chart} results={raceData.results} /> : noData('Race Progression');
      case 'Lap Times':         return raceData?.lap_times_chart          ? <LapTimesChartComponent lapTimesChart={raceData.lap_times_chart} results={raceData.results} /> : noData('Lap Times');
      case 'Tyre Strategy':     return raceData?.tyre_strategy            ? <TyreStrategyTable tyreData={raceData.tyre_strategy} />                 : noData('Tyre Strategy');
      case 'Speed & Sectors':   return (raceData?.speed_traps || raceData?.sector_matrix) ? <SpeedSectorsTable speedTraps={raceData?.speed_traps} sectorMatrix={raceData?.sector_matrix} /> : noData('Speed & Sectors');
      case 'Weather Data':      return raceData?.weather_info             ? <WeatherChart weatherData={raceData.weather_info} />                    : noData('Weather Data');
      case 'Live Feed':         return raceData?.race_control_messages    ? <RaceControlMessages messages={raceData.race_control_messages} status={raceData.status} /> : noData('Live Feed');
      default:                  return <div className="p-8 text-center text-neutral-500">Please select a session or telemetry view.</div>;
    }
  };

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans relative">
      {/* Backgrounds */}
      <div className="fixed inset-0 xl:left-72 bg-[url('https://images.unsplash.com/photo-1568605117036-5fe5e7bab0b7?q=80&w=2070&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat opacity-[0.08] pointer-events-none mix-blend-luminosity"></div>
      <div className="fixed inset-0 xl:left-72 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
      <div className="fixed inset-0 xl:left-72 bg-linear-to-b from-red-900/10 via-neutral-950/80 to-neutral-950 pointer-events-none"></div>

      
      <main className="w-full max-w-[1600px] mx-auto px-4 sm:px-6 xl:px-10 py-6 md:py-8 xl:py-10 relative z-10">

        {/* Header */}
        <section className="flex flex-col xl:flex-row justify-between xl:items-end mb-10 gap-6 relative">
          <div className="absolute -left-10 -top-10 w-32 h-32 bg-red-500/20 blur-[60px] rounded-full pointer-events-none"></div>
          <div>
            <Link to="/races" className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-400 mb-3 font-bold uppercase tracking-wider transition-colors">
              ← Back to Calendar
            </Link>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic transform -skew-x-6">
              {raceData?.race_info.name}
            </h2>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-sm shrink-0">
            {((isFetching && Boolean(data)) || raceData?._cache_state === 'revalidating') && (
              <div className="flex items-center gap-2 py-2 px-3 bg-red-950/40 border border-red-800/40 rounded-md text-xs font-mono font-bold text-red-400 shadow-lg backdrop-blur-sm">
                <span className="w-2 h-2 rounded-full bg-red-500 motion-safe:animate-ping"></span>
                <span>Syncing live telemetry…</span>
              </div>
            )}
            <div className="flex items-center gap-2 py-2.5 px-4 bg-neutral-900/80 backdrop-blur-sm border border-neutral-700/50 rounded-md font-mono font-bold shadow-lg">
              <Calendar size={16} className="text-red-500" />
              <span className="text-neutral-400">Season</span>
              <span className="text-white">{year}</span>
            </div>
            <div className="relative inline-flex items-center">
              <select
                onChange={handleRaceChange}
                value={round}
                aria-label="Select Race Round"
                className="bg-neutral-900/80 backdrop-blur-sm border border-neutral-700/50 py-2.5 pl-4 pr-10 rounded-md font-bold appearance-none cursor-pointer shadow-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-ui text-white"
              >
                {schedule.map((race: Race) => (
                  <option key={race.round} value={race.round}>{race.location}</option>
                ))}
              </select>
              <ChevronDown size={16} className="absolute right-3.5 text-neutral-400 pointer-events-none" />
            </div>
          </div>
        </section>

        {/* Hero Stats Grid - Quick insights */}
        {raceData?.race_info && (
          <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-10">
            {/* Winner Card */}
            {raceWinnerData && (
              <div className="bg-linear-to-br from-amber-950/40 to-neutral-900/60 backdrop-blur-sm border border-amber-700/30 rounded-lg p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                <div className="absolute inset-0 bg-linear-to-br from-amber-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Trophy size={18} className="text-amber-500" />
                    <span className="text-xs font-black text-amber-400 uppercase tracking-wider">Winner</span>
                  </div>
                  <div className="text-2xl font-black text-white mb-1 truncate">{raceWinnerData.full_name}</div>
                  <div className="text-sm text-neutral-400 truncate">{raceWinnerData.team_name}</div>
                </div>
              </div>
            )}

            {/* Pole Position */}
            {poleSitterData && (
              <div className="bg-linear-to-br from-red-950/40 to-neutral-900/60 backdrop-blur-sm border border-red-700/30 rounded-lg p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                <div className="absolute inset-0 bg-linear-to-br from-red-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Flag size={18} className="text-red-500" />
                    <span className="text-xs font-black text-red-400 uppercase tracking-wider">Pole Position</span>
                  </div>
                  <div className="text-2xl font-black text-white mb-1 truncate">{poleSitterData.full_name}</div>
                  <div className="text-sm text-neutral-400 truncate">{poleSitterData.team_name}</div>
                </div>
              </div>
            )}

            {/* Fastest Lap */}
            {fastestLapData && (
              <div className="bg-linear-to-br from-purple-950/40 to-neutral-900/60 backdrop-blur-sm border border-purple-700/30 rounded-lg p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform">
                <div className="absolute inset-0 bg-linear-to-br from-purple-500/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity"></div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-2">
                    <Clock size={18} className="text-purple-500" />
                    <span className="text-xs font-black text-purple-400 uppercase tracking-wider">Fastest Lap</span>
                  </div>
                  <div className="text-2xl font-black text-white mb-1 truncate">{fastestLapData.full_name}</div>
                  <div className="text-sm text-neutral-400 font-mono truncate">{fastestLapData.time}</div>
                </div>
              </div>
            )}

            {/* Race Status */}
            <div className="bg-linear-to-br from-neutral-900/60 to-neutral-900/80 backdrop-blur-sm border border-neutral-700/50 rounded-lg p-5 relative overflow-hidden group hover:scale-[1.02] transition-transform">
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-2">
                  <Calendar size={18} className="text-neutral-400" />
                  <span className="text-xs font-black text-neutral-400 uppercase tracking-wider">Round</span>
                </div>
                <div className="text-2xl font-black text-white mb-1">
                  R{String(round ?? '—').padStart(2, '0')}
                </div>
                <div className="text-sm text-neutral-400">
                  <span className={
                    raceData.status === 'Finished' ? 'text-green-400' :
                    raceData.status === 'Upcoming' ? 'text-amber-400' : 'text-red-400'
                  }>
                    {raceData.status?.toUpperCase()}
                  </span>
                </div>
              </div>
            </div>
          </section>
        )}

        {/* Track Map */}
        <TrackMap
          raceInfo={raceData?.race_info || null}
          laps={raceData?.results?.[0]?.laps ?? null}
          weatherInfo={raceData?.weather_info || null}
        />

        {/* Tab Navigation Bars: Official Sessions & Data & Telemetry (Above the Content Area) */}
        <section className="mb-6 space-y-4">
          {/* Keyboard hint */}
          {availableTabs.length > 1 && (
            <div className="flex items-center justify-end gap-2 text-[10px] text-neutral-500 font-mono mb-4">
              <span>Navigate:</span>
              <kbd className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 rounded-sm text-neutral-400">←</kbd>
              <kbd className="px-1.5 py-0.5 bg-neutral-900 border border-neutral-700 rounded-sm text-neutral-400">→</kbd>
            </div>
          )}

          {sessionTabs.length > 0 && (
            <div>
              <h3 className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2 ml-2">Official Sessions</h3>
              <div className="flex items-center gap-2 py-1.5 overflow-x-auto no-scrollbar">
                {sessionTabs.map(tab => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`group flex items-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap rounded-lg ${
                        isActive
                          ? 'bg-linear-to-r from-red-600 to-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]'
                          : 'text-neutral-400 hover:bg-neutral-800/80 hover:text-white'
                      }`}
                    >
                      {getTabIcon(tab, isActive)}
                      {tab}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {telemetryTabs.length > 0 && (
            <div>
              <h3 className="text-[11px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2 ml-2">Data & Telemetry</h3>
              <div className="flex flex-wrap items-center gap-2 py-1.5">
                {telemetryTabs.map(tab => {
                  const isActive = activeTab === tab;
                  return (
                    <button
                      key={tab}
                      onClick={() => setActiveTab(tab)}
                      className={`group flex items-center gap-2 py-2 px-4 text-xs font-bold uppercase tracking-wider whitespace-nowrap rounded-lg ${
                        isActive
                          ? 'bg-linear-to-r from-red-600 to-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]'
                          : 'text-neutral-400 hover:bg-neutral-800/80 hover:text-white'
                      }`}
                    >
                      {getTabIcon(tab, isActive)}
                      {tab === 'Live Feed' && raceData?.status !== 'Ongoing' ? 'Race Control Log' : tab}
                    </button>
                  );
                })}
              </div>
            </div>
          )}
        </section>

        {/* Main Content Area */}
        <section className="mb-12">
          <div className="bg-neutral-900/40 backdrop-blur-xl border border-neutral-800/80 shadow-2xl rounded-lg overflow-hidden">
            {renderActiveContent()}
          </div>
        </section>
      </main>
    </div>
  );
}

export default RaceDetailPage;
