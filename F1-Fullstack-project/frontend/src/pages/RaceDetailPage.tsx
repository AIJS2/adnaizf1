// src/RaceDetailPage.jsx - FIXED: shared teamData & config, improved error state

import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import ErrorState from '../components/layout/ErrorState';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { Trophy, Calendar, Activity, TrendingUp, Wrench, Route, Gauge, Sun, List, LayoutGrid, Timer, Flag } from 'lucide-react';
import { API_URL } from '../config';
import { getTrackMap } from '../data/trackData';
import TelemetryTab from '../components/ui/TelemetryTab';

// =======================================================================

import LapChartComponent from '../components/race/LapChart';
import GapChartComponent from '../components/race/GapChart';
import LapTimesChartComponent from '../components/race/LapTimesChart';
import RaceControlMessages from '../components/race/RaceControlMessages';
import { PracticeResultTable, QualifyingResultTable, SprintQualifyingResultTable, SprintResultTable, RaceResultTable, GridTable, TyreStrategyTable, SpeedSectorsTable, WeatherChart } from '../components/race/RaceTables';
import { SummaryCard } from '../components/race/RaceMiniComponents';


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

function RaceDetailPage() {
  const { year, round } = useParams();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('Race');

  const { data, isLoading: loading, error, refetch: fetchPageData } = useQuery({
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
    }
  });

  const raceData = data?.raceData || null;
  const schedule = data?.schedule || [];

  useEffect(() => {
    if (raceData) {
      const available = raceData.available_tabs || [];
      if (available.includes('Race')) {
        setActiveTab('Race');
      } else if (available.length > 0) {
        const orderedTabs = ALL_POSSIBLE_TABS.filter(t => available.includes(t));
        setActiveTab(orderedTabs[orderedTabs.length - 1]);
      }
    }
  }, [raceData]);

  const handleRaceChange = (event: any) => {
    navigate(`/race/${year}/${event.target.value}`);
  };

  const SkeletonLoader = () => (
    <div className="bg-neutral-950 min-h-screen text-white font-sans animate-pulse">
      
      <main className="container mx-auto px-6 pt-28 pb-12">
        <div className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 gap-4">
          <div>
            <div className="h-4 w-40 bg-neutral-800 rounded mb-4"></div>
            <div className="h-12 w-64 md:w-96 bg-neutral-800 rounded"></div>
          </div>
          <div className="flex items-center gap-2 sm:gap-4 flex-shrink-0">
            <div className="h-10 w-24 bg-neutral-800 rounded"></div>
            <div className="h-10 w-32 bg-neutral-800 rounded"></div>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[1, 2, 3].map(i => (
            <div key={i} className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 h-32">
              <div className="h-4 w-24 bg-neutral-800 rounded mb-4"></div>
              <div className="h-6 w-32 bg-neutral-800 rounded mb-2"></div>
              <div className="h-4 w-48 bg-neutral-800 rounded"></div>
            </div>
          ))}
        </div>
        <div className="h-10 w-full bg-neutral-800 rounded mb-4"></div>
        <div className="h-64 w-full bg-neutral-900 border border-neutral-800 rounded-2xl"></div>
        <div className="mt-4 text-center text-neutral-500">
          Fetching comprehensive F1 data... this might take 1-2 minutes if cache is cold.
        </div>
      </main>
    </div>
  );

  if (loading) return <SkeletonLoader />;

  if (error) return <ErrorState message={error.message} onRetry={fetchPageData} />;

  const raceWinnerData = raceData?.race_winner
    ? { ...raceData.race_winner, team_name: raceData.results?.[0]?.team_name }
    : null;
  const poleSitterData = raceData?.pole_position
    ? { ...raceData.pole_position, team_name: raceData.qualifying_results?.find((d: any) => d.full_name === raceData.pole_position.full_name)?.team_name }
    : null;
  const fastestLapData = raceData?.fastest_lap;

  const baseAvailableTabs = ALL_POSSIBLE_TABS.filter(tab => raceData?.available_tabs?.includes(tab));
  const availableTabs = [...baseAvailableTabs];
  if (raceData?.lap_chart && !availableTabs.includes('Lap Chart')) availableTabs.push('Lap Chart');
  if (raceData?.gap_chart && !availableTabs.includes('Race Progression')) availableTabs.push('Race Progression');
  if (raceData?.lap_times_chart && !availableTabs.includes('Lap Times')) availableTabs.push('Lap Times');
  if (raceData?.tyre_strategy && !availableTabs.includes('Tyre Strategy')) availableTabs.push('Tyre Strategy');
  if ((raceData?.speed_traps || raceData?.sector_matrix) && !availableTabs.includes('Speed & Sectors')) availableTabs.push('Speed & Sectors');
  if (raceData?.weather_info && raceData.weather_info.length > 0 && !availableTabs.includes('Weather Data')) availableTabs.push('Weather Data');
  if (raceData?.race_control_messages && raceData.race_control_messages.length > 0 && !availableTabs.includes('Live Feed')) availableTabs.push('Live Feed');
  if (!availableTabs.includes('Lap Telemetry')) availableTabs.push('Lap Telemetry');

  const renderActiveTable = () => {
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
      case 'Lap Chart':         return raceData?.lap_chart                ? <LapChartComponent lapChart={raceData.lap_chart} results={raceData.results} /> : noData('Lap Chart');
      case 'Race Progression':  return raceData?.gap_chart                ? <GapChartComponent gapChart={raceData.gap_chart} results={raceData.results} /> : noData('Race Progression');
      case 'Lap Times':         return raceData?.lap_times_chart          ? <LapTimesChartComponent lapTimesChart={raceData.lap_times_chart} results={raceData.results} /> : noData('Lap Times');
      case 'Tyre Strategy':     return raceData?.tyre_strategy            ? <TyreStrategyTable tyreData={raceData.tyre_strategy} />                 : noData('Tyre Strategy');
      case 'Speed & Sectors':   return (raceData?.speed_traps || raceData?.sector_matrix) ? <SpeedSectorsTable speedTraps={raceData?.speed_traps} sectorMatrix={raceData?.sector_matrix} /> : noData('Speed & Sectors');
      case 'Weather Data':      return raceData?.weather_info             ? <WeatherChart weatherData={raceData.weather_info} />                    : noData('Weather Data');
      case 'Live Feed':         return raceData?.race_control_messages    ? <RaceControlMessages messages={raceData.race_control_messages} status={raceData.status} /> : noData('Live Feed');
      case 'Lap Telemetry':     return <TelemetryTab year={year || ''} round={round || ''} />;
      default:                  return <div className="p-8 text-center text-neutral-500">Please select a session.</div>;
    }
  };

  const SESSION_TAB_NAMES = [
    'Practice 1', 'Practice 2', 'Practice 3',
    'Sprint Qualifying', 'Sprint Grid', 'Sprint',
    'Qualifying', 'Starting Grid', 'Race'
  ];
  const sessionTabs = availableTabs.filter(t => SESSION_TAB_NAMES.includes(t));
  const telemetryTabs = availableTabs.filter(t => !SESSION_TAB_NAMES.includes(t));

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans relative">
      {/* Backgrounds */}
      <div className="fixed inset-0 bg-[url('https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat opacity-[0.10] pointer-events-none mix-blend-luminosity"></div>
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
      <div className="fixed inset-0 bg-gradient-to-b from-red-900/10 via-neutral-950/80 to-neutral-950 pointer-events-none"></div>

      
      <main className="container mx-auto px-4 md:px-6 pt-28 pb-16 relative z-10">

        {/* Header */}
        <section className="flex flex-col sm:flex-row justify-between sm:items-end mb-10 gap-6 relative">
          <div className="absolute -left-10 -top-10 w-32 h-32 bg-red-500/20 blur-[60px] rounded-full pointer-events-none"></div>
          <div>
            <Link to="/races" className="inline-flex items-center gap-1.5 text-sm text-red-500 hover:text-red-400 mb-3 font-bold uppercase tracking-wider transition-colors">
              ← Back to Calendar
            </Link>
            <h2 className="text-4xl md:text-6xl font-black tracking-tighter italic transform -skew-x-6">
              {raceData?.race_info.name}
            </h2>
          </div>
          <div className="flex items-center gap-3 text-sm flex-shrink-0">
            <div className="flex items-center gap-2 py-2.5 px-4 bg-neutral-900/80 backdrop-blur border border-neutral-700/50 rounded-xl font-mono font-bold shadow-lg">
              <Calendar size={16} className="text-red-500" />
              <span className="text-neutral-400">Season</span>
              <span className="text-white">{year}</span>
            </div>
            <select
              onChange={handleRaceChange}
              value={round}
              className="bg-neutral-900/80 backdrop-blur border border-neutral-700/50 py-2.5 px-4 rounded-xl font-bold appearance-none cursor-pointer shadow-lg focus:border-red-500 focus:ring-2 focus:ring-red-500/20 transition-all"
            >
              {schedule.map((race: any) => (
                <option key={race.round} value={race.round}>{race.location}</option>
              ))}
            </select>
          </div>
        </section>

        {/* Track Map */}
        <section className="mb-10 flex justify-center bg-neutral-900/40 backdrop-blur-md border border-neutral-800/80 rounded-3xl p-8 relative overflow-hidden shadow-2xl">
          <div className="absolute top-5 left-6 text-neutral-500 font-black text-xs uppercase tracking-[0.2em]">Circuit Layout</div>
          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-red-500/10 blur-[80px] rounded-full pointer-events-none"></div>
          {getTrackMap(raceData?.race_info) ? (
            <img 
              src={getTrackMap(raceData?.race_info)} 
              alt={`Track map for ${raceData?.race_info?.name || raceData?.race_info?.location}`} 
              className="h-32 md:h-64 object-contain brightness-0 invert opacity-70 transition-all duration-500 hover:opacity-100 hover:drop-shadow-[0_0_20px_rgba(255,255,255,0.3)]"
            />
          ) : (
            <div className="text-neutral-600 italic py-10 font-bold">
              Track map not available for {raceData?.race_info?.location || raceData?.race_info?.name}.
            </div>
          )}
        </section>

        {/* Summary Cards */}
        <section className="grid grid-cols-1 md:grid-cols-3 gap-6 md:gap-8 mb-10">
          <SummaryCard title="Race Winner"  icon={<Trophy size={20} />}          data={raceWinnerData} />
          <SummaryCard title="Pole Position" icon={<GitCommitVertical size={20} />} data={poleSitterData} />
          <SummaryCard title="Fastest Lap"  icon={<Clock size={20} />}           data={fastestLapData} />
        </section>

        {/* Session Tabs */}
        {sessionTabs.length > 0 && (
          <section className="mb-5">
            <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2.5 ml-2">Official Sessions</h3>
            <div className="flex items-center gap-2 p-2 bg-neutral-900/60 backdrop-blur-md border border-neutral-800/80 rounded-2xl overflow-x-auto no-scrollbar shadow-xl">
              {sessionTabs.map(tab => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`group flex items-center gap-2 py-2.5 px-5 text-sm font-bold uppercase tracking-wider whitespace-nowrap rounded-lg transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]'
                        : 'text-neutral-400 hover:bg-neutral-800/80 hover:text-white'
                    }`}
                  >
                    {getTabIcon(tab, isActive)}
                    {tab}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Telemetry Tabs */}
        {telemetryTabs.length > 0 && (
          <section className="mb-8">
            <h3 className="text-[10px] font-black text-neutral-500 uppercase tracking-[0.2em] mb-2.5 ml-2">Data & Telemetry</h3>
            <div className="flex flex-wrap items-center gap-2 p-2 bg-neutral-900/60 backdrop-blur-md border border-neutral-800/80 rounded-2xl shadow-xl">
              {telemetryTabs.map(tab => {
                const isActive = activeTab === tab;
                return (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`group flex items-center gap-2 py-2.5 px-5 text-sm font-bold uppercase tracking-wider whitespace-nowrap rounded-lg transition-all duration-300 ${
                      isActive
                        ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-[0_0_15px_rgba(220,38,38,0.4)]'
                        : 'text-neutral-400 hover:bg-neutral-800/80 hover:text-white'
                    }`}
                  >
                    {getTabIcon(tab, isActive)}
                    {tab === 'Live Feed' && raceData?.status !== 'Ongoing' ? 'Race Control Log' : tab}
                  </button>
                );
              })}
            </div>
          </section>
        )}

        {/* Result Table */}
        <div className="bg-neutral-900/40 backdrop-blur-xl border border-neutral-800/80 shadow-2xl rounded-3xl overflow-hidden mb-12">
          {renderActiveTable()}
        </div>
      </main>
    </div>
  );
}

export default RaceDetailPage;