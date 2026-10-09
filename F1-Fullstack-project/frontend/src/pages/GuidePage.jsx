import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useInView } from 'react-intersection-observer';
import { 
  BookOpen, Trophy, Flag, Activity, Users, Calculator, 
  BarChart2, Zap, GitCommitVertical, AlertCircle, ChevronRight
} from 'lucide-react';

const GuideSection = ({ id, title, icon, colorClass, setActiveSection, children }) => {
  const { ref, inView } = useInView({
    threshold: 0.4,
    rootMargin: "-20% 0px -40% 0px"
  });

  useEffect(() => {
    if (inView) {
      setActiveSection(id);
    }
  }, [inView, id, setActiveSection]);

  const colorStyles = {
    orange: {
      border: 'hover:border-orange-500/30',
      glow: 'bg-orange-500/5 group-hover:bg-orange-500/20',
      iconBg: 'bg-orange-500/10 border-orange-500/30 text-orange-500'
    },
    blue: {
      border: 'hover:border-blue-500/30',
      glow: 'bg-blue-500/5 group-hover:bg-blue-500/20',
      iconBg: 'bg-blue-500/10 border-blue-500/30 text-blue-500'
    },
    purple: {
      border: 'hover:border-purple-500/30',
      glow: 'bg-purple-500/5 group-hover:bg-purple-500/20',
      iconBg: 'bg-purple-500/10 border-purple-500/30 text-purple-500'
    },
    zinc: {
      border: 'hover:border-zinc-500/30',
      glow: 'bg-zinc-500/5 group-hover:bg-zinc-500/20',
      iconBg: 'bg-zinc-500/10 border-zinc-500/30 text-zinc-400'
    },
    emerald: {
      border: 'hover:border-emerald-500/30',
      glow: 'bg-emerald-500/5 group-hover:bg-emerald-500/20',
      iconBg: 'bg-emerald-500/10 border-emerald-500/30 text-emerald-500'
    }
  };

  const currentStyle = colorStyles[colorClass] || colorStyles.orange;

  return (
    <section id={id} ref={ref} className="scroll-mt-32 group">
      <div className={`bg-neutral-900/30 hover:bg-neutral-900/60 transition-all duration-500 backdrop-blur-xl border border-neutral-800/50 ${currentStyle.border} rounded-3xl p-8 shadow-2xl relative overflow-hidden`}>
        {/* Subtle background glow on hover */}
        <div className={`absolute -top-24 -right-24 w-48 h-48 ${currentStyle.glow} blur-[80px] transition-all duration-700 pointer-events-none rounded-full`} />
        
        <div className="flex flex-col md:flex-row md:items-center gap-5 mb-8 relative z-10">
          <div className={`w-14 h-14 rounded-2xl border flex items-center justify-center shadow-[0_0_15px_rgba(0,0,0,0)] group-hover:shadow-[0_0_20px_rgba(0,0,0,0.2)] transition-all ${currentStyle.iconBg}`}>
            {icon}
          </div>
          <h2 className="text-3xl md:text-4xl font-black uppercase tracking-tight text-white group-hover:text-transparent group-hover:bg-clip-text group-hover:bg-gradient-to-r group-hover:from-white group-hover:to-neutral-400 transition-all">
            {title}
          </h2>
        </div>
        <div className="prose prose-invert prose-lg max-w-none text-neutral-300 relative z-10">
          {children}
        </div>
      </div>
    </section>
  );
};

const GuidePage = () => {
  const [activeSection, setActiveSection] = useState('race-progression');

  const navItems = [
    { id: 'race-progression', label: 'Race Progression Chart', icon: <Activity size={16} /> },
    { id: 'telemetry', label: 'Lap Telemetry', icon: <GitCommitVertical size={16} /> },
    { id: 'speed-sectors', label: 'Speed & Sectors Matrix', icon: <Flag size={16} /> },
    { id: 'tyre-strategy', label: 'Tyre Strategy', icon: <AlertCircle size={16} /> },
    { id: 'simulator', label: 'Championship Simulator', icon: <Calculator size={16} /> },
  ];

  return (
    <div className="bg-[#050505] min-h-screen text-white font-sans selection:bg-red-600">
      
      {/* Header */}
      <div className="relative pt-32 pb-16 overflow-hidden border-b border-neutral-900/50">
        <div className="absolute inset-0 bg-gradient-to-b from-red-600/10 to-transparent blur-[100px] rounded-full pointer-events-none" />
        <div className="container mx-auto px-6 relative z-10">
          <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-red-500/10 border border-red-500/20 text-red-400 text-sm font-bold uppercase tracking-wider mb-6 shadow-[0_0_15px_rgba(239,68,68,0.15)]">
            <BookOpen size={16} /> Official Documentation
          </div>
          <h1 className="text-5xl md:text-7xl font-black uppercase tracking-tighter mb-6">
            Platform <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.3)]">Guide</span>
          </h1>
          <p className="text-neutral-400 max-w-2xl text-xl leading-relaxed font-medium">
            Master the paddock. Here is a complete breakdown of every tool, chart, and feature available in our F1 Analytics Platform.
          </p>
        </div>
      </div>

      <main className="container mx-auto px-6 py-16">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-12 items-start">
          
          {/* Table of Contents / Quick Links */}
          <div className="lg:col-span-1 sticky top-32">
            <div className="bg-neutral-900/40 border border-neutral-800/60 rounded-3xl p-6 backdrop-blur-xl shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-[50px]" />
              <h3 className="text-sm font-black uppercase tracking-widest text-neutral-500 mb-6 flex items-center gap-2">
                <BarChart2 className="text-red-500" /> Features Menu
              </h3>
              <ul className="space-y-2 relative z-10">
                {navItems.map(item => {
                  const isActive = activeSection === item.id;
                  return (
                    <li key={item.id}>
                      <a 
                        href={`#${item.id}`}
                        className={`flex items-center gap-3 px-4 py-3 rounded-2xl font-bold transition-all duration-300 ${
                          isActive 
                            ? 'bg-gradient-to-r from-red-600 to-red-700 text-white shadow-[0_0_20px_rgba(239,68,68,0.3)] border border-red-500/50' 
                            : 'text-neutral-400 hover:text-white hover:bg-neutral-800/80 border border-transparent'
                        }`}
                      >
                        <span className={isActive ? 'text-white' : 'text-neutral-500'}>
                          {item.icon}
                        </span>
                        {item.label}
                        {isActive && <ChevronRight size={16} className="ml-auto opacity-70" />}
                      </a>
                    </li>
                  );
                })}
              </ul>
            </div>
          </div>

          {/* Content */}
          <div className="lg:col-span-3 space-y-12">
            
            {/* Feature 1 */}
            <GuideSection 
              id="race-progression" 
              title="Race Progression (Gap to Leader)" 
              icon={<Activity size={28} />} 
              colorClass="orange"
              setActiveSection={setActiveSection}
            >
              <p className="text-lg">
                Found in the <strong>Race Details</strong> page, the Race Progression chart is arguably the most powerful tool for analyzing race pace and strategy. Instead of just showing positions, it plots the <strong>time gap (in seconds)</strong> between every driver and the race leader across all laps.
              </p>
              <div className="bg-neutral-950/80 border border-neutral-800/80 p-6 rounded-2xl my-8 shadow-inner">
                <h4 className="text-white font-bold mb-4 flex items-center gap-2 text-xl">
                  <Zap size={20} className="text-yellow-500"/> How to read it:
                </h4>
                <ul className="space-y-4 text-base list-none pl-0">
                  <li className="flex gap-3"><span className="text-neutral-500 mt-1">▶</span> <span><strong className="text-white bg-neutral-800 px-2 py-0.5 rounded">Flat / Horizontal Line:</strong> The driver is matching the leader's pace exactly.</span></li>
                  <li className="flex gap-3"><span className="text-neutral-500 mt-1">▶</span> <span><strong className="text-red-400 bg-red-900/20 px-2 py-0.5 rounded">Line Going Up:</strong> The driver is losing time to the leader (e.g. tyre degradation, stuck in traffic).</span></li>
                  <li className="flex gap-3"><span className="text-neutral-500 mt-1">▶</span> <span><strong className="text-green-400 bg-green-900/20 px-2 py-0.5 rounded">Line Going Down:</strong> The driver is catching the leader (setting faster lap times).</span></li>
                  <li className="flex gap-3"><span className="text-neutral-500 mt-1">▶</span> <span><strong className="text-blue-400 bg-blue-900/20 px-2 py-0.5 rounded">Sudden Sharp Spike Up:</strong> The driver made a Pit Stop (losing ~20-25 seconds).</span></li>
                </ul>
              </div>
              <p className="border-l-4 border-red-500 pl-4 py-2 bg-red-500/5 rounded-r-xl italic text-neutral-400">
                <strong className="text-white not-italic">Pro Tip:</strong> Look for the "Undercut". If a driver pits early, their line spikes up. But if their line then starts dropping rapidly (because of fresh tyres) while their rival stays out on old tyres (line going up), you can visually see the undercut working!
              </p>
            </GuideSection>

            {/* Feature 2 */}
            <GuideSection 
              id="telemetry" 
              title="Lap Telemetry Analysis" 
              icon={<GitCommitVertical size={28} />} 
              colorClass="blue"
              setActiveSection={setActiveSection}
            >
              <p className="text-lg">
                Access the <strong>Telemetry</strong> tab to compare the fastest laps of any two drivers overlaid on top of each other. This is exactly what engineers look at to see <em>where</em> a driver is losing time.
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-8">
                <div className="bg-neutral-900/50 p-5 rounded-2xl border border-neutral-800">
                  <h5 className="font-bold text-white mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-yellow-500"/> Delta Time</h5>
                  <p className="text-sm text-neutral-400">A yellow line showing the exact time gap at every meter of the track.</p>
                </div>
                <div className="bg-neutral-900/50 p-5 rounded-2xl border border-neutral-800">
                  <h5 className="font-bold text-white mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500"/> Speed Trace</h5>
                  <p className="text-sm text-neutral-400">See who breaks later and who carries more speed through the apex.</p>
                </div>
                <div className="bg-neutral-900/50 p-5 rounded-2xl border border-neutral-800">
                  <h5 className="font-bold text-white mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-orange-500"/> Throttle & Brake</h5>
                  <p className="text-sm text-neutral-400">Analyze driving styles (e.g., trail braking vs sudden braking).</p>
                </div>
                <div className="bg-neutral-900/50 p-5 rounded-2xl border border-neutral-800">
                  <h5 className="font-bold text-white mb-2 flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-purple-500"/> Gear Selection</h5>
                  <p className="text-sm text-neutral-400">See if a driver takes a corner in 3rd vs 4th gear to minimize wheelspin.</p>
                </div>
              </div>
            </GuideSection>

            {/* Feature 3 */}
            <GuideSection 
              id="speed-sectors" 
              title="Speed & Sectors Matrix" 
              icon={<Flag size={28} />} 
              colorClass="purple"
              setActiveSection={setActiveSection}
            >
              <p className="text-lg">
                In the Race Details page, the <strong>Speed & Sectors</strong> tab reveals the ultimate potential of the car. It tracks the <strong>Speed Trap (Top Speed)</strong> to show who has the most aerodynamic efficiency or engine power on the straights.
              </p>
              <div className="mt-8 p-6 bg-purple-500/5 border border-purple-500/20 rounded-2xl">
                <p className="text-lg leading-relaxed">
                  The <strong>Sector Matrix</strong> combines each driver's absolute best Sector 1, Sector 2, and Sector 3 times into an "Ideal Lap". You can compare this Ideal Lap against their Actual Fastest Lap to see how much time they left on the table due to mistakes or traffic. 
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <span className="px-3 py-1 bg-purple-500/20 text-purple-400 font-bold rounded-lg border border-purple-500/30">Purple text</span>
                  <span className="text-sm text-neutral-400">indicates the absolute fastest sector of the entire session.</span>
                </div>
              </div>
            </GuideSection>

            {/* Feature 4 */}
            <GuideSection 
              id="tyre-strategy" 
              title="Tyre Strategy" 
              icon={<AlertCircle size={28} />} 
              colorClass="zinc"
              setActiveSection={setActiveSection}
            >
              <p className="text-lg">
                A visual timeline of every driver's tyre choices. See exactly which compound they started on, how many laps they pushed it, and when they pitted.
              </p>
              <div className="flex flex-wrap gap-3 mt-8">
                <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <span className="w-4 h-4 rounded-full bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]"/> <span className="font-bold text-sm">Soft</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <span className="w-4 h-4 rounded-full bg-yellow-400 shadow-[0_0_10px_rgba(250,204,21,0.5)]"/> <span className="font-bold text-sm">Medium</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <span className="w-4 h-4 rounded-full bg-white shadow-[0_0_10px_rgba(255,255,255,0.5)]"/> <span className="font-bold text-sm text-neutral-300">Hard</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <span className="w-4 h-4 rounded-full bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.5)]"/> <span className="font-bold text-sm">Inter</span>
                </div>
                <div className="flex items-center gap-2 px-4 py-2 bg-neutral-900 border border-neutral-800 rounded-xl">
                  <span className="w-4 h-4 rounded-full bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]"/> <span className="font-bold text-sm">Wet</span>
                </div>
              </div>
            </GuideSection>

            {/* Feature 5 */}
            <GuideSection 
              id="simulator" 
              title="Championship Simulator" 
              icon={<Calculator size={28} />} 
              colorClass="emerald"
              setActiveSection={setActiveSection}
            >
              <p className="text-lg">
                Want to know if a driver can mathematically win the championship? Go to the <strong>Simulator</strong>. We fetch the live points standings and remaining races, and let you input custom race results (P1, P2, P3, Fastest Lap, etc.) for upcoming rounds.
              </p>
              <div className="mt-8 p-6 bg-gradient-to-br from-emerald-900/20 to-neutral-900 border border-emerald-500/20 rounded-2xl">
                <div className="flex items-start gap-4">
                  <Calculator className="text-emerald-500 mt-1 flex-shrink-0" size={24} />
                  <p className="text-emerald-100/70 text-lg leading-relaxed">
                    The tool instantly recalculates the championship points to show you if a comeback is mathematically possible based on the maximum points available in Sprints and Main races.
                  </p>
                </div>
              </div>
            </GuideSection>

          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-neutral-900 bg-[#020202] py-12 px-6 text-center mt-12 relative overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-96 h-1 bg-gradient-to-r from-transparent via-red-600 to-transparent" />
        <p className="text-neutral-500 text-sm font-bold uppercase tracking-wider mb-2">
          Formula 1 Analytics Hub &copy; {new Date().getFullYear()}
        </p>
        <p className="text-neutral-700 text-xs">
          Built for true motorsport enthusiasts.
        </p>
      </footer>
    </div>
  );
};

export default GuidePage;
