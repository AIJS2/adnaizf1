import React from 'react';
import { Link } from 'react-router-dom';
import Navbar from './Navbar';
import { 
  BookOpen, Trophy, Flag, Activity, Users, Calculator, 
  BarChart2, Zap, GitCommitVertical, AlertCircle, ChevronRight
} from 'lucide-react';

const GuidePage = () => {
  return (
    <div className="bg-[#050505] min-h-screen text-white font-sans selection:bg-red-600">
      <Navbar />
      
      {/* Header */}
      <div className="relative pt-32 pb-12 overflow-hidden border-b border-neutral-900">
        <div className="absolute inset-0 bg-red-600/5 blur-[100px] rounded-full pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-xs font-bold uppercase tracking-wider mb-4">
            <BookOpen size={14} /> Official Documentation
          </div>
          <h1 className="text-4xl md:text-6xl font-black uppercase tracking-tighter mb-4">
            Platform <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-red-700">Guide</span>
          </h1>
          <p className="text-neutral-400 max-w-2xl text-lg leading-relaxed">
            Master the paddock. Here is a complete breakdown of every tool, chart, and feature available in our F1 Analytics Platform.
          </p>
        </div>
      </div>

      <main className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-12">
          
          {/* Table of Contents / Quick Links */}
          <div className="lg:col-span-1">
            <div className="sticky top-28 bg-neutral-900/50 border border-neutral-800 rounded-3xl p-6 backdrop-blur-md">
              <h3 className="text-xl font-black uppercase tracking-tight mb-6 flex items-center gap-2">
                <BarChart2 className="text-red-500" /> Features Menu
              </h3>
              <ul className="space-y-2">
                <li><a href="#race-progression" className="block px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 font-bold transition-colors">Race Progression Chart</a></li>
                <li><a href="#telemetry" className="block px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 font-bold transition-colors">Lap Telemetry</a></li>
                <li><a href="#speed-sectors" className="block px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 font-bold transition-colors">Speed & Sectors Matrix</a></li>
                <li><a href="#tyre-strategy" className="block px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 font-bold transition-colors">Tyre Strategy</a></li>
                <li><a href="#simulator" className="block px-4 py-2 rounded-xl text-neutral-400 hover:text-white hover:bg-neutral-800 font-bold transition-colors">Championship Simulator</a></li>
              </ul>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-2 space-y-16">
            
            {/* Feature 1 */}
            <section id="race-progression" className="scroll-mt-28">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-orange-500/10 border border-orange-500/30 flex items-center justify-center text-orange-500">
                  <Activity size={24} />
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tight">Race Progression (Gap to Leader)</h2>
              </div>
              <div className="prose prose-invert max-w-none text-neutral-300">
                <p>
                  Found in the <strong>Race Details</strong> page, the Race Progression chart is arguably the most powerful tool for analyzing race pace and strategy. Instead of just showing positions, it plots the <strong>time gap (in seconds)</strong> between every driver and the race leader across all laps.
                </p>
                <div className="bg-neutral-900 border border-neutral-800 p-5 rounded-2xl my-6">
                  <h4 className="text-white font-bold mb-3 flex items-center gap-2"><Zap size={16} className="text-yellow-500"/> How to read it:</h4>
                  <ul className="space-y-2 text-sm">
                    <li><strong className="text-white">Flat / Horizontal Line:</strong> The driver is matching the leader's pace exactly.</li>
                    <li><strong className="text-red-400">Line Going Up:</strong> The driver is losing time to the leader (e.g. tyre degradation, stuck in traffic).</li>
                    <li><strong className="text-green-400">Line Going Down:</strong> The driver is catching the leader (setting faster lap times).</li>
                    <li><strong className="text-blue-400">Sudden Sharp Spike Up:</strong> The driver made a Pit Stop (losing ~20-25 seconds).</li>
                  </ul>
                </div>
                <p>
                  <em>Pro Tip:</em> Look for the "Undercut". If a driver pits early, their line spikes up. But if their line then starts dropping rapidly (because of fresh tyres) while their rival stays out on old tyres (line going up), you can visually see the undercut working!
                </p>
              </div>
            </section>

            {/* Feature 2 */}
            <section id="telemetry" className="scroll-mt-28">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-blue-500/10 border border-blue-500/30 flex items-center justify-center text-blue-500">
                  <GitCommitVertical size={24} />
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tight">Lap Telemetry Analysis</h2>
              </div>
              <div className="prose prose-invert max-w-none text-neutral-300">
                <p>
                  Access the <strong>Telemetry</strong> tab to compare the fastest laps of any two drivers overlaid on top of each other. This is exactly what engineers look at to see <em>where</em> a driver is losing time.
                </p>
                <ul className="mt-4 space-y-2">
                  <li><strong>Delta Time:</strong> A yellow line showing the exact time gap at every meter of the track.</li>
                  <li><strong>Speed Trace:</strong> See who breaks later and who carries more speed through the apex.</li>
                  <li><strong>Throttle & Brake:</strong> Analyze driving styles (e.g., trail braking vs sudden braking).</li>
                  <li><strong>Gear Selection:</strong> See if a driver takes a corner in 3rd vs 4th gear to minimize wheelspin.</li>
                </ul>
              </div>
            </section>

            {/* Feature 3 */}
            <section id="speed-sectors" className="scroll-mt-28">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-purple-500/10 border border-purple-500/30 flex items-center justify-center text-purple-500">
                  <Flag size={24} />
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tight">Speed & Sectors Matrix</h2>
              </div>
              <div className="prose prose-invert max-w-none text-neutral-300">
                <p>
                  In the Race Details page, the <strong>Speed & Sectors</strong> tab reveals the ultimate potential of the car. It tracks the <strong>Speed Trap (Top Speed)</strong> to show who has the most aerodynamic efficiency or engine power on the straights.
                </p>
                <p className="mt-4">
                  The <strong>Sector Matrix</strong> combines each driver's absolute best Sector 1, Sector 2, and Sector 3 times into an "Ideal Lap". You can compare this Ideal Lap against their Actual Fastest Lap to see how much time they left on the table due to mistakes or traffic. <span className="text-purple-400 font-bold">Purple text</span> indicates the absolute fastest sector of the entire session.
                </p>
              </div>
            </section>

            {/* Feature 4 */}
            <section id="tyre-strategy" className="scroll-mt-28">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-zinc-500/10 border border-zinc-500/30 flex items-center justify-center text-zinc-400">
                  <AlertCircle size={24} />
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tight">Tyre Strategy</h2>
              </div>
              <div className="prose prose-invert max-w-none text-neutral-300">
                <p>
                  A visual timeline of every driver's tyre choices. See exactly which compound (Soft, Medium, Hard, Inter, Wet) they started on, how many laps they pushed it, and when they pitted. The bars are scaled proportionally to the stint length.
                </p>
              </div>
            </section>

            {/* Feature 5 */}
            <section id="simulator" className="scroll-mt-28">
              <div className="flex items-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-center text-emerald-500">
                  <Calculator size={24} />
                </div>
                <h2 className="text-3xl font-black uppercase tracking-tight">Championship Simulator</h2>
              </div>
              <div className="prose prose-invert max-w-none text-neutral-300">
                <p>
                  Want to know if Lando Norris can catch Max Verstappen? Go to the <strong>Simulator</strong>. We fetch the live points standings and remaining races, and let you input custom race results (P1, P2, P3, Fastest Lap, etc.) for upcoming rounds. The tool instantly recalculates the championship points to show you if a comeback is mathematically possible.
                </p>
              </div>
            </section>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-neutral-950 py-8 px-6 text-center mt-12">
        <p className="text-neutral-500 text-sm font-bold uppercase tracking-wider">
          Formula 1 Analytics Hub &copy; {2024}
        </p>
      </footer>
    </div>
  );
};

export default GuidePage;
