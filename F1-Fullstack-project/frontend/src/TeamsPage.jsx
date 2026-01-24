// src/TeamsPage.jsx

import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import { Search, Trophy, Medal, ArrowUp } from 'lucide-react';

// --- Impor logo tim ---
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

// --- URL Backend ---
const API_URL = 'http://127.0.0.1:8000';

// --- Kamus untuk mencocokkan nama tim dengan logo ---
const teamLogos = {
  "Alpine": alpineLogo,
  "Aston Martin": astonMartinLogo,
  "Ferrari": ferrariLogo,
  "Haas F1 Team": haasLogo,
  "McLaren": mclarenLogo,
  "Mercedes": mercedesLogo,
  "RB": rbLogo,
  "Racing Bulls": rbLogo, // Nama alternatif untuk RB
  "Red Bull Racing": redBullLogo,
  "Sauber": sauberLogo,
  "Kick Sauber": sauberLogo, // Nama alternatif untuk Sauber
  "Williams": williamsLogo
};

// --- Kamus untuk warna border tim ---
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

function TeamsPage() {
  const [teams, setTeams] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const currentYear = new Date().getFullYear(); 

  useEffect(() => {
    async function fetchChampionshipData() {
      try {
        // Mengambil data dari endpoint championship yang sudah diperbarui
        const response = await fetch(`${API_URL}/api/championship/${currentYear}`);
        if (!response.ok) {
          const errorData = await response.json().catch(() => null);
          const errorMessage = errorData?.error || 'Network response was not ok';
          throw new Error(errorMessage);
        }
        const data = await response.json();

        if (data.error) {
            setError(data.error);
        } else if (data && data.teams) {
          // Data 'teams' sekarang berisi 'points_last_race'
          setTeams(data.teams);
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

  // Fungsi filter untuk search bar (tidak berubah)
  const filteredTeams = teams.filter(team =>
    team.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Tampilan saat loading
  if (loading) {
    return (
      <div className="bg-neutral-950 min-h-screen text-white flex items-center justify-center">
        <h2 className="text-3xl animate-pulse">Fetching {currentYear} team standings...</h2>
      </div>
    );
  }

  // Tampilan saat ada error
  if (error) {
    return (
      <div className="bg-neutral-950 min-h-screen text-white flex items-center justify-center text-center px-4">
        <div>
          <h2 className="text-3xl text-red-500 mb-4">Could Not Fetch Standings</h2>
          <p className="text-lg text-neutral-400 bg-neutral-800/50 p-4 rounded-lg">{error}</p>
          <p className="mt-4 text-sm text-neutral-500">Please ensure the backend server is running and that there are completed races for the {currentYear} season.</p>
        </div>
      </div>
    );
  }

  // Tampilan utama halaman
  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans">
      <Navbar />
      <main className="container mx-auto px-6 pt-28 pb-12">
        <header className="mb-10">
          <h1 className="text-5xl font-extrabold tracking-tight">Team <span className="text-red-500">Standings</span></h1>
          <p className="text-lg text-neutral-400">{currentYear} Season Championship</p>
        </header>

        {/* Search Bar */}
        <div className="relative mb-8">
          <input
            type="text"
            placeholder="Search by team name..."
            className="w-full bg-neutral-900 border border-neutral-700 rounded-lg py-3 pl-10 pr-4 focus:outline-none focus:ring-2 focus:ring-red-500 transition-colors"
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-neutral-500" size={20} />
        </div>

        <div>
          {/* Header Tabel */}
          <div className="flex text-xs uppercase text-neutral-400 px-4 py-2">
            <div className="w-16 font-semibold">Pos</div>
            <div className="flex-grow font-semibold">Team</div>
            <div className="text-right font-semibold">Points</div>
          </div>

          {/* Daftar Tim */}
          <div className="space-y-2">
            {filteredTeams.length > 0 ? (
              filteredTeams.map((team) => {
                const logo = teamLogos[team.name];
                const teamColor = teamColors[team.name] || '#374151';

                return (
                  <div
                    key={team.id}
                    className="flex items-center p-4 rounded-lg bg-neutral-900 border-l-4 transition-all hover:bg-neutral-800/50"
                    style={{ borderColor: teamColor }}
                  >
                    {/* POSISI */}
                    <div className="font-bold w-16 text-xl text-center text-neutral-400">{team.position}</div>
                    
                    {/* NAMA TIM & STATS (WINS, PODIUMS) */}
                    <div className="flex-grow flex items-center gap-4">
                        {logo && <img src={logo} alt={team.name} className="h-8 w-auto object-contain" />}
                        <div>
                          <span className="font-semibold text-white text-lg">{team.name}</span>
                          <div className="flex items-center gap-4 text-sm text-neutral-400 mt-1">
                            <span className="flex items-center gap-1.5">
                              <Trophy size={14} className="text-yellow-500" /> {team.wins} wins
                            </span>
                            <span className="flex items-center gap-1.5">
                              <Medal size={14} className="text-neutral-300" /> {team.podiums} podiums
                            </span>
                          </div>
                        </div>
                    </div>

                    {/* <<< BAGIAN UTAMA YANG DIPERBARUI >>> */}
                    {/* Menampilkan Poin Total & Poin Tambahan dari Balapan Terakhir */}
                    <div className="text-right">
                        <div className="font-extrabold text-2xl text-white">{team.points}</div>
                        
                        {/* 
                          Logika ini akan menampilkan poin tambahan HANYA JIKA
                          `team.points_last_race` ada dan nilainya lebih dari 0.
                          Ini dikirim dari backend yang sudah kita ubah tadi.
                        */}
                        {team.points_last_race > 0 && (
                            <div className="flex items-center justify-end gap-1 text-sm text-green-400 font-bold mt-1">
                                <ArrowUp size={12} strokeWidth={3}/>
                                <span>{team.points_last_race}</span>
                            </div>
                        )}
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-center p-8 text-neutral-500">
                No teams found matching your search.
              </div>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

export default TeamsPage;