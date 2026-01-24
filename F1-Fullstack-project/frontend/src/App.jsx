// src/App.jsx - VERSI ASLI SEBELUM ROUTING

import Navbar from './Navbar.jsx';
import LandingPage from './LandingPage.jsx';

function App() {
  return (
    <main className="bg-black text-white">
      <Navbar />
      <LandingPage />
      
      {/* SECTION FITUR YANG MENYATU DENGAN HALAMAN UTAMA */}
      <section id="dashboard" className="container mx-auto px-6 py-20">
        
        <div className="text-center mb-12">
          <h2 className="text-4xl md:text-5xl font-extrabold mb-4">
            The Ultimate <span className="text-red-600">F1 Data Hub</span>
          </h2>
          <p className="text-lg text-gray-400 max-w-3xl mx-auto">
            From live telemetry to historical archives, every piece of data is at your fingertips. Built for fans, by fans.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-gray-900/50 p-8 rounded-lg border border-white/10">
            <h3 className="text-2xl font-bold mb-3 text-yellow-400">Driver Standings</h3>
            <p className="text-gray-300">
              Track every point, every win, and every podium. See the championship battle unfold in real-time.
            </p>
          </div>
          <div className="bg-gray-900/50 p-8 rounded-lg border border-white/10">
            <h3 className="text-2xl font-bold mb-3 text-yellow-400">Team Analytics</h3>
            <p className="text-gray-300">
              Analyze constructor performance, pit stop efficiency, and strategic choices that win championships.
            </p>
          </div>
          <div className="bg-gray-900/50 p-8 rounded-lg border border-white/10">
            <h3 className="text-2xl font-bold mb-3 text-yellow-400">Race Telemetry</h3>
            <p className="text-gray-300">
              Dive deep into lap times, tire degradation, and driver inputs with our detailed telemetry visuals.
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}

export default App;