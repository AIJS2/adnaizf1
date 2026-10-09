import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import CountdownTimer from '../components/ui/CountdownTimer';
import { API_URL } from '../config';
import { 
  ArrowRight, Activity, Users, Calculator, Layers, 
  ChevronRight, Gauge, Trophy, Flag, Share2, Sparkles, BookOpen 
} from 'lucide-react';

function LandingPage() {
  const [isMounted, setIsMounted] = useState(false);
  const [nextRace, setNextRace] = useState(null);
  const currentYear = new Date().getFullYear();

  useEffect(() => {
    setIsMounted(true);
    fetch(`${API_URL}/api/dashboard/${currentYear}?t=${new Date().getTime()}`)
      .then(res => res.json())
      .then(data => {
        const upcoming = data?.race_analytics?.find(r => r.status === 'Upcoming') || data?.next_race_event;
        if (upcoming) {
          setNextRace(upcoming);
        }
      })
      .catch(err => console.error(err));
  }, [currentYear]);

  const features = [
    {
      id: 'dashboard',
      title: 'Command Center',
      desc: 'Real-time standings, race calendars, and season progression at a glance.',
      icon: <Trophy size={28} className="text-red-500" />,
      link: '/dashboard',
      color: 'group-hover:border-red-500/50 group-hover:shadow-[0_0_30px_rgba(239,68,68,0.15)]',
      bg: 'bg-red-500/10'
    },
    {
      id: 'telemetry',
      title: 'Telemetry Studio',
      desc: 'Overlay throttle, brake, and gear data. Analyze micro-sector deltas corner by corner.',
      icon: <Activity size={28} className="text-blue-500" />,
      link: '/races',
      color: 'group-hover:border-blue-500/50 group-hover:shadow-[0_0_30px_rgba(59,130,246,0.15)]',
      bg: 'bg-blue-500/10'
    },
    {
      id: 'compare',
      title: 'H2H Compare',
      desc: 'Pit any two drivers against each other. Generate beautiful shareable social cards.',
      icon: <Users size={28} className="text-purple-500" />,
      link: '/compare',
      color: 'group-hover:border-purple-500/50 group-hover:shadow-[0_0_30px_rgba(168,85,247,0.15)]',
      bg: 'bg-purple-500/10'
    },
    {
      id: 'simulator',
      title: 'What-If Simulator',
      desc: 'Predict the championship! Run custom race scenarios to see who takes the crown.',
      icon: <Calculator size={28} className="text-emerald-500" />,
      link: '/simulator',
      color: 'group-hover:border-emerald-500/50 group-hover:shadow-[0_0_30px_rgba(16,185,129,0.15)]',
      bg: 'bg-emerald-500/10'
    },
    {
      id: 'races',
      title: 'Race Weekends',
      desc: 'Tyre strategies, speed traps, and historical race results in one place.',
      icon: <Flag size={28} className="text-amber-500" />,
      link: '/races',
      color: 'group-hover:border-amber-500/50 group-hover:shadow-[0_0_30px_rgba(245,158,11,0.15)]',
      bg: 'bg-amber-500/10'
    },
    {
      id: 'guide',
      title: 'Platform Guide',
      desc: 'Learn how to read Race Progression charts, telemetry traces, and sector matrices.',
      icon: <BookOpen size={28} className="text-cyan-500" />,
      link: '/guide',
      color: 'group-hover:border-cyan-500/50 group-hover:shadow-[0_0_30px_rgba(6,182,212,0.15)]',
      bg: 'bg-cyan-500/10'
    }
  ];

  return (
    <div className="relative min-h-screen bg-[#050505] text-white selection:bg-red-600 selection:text-white font-sans overflow-x-hidden">
      
      {/* Dynamic Background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {/* Aggressive Slanted Grid */}
        <div 
          className="absolute inset-[-50%] opacity-[0.03] origin-center -rotate-12 scale-110" 
          style={{
            backgroundImage: `linear-gradient(to right, #ffffff 2px, transparent 2px)`,
            backgroundSize: '120px 100%'
          }} 
        />
        {/* Glow Effects */}
        <div className="absolute top-[-20%] left-1/2 -translate-x-1/2 w-[1000px] h-[600px] bg-red-600/30 blur-[150px] rounded-full opacity-60" />
      </div>

      {/* Hero Section */}
      <section className="relative z-10 min-h-[95vh] flex flex-col items-center justify-center pt-24 px-4 text-center">
        
        {/* Countdown Badge */}
        {nextRace ? (
          <div 
            className={`mb-8 inline-flex flex-col items-center gap-2 px-8 py-3 rounded-2xl bg-neutral-900/60 border border-red-900/50 backdrop-blur-xl shadow-[0_0_40px_rgba(239,68,68,0.1)] transition-all duration-1000 ease-out ${
              isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
            }`}
          >
            <div className="flex items-center gap-2 mb-1">
              <div className="w-2 h-2 rounded-full bg-red-500 animate-pulse" />
              <span className="text-[10px] font-bold tracking-[0.3em] text-red-500 uppercase">Next Race: {nextRace.name}</span>
            </div>
            <CountdownTimer targetDate={nextRace.date ? `${nextRace.date}T13:00:00Z` : "2026-11-22T06:00:00Z"} />
          </div>
        ) : (
          <div className="mb-8 h-20" /> /* Placeholder */
        )}

        {/* Massive Headline */}
        <h1 
          className={`text-6xl md:text-8xl lg:text-[11rem] font-black uppercase tracking-tighter leading-[0.8] text-white transition-all duration-1000 delay-150 ease-out flex flex-col items-center ${
            isMounted ? 'opacity-100 translate-y-0 scale-100' : 'opacity-0 translate-y-8 scale-95'
          }`}
        >
          <span className="opacity-95 -ml-8">ANALYZE</span>
          <div className="relative inline-block transform -skew-x-12 ml-12">
            <span className="absolute -inset-4 blur-[40px] opacity-40 bg-red-600 rounded-full"></span>
            <span className="relative text-transparent bg-clip-text bg-gradient-to-br from-red-500 via-red-600 to-orange-500 pr-4">
              THE APEX.
            </span>
          </div>
        </h1>

        <p 
          className={`mt-10 text-lg md:text-xl text-neutral-400 max-w-2xl font-medium leading-relaxed transition-all duration-1000 delay-300 ease-out ${
            isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          The ultimate paddock-grade analytics platform. Interactive telemetry, championship simulators, and head-to-head driver comparisons.
        </p>

        {/* CTA Buttons */}
        <div 
          className={`mt-14 flex flex-col sm:flex-row items-center gap-6 transition-all duration-1000 delay-500 ease-out ${
            isMounted ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-4'
          }`}
        >
          <Link
            to="/dashboard"
            className="group relative flex items-center justify-center gap-3 px-10 py-5 bg-red-600 text-white rounded-full font-black text-sm tracking-widest uppercase transition-all overflow-hidden shadow-[0_0_30px_rgba(220,38,38,0.4)] hover:shadow-[0_0_50px_rgba(220,38,38,0.6)] hover:scale-105"
          >
            <div className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-700 opacity-0 group-hover:opacity-100 transition-opacity duration-300 ease-out z-0" />
            <span className="relative z-10">Enter Dashboard</span>
            <ArrowRight size={20} className="relative z-10 group-hover:translate-x-1.5 transition-transform" />
          </Link>

          <button
            onClick={() => window.dispatchEvent(new KeyboardEvent('keydown', { key: 'k', ctrlKey: true, bubbles: true }))}
            className="group flex items-center justify-center gap-3 px-10 py-5 bg-neutral-900/50 backdrop-blur-md border border-neutral-700 hover:border-neutral-400 hover:bg-neutral-800 text-neutral-300 hover:text-white rounded-full font-bold text-sm tracking-widest uppercase transition-all"
          >
            <span className="opacity-70 group-hover:opacity-100 transition-opacity">Search Driver (Ctrl+K)</span>
          </button>
        </div>
      </section>

      {/* Features Grid */}
      <section className="relative z-10 py-24 px-4 md:px-6 container mx-auto">
        <div className="text-center mb-16">
          <h2 className="text-3xl md:text-5xl font-black uppercase tracking-tight text-white">
            Arsenal of Tools
          </h2>
          <p className="text-neutral-400 mt-4 max-w-xl mx-auto">
            Everything you need to break down the race weekend, from free practice to the chequered flag.
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto px-4">
          {features.map((feature, idx) => (
            <Link
              key={feature.id}
              to={feature.link}
              className={`group relative bg-neutral-900/60 border-t border-l border-neutral-800 backdrop-blur-md transition-all duration-500 overflow-hidden ${feature.color}`}
              style={{ 
                transitionDelay: `${idx * 50}ms`,
                clipPath: 'polygon(0 0, 100% 0, 100% calc(100% - 30px), calc(100% - 30px) 100%, 0 100%)' 
              }}
            >
              {/* Inner glowing effect on hover */}
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-10 transition-opacity duration-500 ${feature.bg}`} />
              
              {/* Techy Grid Lines Background */}
              <div 
                className="absolute inset-0 opacity-0 group-hover:opacity-[0.05] transition-opacity duration-700 pointer-events-none"
                style={{
                  backgroundImage: 'linear-gradient(to right, #ffffff 1px, transparent 1px), linear-gradient(to bottom, #ffffff 1px, transparent 1px)',
                  backgroundSize: '20px 20px'
                }}
              />

              <div className="relative p-8 z-10 flex flex-col h-full">
                <div className={`w-14 h-14 rounded-xl flex items-center justify-center mb-6 border border-white/10 group-hover:scale-110 transition-transform duration-500 shadow-lg ${feature.bg}`}>
                  {feature.icon}
                </div>
                <h3 className="text-xl font-black text-white mb-3 tracking-tight uppercase">
                  {feature.title}
                </h3>
                <p className="text-sm text-neutral-400 font-medium leading-relaxed mb-8 group-hover:text-neutral-300 transition-colors">
                  {feature.desc}
                </p>
                
                <div className="mt-auto flex items-center justify-between">
                  <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 group-hover:translate-x-2 transition-all duration-300">
                    <span className="text-xs font-bold uppercase tracking-[0.2em] text-white">Launch Tool</span>
                    <ArrowRight size={16} className="text-white" />
                  </div>
                </div>
              </div>
              
              {/* Aggressive Corner Cut Indicator */}
              <div className="absolute bottom-0 right-0 w-[30px] h-[30px] bg-neutral-800 group-hover:bg-red-600 transition-colors duration-500" 
                   style={{ clipPath: 'polygon(100% 0, 100% 100%, 0 100%)' }} />
            </Link>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="relative z-10 border-t border-neutral-900 bg-neutral-950/50 py-12 px-6">
        <div className="container mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="text-2xl font-black tracking-widest text-white">
            ANA<span className="text-red-600">LYZIZ</span>
          </div>
          <div className="flex gap-6 text-xs font-bold uppercase tracking-wider text-neutral-500">
            <Link to="/dashboard" className="hover:text-white transition-colors">Dashboard</Link>
            <Link to="/races" className="hover:text-white transition-colors">Telemetry</Link>
            <Link to="/simulator" className="hover:text-white transition-colors">Simulator</Link>
            <Link to="/compare" className="hover:text-white transition-colors">Compare</Link>
          </div>
        </div>
      </footer>

    </div>
  );
}

export default LandingPage;
