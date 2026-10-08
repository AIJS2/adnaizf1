import React, { useState, useEffect } from 'react';
import Navbar from './Navbar';
import { API_URL } from './config';
import { teamColors } from './data/teamData';
import { Calculator, Trophy, ArrowUp, ArrowDown, Minus, RefreshCw, Zap, Flag, FlaskConical, Activity, Crosshair } from 'lucide-react';

const SimulatorPage = () => {
  const [originalDrivers, setOriginalDrivers] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [loading, setLoading] = useState(true);

  // Simulation inputs
  const [p1, setP1] = useState('');
  const [p2, setP2] = useState('');
  const [p3, setP3] = useState('');
  const [fastestLap, setFastestLap] = useState('');

  const currentYear = new Date().getFullYear();

  useEffect(() => {
    const fetchStandings = async () => {
      try {
        const response = await fetch(`${API_URL}/api/championship/${currentYear}`);
        const data = await response.json();
        if (data.drivers) {
          const sorted = data.drivers.sort((a, b) => b.points - a.points);
          sorted.forEach((d, i) => d.position = i + 1);
          setOriginalDrivers(sorted);
          setDrivers(JSON.parse(JSON.stringify(sorted)));
        }
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchStandings();
  }, [currentYear]);

  const simulate = () => {
    let simulated = JSON.parse(JSON.stringify(originalDrivers));

    // Apply predictions
    if (p1) {
      let d = simulated.find(x => x.id === p1);
      if (d) { d.points += 25; d.wins += 1; d.podiums += 1; }
    }
    if (p2) {
      let d = simulated.find(x => x.id === p2);
      if (d) { d.points += 18; d.podiums += 1; }
    }
    if (p3) {
      let d = simulated.find(x => x.id === p3);
      if (d) { d.points += 15; d.podiums += 1; }
    }
    if (fastestLap) {
      let d = simulated.find(x => x.id === fastestLap);
      if (d) { d.points += 1; }
    }

    // Re-sort
    simulated.sort((a, b) => b.points - a.points);
    // Re-assign position
    simulated.forEach((d, i) => d.position = i + 1);

    setDrivers(simulated);
  };

  const reset = () => {
    setP1(''); setP2(''); setP3(''); setFastestLap('');
    setDrivers(JSON.parse(JSON.stringify(originalDrivers)));
  };

  return (
    <div className="bg-neutral-950 min-h-screen text-white font-sans relative">
      {/* Dynamic F1 Background Image */}
      <div className="fixed inset-0 bg-[url('https://images.unsplash.com/photo-1532938911079-1b06ac7ceec7?q=80&w=2000&auto=format&fit=crop')] bg-cover bg-center bg-no-repeat opacity-[0.15] pointer-events-none mix-blend-luminosity"></div>
      
      {/* Background Grid & Gradients */}
      <div className="fixed inset-0 bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')] opacity-10 pointer-events-none mix-blend-overlay"></div>
      <div className="fixed inset-0 bg-gradient-to-b from-red-900/20 via-neutral-950/80 to-neutral-950 pointer-events-none"></div>

      <Navbar />
      <main className="container mx-auto px-4 md:px-6 pt-28 pb-16 relative z-10">
        
        {/* Header */}
        <div className="mb-10 relative">
          <div className="absolute -left-10 -top-10 w-32 h-32 bg-red-500/20 blur-[60px] rounded-full pointer-events-none"></div>
          <h1 className="text-5xl md:text-6xl font-black tracking-tight flex items-center gap-3 italic transform -skew-x-6">
            <Calculator className="text-red-500 drop-shadow-[0_0_15px_rgba(239,68,68,0.5)]" size={46} />
            Championship <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Simulator</span>
          </h1>
          <p className="text-neutral-400 mt-2 text-lg font-medium max-w-2xl">
            Test "What-If" scenarios. Predict the next race podium, fastest lap, and watch the championship standings dynamically recalculate.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* Left Panel: Inputs */}
          <div className="lg:col-span-4 bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-[0_0_30px_rgba(0,0,0,0.5)] h-fit relative overflow-hidden">
            <div className="absolute top-0 right-0 w-64 h-64 bg-red-500/5 blur-[100px] rounded-full pointer-events-none"></div>
            
            <h3 className="text-2xl font-black mb-6 flex items-center gap-2 uppercase tracking-tight italic border-b border-white/10 pb-4 text-white">
              <FlaskConical className="text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" size={24} /> 
              Strategy Command
            </h3>
            
            <div className="space-y-5 relative z-10">
              
              {/* P1 Input */}
              <div className="relative group">
                <label className="block text-[11px] uppercase font-black text-neutral-400 mb-1.5 tracking-widest flex justify-between">
                  <span className="flex items-center gap-1"><Trophy size={12} className="text-yellow-400" /> P1 Winner</span> <span className="text-yellow-400 drop-shadow-[0_0_5px_rgba(250,204,21,0.8)]">+25 PTS</span>
                </label>
                <div className="absolute inset-0 bg-yellow-500/20 blur-xl rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                <select value={p1} onChange={e => setP1(e.target.value)} className="relative w-full bg-neutral-950/90 border border-white/10 hover:border-yellow-500/50 rounded-xl p-3.5 text-white font-bold outline-none focus:border-yellow-400 focus:ring-4 focus:ring-yellow-400/20 transition-all shadow-inner appearance-none cursor-pointer">
                  <option value="">-- Select P1 --</option>
                  {originalDrivers.map(d => <option key={`p1-${d.id}`} value={d.id}>{d.name} ({d.team})</option>)}
                </select>
              </div>

              {/* P2 Input */}
              <div className="relative group">
                <label className="block text-[11px] uppercase font-black text-neutral-400 mb-1.5 tracking-widest flex justify-between">
                  <span className="flex items-center gap-1"><Crosshair size={12} className="text-slate-300" /> P2 Runner-up</span> <span className="text-slate-300 drop-shadow-[0_0_5px_rgba(203,213,225,0.8)]">+18 PTS</span>
                </label>
                <div className="absolute inset-0 bg-slate-300/20 blur-xl rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                <select value={p2} onChange={e => setP2(e.target.value)} className="relative w-full bg-neutral-950/90 border border-white/10 hover:border-slate-300/50 rounded-xl p-3.5 text-white font-bold outline-none focus:border-slate-300 focus:ring-4 focus:ring-slate-300/20 transition-all shadow-inner appearance-none cursor-pointer">
                  <option value="">-- Select P2 --</option>
                  {originalDrivers.map(d => <option key={`p2-${d.id}`} value={d.id}>{d.name} ({d.team})</option>)}
                </select>
              </div>

              {/* P3 Input */}
              <div className="relative group">
                <label className="block text-[11px] uppercase font-black text-neutral-400 mb-1.5 tracking-widest flex justify-between">
                  <span className="flex items-center gap-1"><Activity size={12} className="text-amber-500" /> P3 Podium</span> <span className="text-amber-500 drop-shadow-[0_0_5px_rgba(245,158,11,0.8)]">+15 PTS</span>
                </label>
                <div className="absolute inset-0 bg-amber-500/20 blur-xl rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                <select value={p3} onChange={e => setP3(e.target.value)} className="relative w-full bg-neutral-950/90 border border-white/10 hover:border-amber-500/50 rounded-xl p-3.5 text-white font-bold outline-none focus:border-amber-500 focus:ring-4 focus:ring-amber-500/20 transition-all shadow-inner appearance-none cursor-pointer">
                  <option value="">-- Select P3 --</option>
                  {originalDrivers.map(d => <option key={`p3-${d.id}`} value={d.id}>{d.name} ({d.team})</option>)}
                </select>
              </div>

              {/* Fastest Lap Input */}
              <div className="relative group">
                <label className="block text-[11px] uppercase font-black text-neutral-400 mb-1.5 tracking-widest flex justify-between">
                  <span className="flex items-center gap-1"><Zap size={12} className="text-purple-500" /> Fastest Lap</span> <span className="text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]">+1 PTS</span>
                </label>
                <div className="absolute inset-0 bg-purple-500/20 blur-xl rounded-xl opacity-0 group-focus-within:opacity-100 transition-opacity pointer-events-none"></div>
                <select value={fastestLap} onChange={e => setFastestLap(e.target.value)} className="relative w-full bg-neutral-950/90 border border-white/10 hover:border-purple-500/50 rounded-xl p-3.5 text-white font-bold outline-none focus:border-purple-500 focus:ring-4 focus:ring-purple-500/20 transition-all shadow-inner appearance-none cursor-pointer">
                  <option value="">-- Select Fastest Lap --</option>
                  {originalDrivers.map(d => <option key={`fl-${d.id}`} value={d.id}>{d.name} ({d.team})</option>)}
                </select>
              </div>

              <div className="pt-6 flex flex-col sm:flex-row gap-3">
                <button 
                  onClick={simulate} 
                  className="flex-1 bg-gradient-to-r from-red-600 to-red-500 hover:from-red-500 hover:to-red-400 text-white font-black py-4 rounded-xl transition-all shadow-[0_0_20px_rgba(220,38,38,0.3)] hover:shadow-[0_0_30px_rgba(220,38,38,0.6)] hover:-translate-y-0.5 flex items-center justify-center gap-2 uppercase tracking-wider text-sm border border-red-400/30"
                >
                  <Calculator size={18} /> Compute
                </button>
                <button 
                  onClick={reset} 
                  className="sm:w-1/3 bg-neutral-900/80 hover:bg-neutral-800 text-white font-bold py-4 rounded-xl transition-all flex items-center justify-center gap-2 uppercase tracking-wider text-sm border border-white/10 hover:border-white/30 backdrop-blur-sm"
                >
                  <RefreshCw size={16} /> Reset
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel: Simulated Standings */}
          <div className="lg:col-span-8">
            <div className="bg-neutral-900/60 backdrop-blur-xl border border-white/10 rounded-3xl p-6 md:p-8 shadow-[0_0_30px_rgba(0,0,0,0.5)]">
              <div className="flex items-center justify-between border-b border-white/10 pb-6 mb-6">
                <h3 className="text-2xl font-black flex items-center gap-3 italic uppercase tracking-tight text-white">
                  <Activity className="text-red-500 drop-shadow-[0_0_10px_rgba(239,68,68,0.8)]" size={28} /> 
                  Predicted Standings
                </h3>
                {p1 || p2 || p3 ? (
                  <span className="bg-red-500/20 text-red-400 border border-red-500/50 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase animate-pulse flex items-center gap-2 shadow-[0_0_10px_rgba(239,68,68,0.3)]">
                    <div className="w-2 h-2 bg-red-400 rounded-full shadow-[0_0_5px_rgba(248,113,113,1)]"></div>
                    Simulated
                  </span>
                ) : (
                  <span className="bg-neutral-800/80 border border-white/10 text-neutral-400 px-3 py-1 rounded-full text-xs font-black tracking-widest uppercase">
                    Current
                  </span>
                )}
              </div>

              {loading ? (
                <div className="space-y-3 animate-pulse">
                  {[1, 2, 3, 4, 5, 6].map(i => (
                    <div key={i} className="h-20 bg-neutral-800/50 rounded-2xl w-full border border-white/5"></div>
                  ))}
                </div>
              ) : (
                <div className="space-y-3">
                  {drivers.slice(0, 10).map((d) => {
                    const original = originalDrivers.find(o => o.id === d.id);
                    const posChange = original.position - d.position;
                    const ptsGained = d.points - original.points;
                    const teamColor = teamColors[d.team] || '#666';
                    
                    return (
                      <div 
                        key={d.id} 
                        className={`group relative bg-neutral-950/80 backdrop-blur-md border ${ptsGained > 0 ? 'border-red-500/40 bg-red-950/30' : 'border-white/5 hover:border-white/10'} rounded-2xl p-4 flex items-center gap-4 md:gap-6 transition-all duration-300 overflow-hidden shadow-lg hover:bg-neutral-900/90`}
                      >
                        {/* Team Color Bar */}
                        <div className="absolute left-0 top-0 bottom-0 w-1.5 shadow-[0_0_10px_currentColor]" style={{ backgroundColor: teamColor, color: teamColor }}></div>
                        
                        {/* Position Info */}
                        <div className="flex flex-col items-center justify-center w-12 md:w-16 ml-2">
                          <span className="text-xl md:text-3xl font-black italic text-white drop-shadow-[0_0_5px_rgba(255,255,255,0.3)]">{d.position}</span>
                          
                          {/* Position Delta */}
                          <div className="flex items-center justify-center mt-0.5">
                            {posChange > 0 ? (
                              <span className="text-green-400 font-bold text-xs flex items-center bg-green-500/20 px-1.5 py-0.5 rounded border border-green-500/40 shadow-[0_0_8px_rgba(74,222,128,0.3)]"><ArrowUp size={12} strokeWidth={3} className="mr-0.5" /> {posChange}</span>
                            ) : posChange < 0 ? (
                              <span className="text-red-500 font-bold text-xs flex items-center bg-red-500/20 px-1.5 py-0.5 rounded border border-red-500/40 shadow-[0_0_8px_rgba(239,68,68,0.3)]"><ArrowDown size={12} strokeWidth={3} className="mr-0.5" /> {Math.abs(posChange)}</span>
                            ) : (
                              <span className="text-neutral-500 font-bold text-xs"><Minus size={12} strokeWidth={3} /></span>
                            )}
                          </div>
                        </div>

                        {/* Driver Info */}
                        <div className="flex-1 min-w-0 flex flex-col justify-center">
                          <h4 className="text-lg md:text-2xl font-black uppercase italic truncate text-white drop-shadow-sm group-hover:text-red-400 transition-colors">
                            {d.name}
                          </h4>
                          <span className="text-xs md:text-sm font-bold text-neutral-400 uppercase tracking-widest truncate">{d.team}</span>
                        </div>

                        {/* Points Info */}
                        <div className="text-right flex items-center gap-4">
                          
                          {/* Points Delta Badge */}
                          <div className="w-16 md:w-20 text-right">
                            {ptsGained > 0 && (
                              <span className="inline-block bg-purple-500/20 text-purple-400 border border-purple-500/40 px-2 py-0.5 rounded text-xs md:text-sm font-black tracking-wider animate-pulse shadow-[0_0_10px_rgba(168,85,247,0.4)]">
                                +{ptsGained}
                              </span>
                            )}
                          </div>

                          <div className="w-16 md:w-24">
                            <span className="text-3xl md:text-4xl font-black italic tracking-tighter" style={{ color: ptsGained > 0 ? '#fff' : '#e5e5e5', textShadow: ptsGained > 0 ? '0 0 10px rgba(255,255,255,0.5)' : 'none' }}>
                              {d.points}
                            </span>
                            <span className="block text-[9px] md:text-[10px] text-neutral-500 font-black tracking-widest uppercase -mt-1">PTS</span>
                          </div>
                        </div>
                        
                        {/* Background subtle glow for gained points */}
                        {ptsGained > 0 && (
                          <div className="absolute -right-10 -bottom-10 w-40 h-40 bg-red-500/10 blur-[40px] rounded-full pointer-events-none"></div>
                        )}
                      </div>
                    );
                  })}
                  
                  <div className="pt-4 text-center border-t border-white/5 mt-6">
                    <p className="text-neutral-500 text-xs font-bold uppercase tracking-widest pt-2">
                      * Showing top 10 simulated standings
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
          
        </div>
      </main>
    </div>
  );
};

export default SimulatorPage;
