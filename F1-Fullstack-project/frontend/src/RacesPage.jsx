// src/RacesPage.jsx - FINAL DENGAN PENANGANAN JADWAL KOSONG

import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
// --- TAMBAHAN ---
import { Calendar, Trophy, Users, Clock, Info } from 'lucide-react';
import Flag from 'react-world-flags';
import { Link } from 'react-router-dom';

// --- ASET GAMBAR (Tidak berubah) ---
import abuDhabiTrack from './assets/tracks/Abu-Dhabi.png';
import australiaTrack from './assets/tracks/Australia.png';
import austriaTrack from './assets/tracks/Austria.png';
import azerbaijanTrack from './assets/tracks/Azerbaijan.png';
import bahrainTrack from './assets/tracks/Bahrain.png';
import belgiumTrack from './assets/tracks/Belgium.png';
import brazilTrack from './assets/tracks/Brazil.png';
import canadaTrack from './assets/tracks/Canada.png';
import chinaTrack from './assets/tracks/China.png';
import greatBritainTrack from './assets/tracks/Great-Britain.png';
import hungaryTrack from './assets/tracks/Hungary.png';
import imolaTrack from './assets/tracks/Imola.png';
import italyTrack from './assets/tracks/Italy.png';
import japanTrack from './assets/tracks/Japan.png';
import lasVegasTrack from './assets/tracks/LasVegas.png';
import mexicoTrack from './assets/tracks/Mexico.png';
import miamiTrack from './assets/tracks/Miami.png';
import monacoTrack from './assets/tracks/Monaco.png';
import netherlandsTrack from './assets/tracks/Netherlands.png';
import qatarTrack from './assets/tracks/Qatar.png';
import saudiArabiaTrack from './assets/tracks/Saudi-Arabia.png';
import singaporeTrack from './assets/tracks/Singapore.png';
import spainTrack from './assets/tracks/Spain.png';
import usaTrack from './assets/tracks/Usa.png';

const API_URL = 'http://127.0.0.1:8000';
const CURRENT_YEAR = new Date().getFullYear();

// --- KAMUS-KAMUS (Tidak berubah) ---
const trackLayouts = {
    'Melbourne': australiaTrack, 'Sakhir': bahrainTrack, 'Shanghai': chinaTrack, 'Jeddah': saudiArabiaTrack,
    'Austin': usaTrack, 'Suzuka': japanTrack, 'Monza': italyTrack, 'Imola': imolaTrack, 'Monte Carlo': monacoTrack,
    'Monaco': monacoTrack, 'Barcelona': spainTrack, 'Montréal': canadaTrack, 'Spielberg': austriaTrack,
    'Silverstone': greatBritainTrack, 'Budapest': hungaryTrack, 'Spa-Francorchamps': belgiumTrack,
    'Zandvoort': netherlandsTrack, 'Baku': azerbaijanTrack, 'Marina Bay': singaporeTrack, 'Singapore': singaporeTrack,
    'Mexico City': mexicoTrack, 'São Paulo': brazilTrack, 'Lusail': qatarTrack, 'Yas Island': abuDhabiTrack,
    'Las Vegas': lasVegasTrack, 'Miami': miamiTrack, 'Miami Gardens': miamiTrack, 'Miami International Autodrome': miamiTrack
};
const countryCodeMapping = {
    'Australia': 'AU', 'Bahrain': 'BH', 'China': 'CN', 'Saudi Arabia': 'SA', 'USA': 'US', 'United States': 'US',
    'Japan': 'JP', 'Italy': 'IT', 'Monaco': 'MC', 'Spain': 'ES', 'Canada': 'CA', 'Austria': 'AT',
    'UK': 'GB', 'Great Britain': 'GB', 'United Kingdom': 'GB', 'Hungary': 'HU', 'Belgium': 'BE',
    'Netherlands': 'NL', 'Azerbaijan': 'AZ', 'Singapore': 'SG', 'Mexico': 'MX', 'Brazil': 'BR',
    'Qatar': 'QA', 'United Arab Emirates': 'AE',
};

// =======================================================================
// --- KOMPONEN RaceCard (Tidak berubah) ---
// =======================================================================
const RaceCard = ({ race }) => {
    const raceDate = new Date(race.date + 'T00:00:00');
    const formattedDate = raceDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    
    const trackImage = trackLayouts[race.location.trim()];
    const flagCode = countryCodeMapping[race.country.trim()];

    const getStatusClasses = (status) => {
        switch (status) {
            case 'Finished': return 'bg-green-500/20 text-green-400';
            case 'Ongoing': return 'bg-orange-400/20 text-orange-400 animate-pulse';
            case 'Upcoming': return 'bg-zinc-500/20 text-zinc-400';
            default: return 'bg-gray-500/20 text-gray-400';
        }
    };

    return (
        <Link to={`/race/${CURRENT_YEAR}/${race.round}`} className="block h-full">
            <div className="relative bg-neutral-900 border border-neutral-800 rounded-xl p-6 flex flex-col justify-between h-full transition-all duration-200 hover:transform hover:-translate-y-1 hover:shadow-2xl hover:shadow-red-800/20 overflow-hidden">
                {trackImage && (
                    <img 
                        src={trackImage} 
                        alt={`${race.location} track layout`} 
                        className="absolute top-6 right-4 w-28 h-auto opacity-20 pointer-events-none" 
                    />
                )}
                <div className="relative z-10 flex flex-col justify-between h-full">
                    <div>
                        <div className="flex justify-between items-start mb-4">
                            <div>
                                <div className="flex items-center gap-3 mb-1">
                                    <Flag code={flagCode} className="w-6 h-auto rounded-sm" fallback={<div className="w-6 h-4 bg-neutral-700 rounded-sm"></div>}/>
                                    <h3 className="font-bold text-white text-lg">{race.name}</h3>
                                </div>
                                <p className="text-neutral-400 text-sm">{race.location}</p>
                            </div>
                            <div className="bg-indigo-700 text-white font-bold text-xs py-1 px-3 rounded-full">
                                Round {race.round}
                            </div>
                        </div>

                        <div className="flex justify-between items-center border-b border-neutral-800 pb-4 mb-4 pr-28">
                            <div className="flex items-center gap-2 text-neutral-300">
                                <Calendar size={14} />
                                <span className="font-semibold text-sm">{formattedDate}</span>
                            </div>
                            <div className={`px-3 py-1 text-xs font-bold uppercase rounded-md flex items-center gap-1.5 ${getStatusClasses(race.status)}`}>
                                {race.status === 'Ongoing' && <Clock size={12} />}
                                <span>{race.status === 'Finished' ? 'Completed' : race.status}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col gap-2">
                        {race.status === 'Finished' && race.winner && (
                            <>
                                <div className="flex items-center gap-2 text-sm text-neutral-300">
                                    <Trophy size={14} className="text-yellow-400" />
                                    <span className="font-medium">{race.winner}</span>
                                </div>
                                <div className="flex items-center gap-2 text-sm text-neutral-400">
                                    <Users size={14} className="text-neutral-500" />
                                    <span className="text-xs">{race.winner_team}</span>
                                </div>
                            </>
                        )}
                    </div>
                </div>
            </div>
        </Link>
    );
};


// =======================================================================
// --- KOMPONEN UTAMA RacesPage ---
// =======================================================================
const RacesPage = () => {
    const [races, setRaces] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    useEffect(() => {
        const fetchAllRaces = async () => {
            try {
                const response = await fetch(`${API_URL}/api/races/${CURRENT_YEAR}`);
                if (!response.ok) {
                    throw new Error(`Failed to fetch data. Status: ${response.status}`);
                }
                const data = await response.json();
                if (data.error) {
                    throw new Error(data.error);
                }
                setRaces(data);
                setError(null);
            
            } catch (err) {
                console.error("Fetch error:", err); 
                setError("Could not connect to the server or failed to load data. Please make sure the backend is running and try again.");
            
            } finally {
                setLoading(false);
            }
        };

        fetchAllRaces();
    }, []); 
    
    if (loading) { 
        return (
            <div className="bg-neutral-950 min-h-screen text-white flex items-center justify-center">
                <h2 className="text-3xl animate-pulse">Loading Race Schedule...</h2>
            </div>
        ); 
    }
    
    if (error) { 
        return (
            <div className="bg-neutral-950 min-h-screen text-white flex items-center justify-center text-center px-4">
                <div>
                    <h2 className="text-3xl text-red-500 font-bold mb-2">Oops! Something went wrong.</h2>
                    <p className="text-neutral-400">{error}</p>
                </div>
            </div>
        ); 
    }

    return (
        <div className="bg-neutral-950 min-h-screen text-white font-sans">
            <Navbar />
            <main className="container mx-auto px-6 pt-28 pb-12">
                <section className="mb-8">
                    <h2 className="text-5xl font-extrabold tracking-tight">Race Calendar</h2>
                    <p className="text-lg text-neutral-400">{CURRENT_YEAR} Season</p>
                </section>
                
                {/* --- TAMBAHAN DI SINI --- */}
                {races.length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {races.map(race => (
                            <RaceCard key={race.round} race={race} />
                        ))}
                    </div>
                ) : (
                    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-12 text-center flex flex-col items-center mt-8">
                        <Info size={40} className="text-blue-500 mb-4" />
                        <h3 className="text-2xl font-bold text-white mb-2">
                            Race Schedule Not Available
                        </h3>
                        <p className="text-neutral-400 max-w-md">
                            The race calendar for the {CURRENT_YEAR} season has not been released or could not be loaded. Please check back later.
                        </p>
                    </div>
                )}
            </main>
        </div>
    );
};

export default RacesPage;