// src/DriversPage.jsx - VERSI FINAL DENGAN UI KARTU BARU

import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import { Search, ArrowUp } from 'lucide-react';

// --- Impor semua logo dan warna (disamakan dengan TeamsPage) ---
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

const API_URL = 'http://127.0.0.1:8000';

const teamLogos = {
  "Alpine": alpineLogo,
  "Aston Martin": astonMartinLogo,
  "Ferrari": ferrariLogo,
  "Haas F1 Team": haasLogo,
  "McLaren": mclarenLogo,
  "Mercedes": mercedesLogo,
  "RB": rbLogo,
  "Racing Bulls": rbLogo,
  "Red Bull Racing": redBullLogo,
  "Sauber": sauberLogo,
  "Kick Sauber": sauberLogo,
  "Williams": williamsLogo
};

const teamColors = {
    "Red Bull Racing": "#3671C6",
    "Mercedes": "#27F4D2",
    "Ferrari": "#E8002D",
    "McLaren": "#FF8000",
    "Aston Martin": "#229971",
    "Alpine": "#0090FF",
    "Williams": "#00A3E0",
    "RB": "#6692FF",
    "Racing Bulls": "#6692FF",
    "Sauber": "#52E252",
    "Kick Sauber": "#52E252",
    "Haas F1 Team": "#B6BABD"
};

function DriversPage() {
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    async function fetchChampionshipData() {
      try {
        const response = await fetch(`${API_URL}/api/championship/${currentYear}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage = errorData?.error || 'Network response was not ok';
          throw new Error(errorMessage);
        }
        
        const data = await response.json();
        if (data.error) {
            setError(data.error);
        } else if (data && data.drivers) {
          setDrivers(data.drivers);
        } else {
          throw new Error("Invalid data structure from API.");
        }

      } catch (err) {
        setError(`Failed to fetch data: ${err.message}`);
        console.error("Fetch error:", err);
      } finally {
        setLoading(false);
      }
    }
    
    fetchChampionshipData();
  }, [currentYear]);

  const filteredDrivers = drivers.filter(driver =>
    driver.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    driver.team.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (loading) {
    return (
      <div className="bg-neutral-950 min-h-screen text-white flex items-center justify-center">
        <h2 className="text-3xl animate-pulse">Fetching {currentYear} driver standings...</h2>
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-neutral-950 min-h-screen text-white flex items-center justify-center text-center px-4">
        <div>
          <h2 className="text-3xl text-red-500 mb-4">Could Not Fetch Standings</h2>
          <p className="text-lg text-neutral-400 bg-neutral-800/50 p-4 rounded-lg">{error}</p>
          <p className="mt-4 text-sm text-neutral-500">Please ensure the backend server is running and there are completed races for the {currentYear} season.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans">
      <Navbar />
      <main className="container mx-auto px-6 pt-28 pb-12">
        <header className="mb-10">
          <h1 className="text-5xl font-extrabold tracking-tight">Driver <span className="text-red-500">Standings</span></h1>
          <p className="text-lg text-neutral-400">{currentYear} Season Championship</p>
        </header>

        <div className="relative mb-8">
          <input
            type="text"
            placeholder="Search by driver or team..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
        </div>

        {/* --- KARTU KLASEMEN PEMBALAP (VERSI DISEMPURNAKAN) --- */}
        <div className="space-y-2">
          {filteredDrivers.length > 0 ? (
            filteredDrivers.map((driver) => {
              const teamColor = teamColors[driver.team] || '#374151';
              const logo = teamLogos[driver.team];

              return (
                <div
                  key={driver.id}
                  className="flex items-center p-4 rounded-lg bg-neutral-900 border-l-4 transition-all hover:bg-neutral-800/50"
                  style={{ borderColor: teamColor }}
                >
                  {/* Bagian Kiri: Posisi */}
                  <div className="w-16 flex flex-col items-center justify-center">
                    <span className="text-3xl font-bold text-white">{driver.position}</span>
                    <span className="text-xs font-semibold text-neutral-500 -mt-1">P{driver.position}</span>
                  </div>

                  {/* Bagian Tengah: Info Pembalap */}
                  <div className="flex-grow flex items-center gap-4 ml-4">
                    {/* [PERUBAHAN 1]: Nomor pembalap diganti logo tim */}
                    {logo ? (
                       <img src={logo} alt={driver.team} className="h-9 w-9 object-contain flex-shrink-0" />
                    ) : (
                      <div className="h-9 w-9 flex-shrink-0"></div>
                    )}
                    <div>
                      <h2 className="text-xl font-semibold text-white">{driver.name}</h2>
                      <div className="flex items-center gap-2 mt-1">
                        <span className="text-sm text-neutral-400">{driver.team}</span>
                        <span className="text-xs font-bold bg-neutral-700 text-neutral-300 px-1.5 py-0.5 rounded">
                          {driver.abbreviation}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Bagian Kanan: Statistik */}
                  <div className="flex items-center gap-8">
                    {/* [PERUBAHAN 2]: Menambahkan 'text-center' */}
                    <div className="text-center w-16">
                      <div className="text-xs font-bold text-neutral-500">WINS</div>
                      <div className="text-lg font-semibold">{driver.wins}</div>
                    </div>
                    <div className="text-center w-16">
                      <div className="text-xs font-bold text-neutral-500">PODIUMS</div>
                      <div className="text-lg font-semibold">{driver.podiums}</div>
                    </div>
                    <div className="text-right pl-8 border-l border-neutral-800 w-32">
                      <div className="text-3xl font-extrabold">{driver.points}</div>
                      
                      {/* [PERUBAHAN 3]: Menghapus label "POINTS" */}
                      <div className="flex justify-end -mt-1">
                         {driver.points_last_race > 0 && (
                            <div className="flex items-center text-sm text-green-400 font-bold">
                                <ArrowUp size={12} strokeWidth={3}/>
                                <span>{driver.points_last_race}</span>
                            </div>
                        )}
                      </div>
                    </div>
                  </div>

                </div>
              );
            })
          ) : (
            <div className="text-center p-8 text-neutral-500">
              No drivers found matching your search.
            </div>
          )}
        </div>
      </main>
    </div>
  );
}

export default DriversPage;