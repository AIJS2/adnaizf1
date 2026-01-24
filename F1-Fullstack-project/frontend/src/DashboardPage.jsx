// src/DashboardPage.jsx - FINAL DENGAN LAYOUT COUNTDOWN RAMPING

import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowUp, Clock, Trophy, Calendar } from 'lucide-react';
import Navbar from './Navbar';
import CountdownTimer from './CountdownTimer'; // Pastikan ini di-import

// Path logo
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
  "Alpine": alpineLogo, "Aston Martin": astonMartinLogo, "Ferrari": ferrariLogo,
  "Haas F1 Team": haasLogo, "McLaren": mclarenLogo, "Mercedes": mercedesLogo,
  "RB": rbLogo, "Red Bull Racing": redBullLogo, "Sauber": sauberLogo,
  "Williams": williamsLogo
};

// Komponen TeamCard (tidak ada perubahan)
const TeamCard = ({ team }) => {
  const logo = teamLogos[team.name];
  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 flex flex-col justify-between h-full hover:bg-neutral-800/50 transition-colors">
      <div>
        <div className="flex justify-between items-start mb-4">
          <span className="font-semibold text-neutral-300">{team.name}</span>
          {logo && <img src={logo} alt={team.name} className="h-6 w-auto" />}
        </div>
        <p className="text-5xl font-extrabold my-3 text-white">{parseInt(team.points, 10)} <span className="text-3xl font-medium text-neutral-500">PTS</span></p>
      </div>
      {team.points_last_race > 0 && (
        <div className="flex items-center gap-2 text-green-400 font-semibold">
          <ArrowUp size={16} />
          <span>{parseInt(team.points_last_race, 10)}</span>
        </div>
      )}
    </div>
  );
};

// Komponen DriverStandingsList (tidak ada perubahan)
const DriverStandingsList = ({ drivers }) => (
  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 h-full">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-xl font-bold">Driver Standings</h3>
      <Link to="/drivers" className="text-sm font-semibold text-red-500 hover:text-red-400 transition-colors">View All →</Link>
    </div>
    <div className="space-y-3">
      {drivers.map((driver, index) => {
        const logo = teamLogos[driver.team];
        return (
          <div key={driver.name} className="flex items-center justify-between text-sm py-1">
            <div className="flex items-center gap-3">
              <span className="text-neutral-500 font-bold w-5 text-center">{index + 1}</span>
              {logo ? <img src={logo} alt={driver.team} className="h-4 w-auto object-contain" /> : <div className="w-4 h-4" />}
              <p className="font-medium text-white">{driver.name}</p>
            </div>
            <p className="font-bold text-neutral-300">{parseInt(driver.points, 10)} PTS</p>
          </div>
        );
      })}
    </div>
  </div>
);

// Komponen RaceAnalyticsCard (tidak ada perubahan)
const RaceAnalyticsCard = ({ races, year }) => (
  <div className="bg-neutral-900 border border-neutral-800 rounded-2xl p-6 h-full">
    <div className="flex justify-between items-center mb-4">
      <h3 className="text-xl font-bold">Race Analytics</h3>
      <Link to="/races" className="text-sm font-semibold text-red-500 hover:text-red-400 transition-colors">View All →</Link>
    </div>
    <div className="space-y-4">
      {races.map(race => (
        <Link 
          key={race.name} 
          to={`/race/${year}/${race.round}`} 
          className="block bg-neutral-950/50 border border-neutral-800 rounded-xl p-4 hover:bg-neutral-800/60 transition-colors cursor-pointer"
        >
          <p className="font-bold text-white text-sm">{race.name}</p>
          <p className="text-xs text-neutral-400 mb-2">
            {new Date(`${race.date}T00:00:00`).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}, {race.location}
          </p>
          {race.status === 'Finished' && ( <div className="flex items-center gap-2 text-xs text-neutral-300"><Trophy size={14} className="text-amber-400" /><span>Winner: {race.winner}</span></div> )}
          {race.status === 'Ongoing' && ( <div className="flex items-center gap-2 text-xs font-medium text-amber-400 animate-pulse"><Clock size={14} /><span>ONGOING</span></div> )}
          {race.status === 'Upcoming' && ( <div className="flex items-center gap-2 text-xs font-medium text-sky-400"><Calendar size={14} /><span>UPCOMING</span></div> )}
        </Link>
      ))}
    </div>
  </div>
);

// Komponen Utama Halaman Dashboard (dengan layout countdown horizontal)
function DashboardPage() {
  const [dashboardData, setDashboardData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    async function fetchDashboardData() {
      try {
        const response = await fetch(`${API_URL}/api/dashboard/${currentYear}`);
        if (!response.ok) throw new Error('Network response was not ok');
        const data = await response.json();
        if (data.error) throw new Error(data.error);
        setDashboardData(data);
      } catch (err) { setError(err.message); } 
      finally { setLoading(false); }
    }
    fetchDashboardData();
  }, [currentYear]);

  if (loading) return <div className="bg-neutral-950 min-h-screen text-white flex items-center justify-center"><h2 className="text-3xl animate-pulse">Loading Analyziz...</h2></div>;
  if (error) return <div className="bg-neutral-950 min-h-screen text-white flex items-center justify-center text-center px-4"><h2 className="text-3xl text-red-500">{error}</h2></div>;

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans">
      <Navbar />
      <main className="container mx-auto px-6 pt-28 pb-12">
        {/* ======================================================================= */}
        {/* --- START PERUBAHAN UTAMA: HEADER DENGAN COUNTDOWN --- */}
        {/* ======================================================================= */}
        <section className="flex flex-col md:flex-row justify-between md:items-end gap-6 mb-12">
          {/* Bagian Kiri: Judul Halaman */}
          <div>
            <h2 className="text-5xl font-extrabold tracking-tight">Dashboard</h2>
            <p className="text-lg text-neutral-400">{dashboardData?.year} Season Overview</p>
          </div>
          
          {/* Bagian Kanan: Countdown Timer */}
          {dashboardData?.next_race_event && (
            <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-4 text-center flex-shrink-0">
             <p className="text-xs font-semibold text-red-500 uppercase tracking-widest mb-2">
  {dashboardData.next_race_event.name}
</p>
              <CountdownTimer targetDate={dashboardData.next_race_event.date} />
            </div>
          )}
        </section>
        {/* ======================================================================= */}
        {/* --- END PERUBAHAN UTAMA --- */}
        {/* ======================================================================= */}

        <section>
          <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
            <div className="lg:col-span-4 mb-4">
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-2xl font-bold">Constructor Standings</h3>
                <Link to="/teams" className="text-sm font-semibold text-red-500 hover:text-red-400 transition-colors">View All →</Link>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-6">
                {(dashboardData?.team_standings?.slice(0, 4) || []).map(team => (
                  <TeamCard key={team.name} team={team} />
                ))}
              </div>
            </div>
            
            <div className="lg:col-span-2">
              <DriverStandingsList drivers={dashboardData?.driver_standings?.slice(0, 7) || []} />
            </div>

            <div className="lg:col-span-2">
              <RaceAnalyticsCard 
                races={dashboardData?.race_analytics || []} 
                year={dashboardData?.year}
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default DashboardPage;