// src/RaceDetailPage.jsx (KODE LENGKAP DENGAN PERBAIKAN)

import React, { useState, useEffect } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import Navbar from './Navbar';
import { Trophy, GitCommitVertical, Clock, Calendar } from 'lucide-react';

// --- A. KUMPULAN IMPORT LOGO TIM (Tidak berubah) ---
import alpineLogo from './assets/logos/alpine.svg';
import astonMartinLogo from './assets/logos/aston-martin.svg';
import ferrariLogo from './assets/logos/ferrari.svg';
import haasLogo from './assets/logos/haas.svg';
import mclarenLogo from './assets/logos/mclaren.svg';
import mercedesLogo from './assets/logos/mercedes-star.svg';
import rbLogo from './assets/logos/rb.svg';
import redBullLogo from './assets/logos/red-bull-racing.svg';
import sauberLogo from './assets/logos/sauber.svg';
import williamsLogo from './assets/logos/williams.svg';

// --- B. KAMUS LOGO & WARNA (Tidak berubah) ---
const teamLogos = {
  "Alpine": alpineLogo, "Aston Martin": astonMartinLogo, "Ferrari": ferrariLogo,
  "Haas F1 Team": haasLogo, "McLaren": mclarenLogo, "Mercedes": mercedesLogo,
  "RB": rbLogo,
  "Racing Bulls": rbLogo,
  "Red Bull Racing": redBullLogo,
  "Sauber": sauberLogo,
  "Kick Sauber": sauberLogo,
  "Williams": williamsLogo
};

const teamColors = {
    "Red Bull Racing": "3671C6", "Mercedes": "27F4D2", "Ferrari": "E8002D", "McLaren": "FF8000",
    "Aston Martin": "229971", "Alpine": "0090FF", "Williams": "00A3E0", "RB": "6692FF",
    "Racing Bulls": "6692FF",
    "Sauber": "52E252",
    "Kick Sauber": "52E252",
    "Haas F1 Team": "B6BABD"
};

const API_URL = 'http://127.0.0.1:8000';

// --- C. KOMPONEN-KOMPONEN KECIL ---

const SummaryCard = ({ title, icon, data }) => (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 h-full">
        <div className="flex justify-between items-center text-neutral-400 text-sm"><span>{title}</span>{icon}</div>
        {data && data.full_name ? (
            <div className="mt-4">
                <p className="text-xl font-bold text-white flex items-center gap-2">
                    {/* Logika ini sekarang berfungsi untuk semua kartu, termasuk Fastest Lap */}
                    {data.team_name && teamLogos[data.team_name] && <img src={teamLogos[data.team_name]} alt={data.team_name} className="h-5 w-auto" />}
                    {data.full_name}
                </p>
                {title === 'Fastest Lap' && data.lap_number ? (
                    <p className="font-mono text-neutral-300 mt-1">
                        Lap {data.lap_number} - {data.lap_time}
                    </p>
                ) : (
                    <p className="font-mono text-neutral-300 mt-1">
                        {data.time || data.lap_time}
                    </p>
                )}
            </div>
        ) : (<p className="mt-4 text-neutral-500 text-sm">Race not run yet.</p>)}
    </div>
);


// =======================================================================
// --- KOMPONEN-KOMPONEN TABEL (Tidak berubah) ---
// =======================================================================

const PracticeResultTable = ({ data }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead className="text-left text-neutral-400 text-xs uppercase"><tr className="bg-neutral-800/50">
                <th className="p-3 w-8 text-center font-semibold">POS.</th><th className="p-3 w-8 text-center font-semibold">NO.</th>
                <th className="p-3 font-semibold">Driver</th><th className="p-3 font-semibold hidden md:table-cell">Team</th>
                <th className="p-3 font-semibold text-right">Time</th>
                <th className="p-3 font-semibold text-right">Laps</th></tr></thead>
            <tbody>{data.map(d => (<tr key={d.position} className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/40 transition-colors">
                <td className="p-3 font-bold text-center text-base">{d.position}</td>
                <td className="p-3 font-bold text-center text-base" style={{ color: `#${teamColors[d.team_name] || 'FFFFFF'}` }}>{d.driver_number}</td>
                <td className="p-3 font-bold text-white whitespace-nowrap">{d.full_name}</td>
                <td className="p-3 text-neutral-300 whitespace-nowrap hidden md:table-cell"><div className="flex items-center gap-2">{teamLogos[d.team_name] && <img src={teamLogos[d.team_name]} alt={d.team_name} className="h-4 w-auto" />}<span>{d.team_name}</span></div></td>
                <td className="p-3 text-right font-mono text-xs font-bold text-white">{d.time}</td>
                <td className="p-3 text-right">{d.laps}</td></tr>))}</tbody>
        </table>
    </div>
);

const SprintQualifyingResultTable = ({ data }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead className="text-left text-neutral-400 text-xs uppercase"><tr className="bg-neutral-800/50">
                <th className="p-3 w-8 text-center font-semibold">POS.</th><th className="p-3 w-8 text-center font-semibold">NO.</th>
                <th className="p-3 font-semibold">Driver</th><th className="p-3 font-semibold hidden md:table-cell">Team</th>
                <th className="p-3 font-semibold text-right">Time</th><th className="p-3 font-semibold text-right">Q1</th>
                <th className="p-3 font-semibold text-right">Q2</th><th className="p-3 font-semibold text-right">Q3</th>
                <th className="p-3 font-semibold text-right">Laps</th></tr></thead>
            <tbody>{data.map(d => (<tr key={d.position} className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/40 transition-colors">
                <td className="p-3 font-bold text-center text-base">{d.position}</td>
                <td className="p-3 font-bold text-center text-base" style={{ color: `#${teamColors[d.team_name] || 'FFFFFF'}` }}>{d.driver_number}</td>
                <td className="p-3 font-bold text-white whitespace-nowrap">{d.full_name}</td>
                <td className="p-3 text-neutral-300 whitespace-nowrap hidden md:table-cell"><div className="flex items-center gap-2">{teamLogos[d.team_name] && <img src={teamLogos[d.team_name]} alt={d.team_name} className="h-4 w-auto" />}<span>{d.team_name}</span></div></td>
                <td className="p-3 text-right font-mono text-xs font-bold text-white">{d.time}</td>
                <td className="p-3 text-right font-mono text-xs text-neutral-300">{d.q1}</td>
                <td className="p-3 text-right font-mono text-xs text-neutral-300">{d.q2}</td>
                <td className="p-3 text-right font-mono text-xs text-neutral-300">{d.q3}</td>
                <td className="p-3 text-right">{d.laps}</td></tr>))}</tbody>
        </table>
    </div>
);


const QualifyingResultTable = ({ data }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead className="text-left text-neutral-400 text-xs uppercase"><tr className="bg-neutral-800/50">
                <th className="p-3 w-8 text-center font-semibold">POS.</th><th className="p-3 w-8 text-center font-semibold">NO.</th>
                <th className="p-3 font-semibold">Driver</th><th className="p-3 font-semibold hidden md:table-cell">Team</th>
                <th className="p-3 font-semibold text-right">Time</th><th className="p-3 font-semibold text-right">Q1</th>
                <th className="p-3 font-semibold text-right">Q2</th><th className="p-3 font-semibold text-right">Q3</th>
                <th className="p-3 font-semibold text-right">Laps</th></tr></thead>
            <tbody>{data.map(d => (<tr key={d.position} className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/40 transition-colors">
                <td className="p-3 font-bold text-center text-base">{d.position}</td>
                <td className="p-3 font-bold text-center text-base" style={{ color: `#${teamColors[d.team_name] || 'FFFFFF'}` }}>{d.driver_number}</td>
                <td className="p-3 font-bold text-white whitespace-nowrap">{d.full_name}</td>
                <td className="p-3 text-neutral-300 whitespace-nowrap hidden md:table-cell"><div className="flex items-center gap-2">{teamLogos[d.team_name] && <img src={teamLogos[d.team_name]} alt={d.team_name} className="h-4 w-auto" />}<span>{d.team_name}</span></div></td>
                <td className="p-3 text-right font-mono text-xs font-bold text-white">{d.time}</td>
                <td className="p-3 text-right font-mono text-xs text-neutral-300">{d.q1}</td>
                <td className="p-3 text-right font-mono text-xs text-neutral-300">{d.q2}</td>
                <td className="p-3 text-right font-mono text-xs text-neutral-300">{d.q3}</td>
                <td className="p-3 text-right">{d.laps}</td></tr>))}</tbody>
        </table>
    </div>
);

const SprintResultTable = ({ data }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead className="text-left text-neutral-400 text-xs uppercase"><tr className="bg-neutral-800/50">
                <th className="p-3 w-8 text-center font-semibold">POS.</th><th className="p-3 w-8 text-center font-semibold">NO.</th>
                <th className="p-3 font-semibold">Driver</th><th className="p-3 font-semibold hidden md:table-cell">Team</th>
                <th className="p-3 font-semibold text-right">Time</th><th className="p-3 font-semibold text-right">Gap To Fastest</th>
                <th className="p-3 font-semibold text-right">Interval</th><th className="p-3 font-semibold text-right">Points</th>
                <th className="p-3 font-semibold text-right">Laps</th></tr></thead>
            <tbody>{data.map(d => (<tr key={d.position} className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/40 transition-colors">
                <td className="p-3 font-bold text-center text-base">{d.position}</td>
                <td className="p-3 font-bold text-center text-base" style={{ color: `#${teamColors[d.team_name] || 'FFFFFF'}` }}>{d.driver_number}</td>
                <td className="p-3 font-bold text-white whitespace-nowrap">{d.full_name}</td>
                <td className="p-3 text-neutral-300 whitespace-nowrap hidden md:table-cell"><div className="flex items-center gap-2">{teamLogos[d.team_name] && <img src={teamLogos[d.team_name]} alt={d.team_name} className="h-4 w-auto" />}<span>{d.team_name}</span></div></td>
                <td className="p-3 text-right font-mono text-xs">{d.time || d.status}</td>
                <td className="p-3 text-right font-mono text-xs">{d.gap_to_leader}</td>
                <td className="p-3 text-right font-mono text-xs">{d.interval}</td>
                <td className="p-3 text-right font-bold">{d.points}</td>
                <td className="p-3 text-right">{d.laps}</td></tr>))}</tbody>
        </table>
    </div>
);

const RaceResultTable = ({ data }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead className="text-left text-neutral-400 text-xs uppercase"><tr className="bg-neutral-800/50">
                <th className="p-3 w-8 text-center font-semibold">POS.</th><th className="p-3 w-8 text-center font-semibold">NO.</th>
                <th className="p-3 font-semibold">Driver</th><th className="p-3 font-semibold hidden md:table-cell">Team</th>
                <th className="p-3 font-semibold text-right">Time</th><th className="p-3 font-semibold text-right">Gap To Leader</th>
                <th className="p-3 font-semibold text-right">Interval</th><th className="p-3 font-semibold text-right">Points</th>
                <th className="p-3 font-semibold text-right">Laps</th></tr></thead>
            <tbody>{data.map(d => (<tr key={d.position} className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/40 transition-colors">
                <td className="p-3 font-bold text-center text-base">{d.position}</td>
                <td className="p-3 font-bold text-center text-base" style={{ color: `#${teamColors[d.team_name] || 'FFFFFF'}` }}>{d.driver_number}</td>
                <td className="p-3 font-bold text-white whitespace-nowrap">{d.full_name}</td>
                <td className="p-3 text-neutral-300 whitespace-nowrap hidden md:table-cell"><div className="flex items-center gap-2">{teamLogos[d.team_name] && <img src={teamLogos[d.team_name]} alt={d.team_name} className="h-4 w-auto" />}<span>{d.team_name}</span></div></td>
                <td className="p-3 text-right font-mono text-xs">{d.time || d.status}</td>
                <td className="p-3 text-right font-mono text-xs">{d.gap_to_leader}</td>
                <td className="p-3 text-right font-mono text-xs">{d.interval}</td>
                <td className="p-3 text-right font-bold">{d.points}</td>
                <td className="p-3 text-right">{d.laps}</td></tr>))}</tbody>
        </table>
    </div>
);

const SprintGridTable = ({ data }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead className="text-left text-neutral-400 text-xs uppercase"><tr className="bg-neutral-800/50">
                <th className="p-3 w-8 text-center font-semibold">POS.</th>
                <th className="p-3 w-8 text-center font-semibold">NO.</th>
                <th className="p-3 font-semibold">Driver</th>
                <th className="p-3 font-semibold hidden md:table-cell">Team</th>
                <th className="p-3 font-semibold text-right">Time</th>
            </tr></thead>
            <tbody>{data.map(d => (<tr key={d.grid_position} className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/40 transition-colors">
                <td className="p-3 font-bold text-center text-base">{d.grid_position}</td>
                <td className="p-3 font-bold text-center text-base" style={{ color: `#${teamColors[d.team_name] || 'FFFFFF'}` }}>{d.driver_number}</td>
                <td className="p-3 font-bold text-white whitespace-nowrap">{d.full_name}</td>
                <td className="p-3 text-neutral-300 whitespace-nowrap hidden md:table-cell"><div className="flex items-center gap-2">{teamLogos[d.team_name] && <img src={teamLogos[d.team_name]} alt={d.team_name} className="h-4 w-auto" />}<span>{d.team_name}</span></div></td>
                <td className="p-3 text-right font-mono text-xs">{d.time}</td>
            </tr>))}</tbody>
        </table>
    </div>
);

const StartingGridTable = ({ data }) => (
    <div className="overflow-x-auto">
        <table className="w-full text-sm">
            <thead className="text-left text-neutral-400 text-xs uppercase"><tr className="bg-neutral-800/50">
                <th className="p-3 w-8 text-center font-semibold">POS.</th><th className="p-3 w-8 text-center font-semibold">NO.</th>
                <th className="p-3 font-semibold">Driver</th><th className="p-3 font-semibold">Team</th></tr></thead>
            <tbody>{data.map(d => (<tr key={d.grid_position} className="border-b border-neutral-800 last:border-b-0 hover:bg-neutral-800/40 transition-colors">
                <td className="p-3 font-bold text-center text-base">{d.grid_position}</td>
                <td className="p-3 font-bold text-center text-base" style={{ color: `#${teamColors[d.team_name] || 'FFFFFF'}` }}>{d.driver_number}</td>
                <td className="p-3 font-bold text-white whitespace-nowrap">{d.full_name}</td>
                <td className="p-3 text-neutral-300 whitespace-nowrap"><div className="flex items-center gap-2">{teamLogos[d.team_name] && <img src={teamLogos[d.team_name]} alt={d.team_name} className="h-4 w-auto" />}<span>{d.team_name}</span></div></td></tr>))}</tbody>
        </table>
    </div>
);

// =======================================================================
// --- KOMPONEN UTAMA HALAMAN DETAIL BALAPAN ---
// =======================================================================
const ALL_POSSIBLE_TABS = [
    'Practice 1', 'Practice 2', 'Practice 3', 
    'Sprint Qualifying', 'Sprint Grid', 'Sprint', 
    'Qualifying', 'Starting Grid', 'Race'
];

function RaceDetailPage() {
    const { year, round } = useParams();
    const navigate = useNavigate();
    
    const [raceData, setRaceData] = useState(null);
    const [schedule, setSchedule] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);
    const [activeTab, setActiveTab] = useState('Race'); 

    useEffect(() => {
        const fetchPageData = async () => {
            setLoading(true);
            try {
                const [detailsResponse, scheduleResponse] = await Promise.all([
                    fetch(`${API_URL}/api/race/${year}/${round}`),
                    fetch(`${API_URL}/api/races/${year}`)
                ]);
                if (!detailsResponse.ok) throw new Error('Gagal mengambil detail balapan.');
                if (!scheduleResponse.ok) throw new Error('Gagal mengambil jadwal balapan.');
                const detailsData = await detailsResponse.json();
                const scheduleData = await scheduleResponse.json();
                if (detailsData.error) throw new Error(detailsData.message || detailsData.error);
                
                setRaceData(detailsData);
                setSchedule(scheduleData);

                const available = detailsData.available_tabs || [];
                if (available.includes('Race')) {
                    setActiveTab('Race');
                } else if (available.length > 0) {
                    const orderedTabs = ALL_POSSIBLE_TABS.filter(t => available.includes(t));
                    setActiveTab(orderedTabs[orderedTabs.length - 1]);
                }

            } catch (err) {
                setError(err.message);
            } finally {
                setLoading(false);
            }
        };
        fetchPageData();
    }, [year, round]);

    const handleRaceChange = (event) => {
        const newRound = event.target.value;
        navigate(`/race/${year}/${newRound}`);
    };

    if (loading) { return <div className="bg-neutral-950 min-h-screen text-white flex items-center justify-center"><h2 className="text-3xl animate-pulse">Loading Race Details...</h2></div>; }
    if (error) { return <div className="bg-neutral-950 min-h-screen text-white flex items-center justify-center text-center px-4"><h2 className="text-3xl text-red-500">{error}</h2></div>; }

    // Logika untuk menambahkan nama tim ke data summary card
    const raceWinnerData = raceData?.race_winner ? { ...raceData.race_winner, team_name: raceData.results?.[0]?.team_name } : null;
    const poleSitterData = raceData?.pole_position ? { ...raceData.pole_position, team_name: raceData.qualifying_results?.find(d => d.full_name === raceData.pole_position.full_name)?.team_name } : null;
    
    // =========================================================================
    // --- START PERUBAHAN ---
    // Data fastest_lap sekarang sudah lengkap dari backend, tidak perlu modifikasi.
    // =========================================================================
    const fastestLapData = raceData?.fastest_lap;
    // =========================================================================
    // --- END PERUBAHAN ---
    // =========================================================================

    const availableTabs = ALL_POSSIBLE_TABS.filter(tab => 
        raceData?.available_tabs?.includes(tab)
    );

    const renderActiveTable = () => {
        switch(activeTab) {
            case 'Practice 1':
                return raceData?.practice1_results ? <PracticeResultTable data={raceData.practice1_results} /> : <div className="p-8 text-center text-neutral-500">Data for Practice 1 is not yet available.</div>;
            case 'Practice 2':
                return raceData?.practice2_results ? <PracticeResultTable data={raceData.practice2_results} /> : <div className="p-8 text-center text-neutral-500">Data for Practice 2 is not yet available.</div>;
            case 'Practice 3':
                return raceData?.practice3_results ? <PracticeResultTable data={raceData.practice3_results} /> : <div className="p-8 text-center text-neutral-500">Data for Practice 3 is not yet available.</div>;
            case 'Sprint Qualifying':
                return raceData?.sprint_qualifying_results ? <SprintQualifyingResultTable data={raceData.sprint_qualifying_results} /> : <div className="p-8 text-center text-neutral-500">Data for Sprint Qualifying is not yet available.</div>;
            case 'Sprint Grid':
                return raceData?.sprint_grid_results ? <SprintGridTable data={raceData.sprint_grid_results} /> : <div className="p-8 text-center text-neutral-500">Data for Sprint Grid is not yet available.</div>;
            case 'Sprint':
                return raceData?.sprint_results ? <SprintResultTable data={raceData.sprint_results} /> : <div className="p-8 text-center text-neutral-500">Data for Sprint is not yet available.</div>;
            case 'Qualifying':
                return raceData?.qualifying_results ? <QualifyingResultTable data={raceData.qualifying_results} /> : <div className="p-8 text-center text-neutral-500">Data for Qualifying is not yet available.</div>;
            case 'Starting Grid':
                return raceData?.starting_grid ? <StartingGridTable data={raceData.starting_grid} /> : <div className="p-8 text-center text-neutral-500">Data for Starting Grid is not yet available.</div>;
            case 'Race':
                return raceData?.results ? <RaceResultTable data={raceData.results} /> : <div className="p-8 text-center text-neutral-500">Data for Race is not yet available.</div>;
            default:
                return <div className="p-8 text-center text-neutral-500">Please select a session.</div>;
        }
    };

    return (
        <div className="bg-neutral-950 min-h-screen text-white font-sans">
            <Navbar />
            <main className="container mx-auto px-6 pt-28 pb-12">
                <section className="flex flex-col sm:flex-row justify-between sm:items-end mb-8 gap-4">
                    <div>
                        <Link to="/races" className="text-sm text-red-500 hover:text-red-400 mb-2 block transition-colors">← Back to Race Calendar</Link>
                        <h2 className="text-4xl md:text-5xl font-extrabold tracking-tight">{raceData?.race_info.name}</h2>
                    </div>
                    <div className="flex items-center gap-2 sm:gap-4 text-sm flex-shrink-0">
                        <div className="flex items-center gap-2 p-2 bg-neutral-800 rounded-md"><Calendar size={16} /><span>Season</span><span className="font-bold">{year}</span></div>
                        <select onChange={handleRaceChange} value={round} className="bg-neutral-800 p-2 rounded-md font-bold appearance-none cursor-pointer">
                            {schedule.map(race => (<option key={race.round} value={race.round}>{race.location}</option>))}
                        </select>
                    </div>
                </section>

                <section className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                    <SummaryCard title="Race Winner" icon={<Trophy size={20} />} data={raceWinnerData} />
                    <SummaryCard title="Pole Position" icon={<GitCommitVertical size={20} />} data={poleSitterData} />
                    {/* ========================================================================= */}
                    {/* --- START PERUBAHAN --- */}
                    {/* Menggunakan variabel fastestLapData yang sudah benar */}
                    {/* ========================================================================= */}
                    <SummaryCard title="Fastest Lap" icon={<Clock size={20} />} data={fastestLapData} />
                    {/* ========================================================================= */}
                    {/* --- END PERUBAHAN --- */}
                    {/* ========================================================================= */}
                </section>
                
                <section className="mb-4">
                    <div className="flex items-center gap-2 border-b border-neutral-800 overflow-x-auto pb-px">
                        {availableTabs.map(tab => (
                            <button key={tab} onClick={() => setActiveTab(tab)} className={`py-2 px-4 text-sm font-semibold whitespace-nowrap ${activeTab === tab ? 'text-white border-b-2 border-red-500' : 'text-neutral-500 hover:text-neutral-300'}`}>
                                {tab}
                            </button>
                        ))}
                    </div>
                </section>
                
                <div className="bg-neutral-900 border border-neutral-800 rounded-2xl overflow-hidden">
                    {renderActiveTable()}
                </div>
            </main>
        </div>
    );
}

export default RaceDetailPage;