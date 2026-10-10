import { useState, useEffect } from 'react';
import { Activity, CloudRain, Wind, Thermometer, Radio, Flag, Zap } from 'lucide-react';
import { API_URL } from '../config';
import TyreStrategy from '../components/ui/TyreStrategy';
import { LiveTimingData } from '../types/f1';

const teamColors: Record<string, string> = {
  "Red Bull Racing": "#3671C6",
  "McLaren": "#FF8000",
  "Ferrari": "#E8002D",
  "Mercedes": "#27F4D2",
  "Aston Martin": "#229971",
  "Racing Bulls": "#6692FF",
  "Haas F1 Team": "#B6BABD",
  "Williams": "#64C4FF",
  "Alpine": "#0093CC",
  "Audi": "#F40000",
  "Cadillac": "#D4AF37"
};

interface TyreIconProps {
  compound: 'S' | 'M' | 'H' | 'I' | 'W' | '' | string;
  age: number | string;
}

const TyreIcon: React.FC<TyreIconProps> = ({ compound, age }) => {
  let bg = 'bg-gray-500';
  let text = 'text-white';
  if (compound === 'S') { bg = 'bg-red-500'; }
  else if (compound === 'M') { bg = 'bg-yellow-400'; text = 'text-black'; }
  else if (compound === 'H') { bg = 'bg-white'; text = 'text-black'; }
  else if (compound === 'I') { bg = 'bg-green-500'; }
  else if (compound === 'W') { bg = 'bg-blue-500'; }

  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-black ${bg} ${text}`}>
        {compound}
      </div>
      <span className="text-[10px] text-neutral-400">{age}L</span>
    </div>
  );
};

const SectorTime: React.FC<{ time: string, color: string }> = ({ time, color }) => {
  let colorClass = 'text-neutral-500'; // default yellow-ish text for no improvement in some screens, but standard is neutral
  let glowClass = '';
  
  if (color === 'purple') {
    colorClass = 'text-purple-400';
    glowClass = 'drop-shadow-[0_0_6px_rgba(168,85,247,0.8)]';
  } else if (color === 'green') {
    colorClass = 'text-green-400';
    glowClass = 'drop-shadow-[0_0_6px_rgba(74,222,128,0.8)]';
  } else if (color === 'yellow') {
    colorClass = 'text-yellow-400';
  }

  return <span className={`font-mono font-bold ${colorClass} ${glowClass}`}>{time}</span>;
};

const LiveTimingPage: React.FC = () => {
  const [data, setData] = useState<LiveTimingData>({
    lines: [],
    trackStatus: 'GREEN',
    weather: { air: '--', track: '--', humidity: '--', rain: '--' },
    messages: [],
    isLiveSession: false
  });
  const [connectionStatus, setConnectionStatus] = useState<'connecting' | 'connected' | 'lost'>('connecting');

  useEffect(() => {
    let ws: WebSocket | null = null;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;
    let disposed = false;
    let attempt = 0;

    const connect = () => {
      if (disposed) return;
      // Close any previous socket before opening a new one, otherwise a
      // flaky connection stacks parallel WebSockets and reconnect timers,
      // each triggering a backend live-session check. This was a connection
      // leak: reconnectTimer was reassigned without being cleared first.
      if (ws) {
        ws.onclose = null;
        ws.close();
        ws = null;
      }

      setConnectionStatus(prev => prev === 'connected' ? 'lost' : 'connecting');
      const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const wsHost = API_URL.replace(/^https?:\/\//, '');
      const wsUrl = `${wsProtocol}//${wsHost}/ws/livetiming`;

      ws = new WebSocket(wsUrl);

      ws.onopen = () => {
        attempt = 0;
        setConnectionStatus('connected');
      };
      
      ws.onmessage = (event: MessageEvent) => {
        const msg = JSON.parse(event.data);
        if (msg.type === 'TimingData') {
          setData(prev => ({
            lines: msg.lines || prev.lines,
            trackStatus: msg.trackStatus || prev.trackStatus,
            weather: msg.weather || prev.weather,
            messages: msg.messages || prev.messages,
            isLiveSession: msg.is_live_session
          }));
        }
      };
      
      ws.onclose = () => {
        setConnectionStatus('lost');
        // Exponential backoff, capped at 30s, so a hard-down backend is not
        // hammered with reconnect attempts.
        const delay = Math.min(3000 * 2 ** attempt, 30000);
        attempt += 1;
        reconnectTimer = setTimeout(connect, delay);
      };
    };

    connect();
    return () => {
      disposed = true;
      clearTimeout(reconnectTimer);
      if (ws) {
        ws.onclose = null;
        ws.close();
      }
    };
  }, []);

  const getStatusColor = (status: string) => {
    if (status.includes('YELLOW')) return 'bg-yellow-500 text-black';
    if (status.includes('RED')) return 'bg-red-600 text-white animate-pulse';
    if (status.includes('SC') || status.includes('VSC')) return 'bg-orange-500 text-white';
    return 'bg-green-500 text-black';
  };

  const sortedLines = [...data.lines].sort((a, b) => {
    const posA = parseInt(String(a.position));
    const posB = parseInt(String(b.position));
    if (isNaN(posA) && isNaN(posB)) return 0;
    if (isNaN(posA)) return 1;
    if (isNaN(posB)) return -1;
    return posA - posB;
  });

  return (
    <div className="bg-black min-h-screen text-white font-mono selection:bg-red-600 w-full overflow-hidden" style={{ overflowAnchor: 'none' }}>
      <main className="w-full max-w-[1920px] mx-auto px-2 md:px-4 lg:px-8 pt-24 pb-10">
        
        {/* Header Bar */}
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-6 gap-4 border-b border-[#222] pb-4">
          <div>
            <div className={`inline-flex items-center gap-2 border text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-sm mb-2 ${connectionStatus === 'connected' ? (data.isLiveSession ? 'bg-red-600/10 border-red-500/30 text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.2)]' : 'bg-blue-600/10 border-blue-500/30 text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.2)]') : 'bg-yellow-500/10 border-yellow-500/30 text-yellow-500 shadow-[0_0_15px_rgba(234,179,8,0.2)]'}`}>
              <Activity size={12} className={connectionStatus === 'connected' ? 'animate-pulse' : ''} /> 
              {connectionStatus === 'connecting' ? 'AWAITING CONNECTION...' : connectionStatus === 'lost' ? 'CONNECTION LOST - RECONNECTING...' : data.isLiveSession ? 'LIVE SIGNAL DETECTED' : 'SIMULATED TELEMETRY (DEMO)'}
            </div>
            <h1 className="text-4xl font-black tracking-tighter uppercase flex items-center gap-2">
              Pit Wall <span className="text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500">Telemetry</span>
            </h1>
          </div>
          
          <div className="flex flex-wrap items-center gap-4 text-[10px] font-bold bg-[#0a0a0a] border border-[#222] rounded-md px-4 py-2 uppercase tracking-wider shadow-inner w-full md:w-auto">
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-purple-500 shadow-[0_0_8px_rgba(168,85,247,1)]"></div> Overall Best</span>
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_8px_rgba(74,222,128,1)]"></div> Personal Best</span>
            <span className="flex items-center gap-1.5"><div className="w-2 h-2 rounded-full bg-yellow-400"></div> No Improvement</span>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          
          {/* Main Timing Table (Left 3 cols) */}
          <div className="lg:col-span-3 bg-[#080808] border border-[#1a1a1a] rounded-xl overflow-hidden shadow-2xl flex flex-col relative min-w-0">
            {/* Glossy top highlight */}
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent"></div>
            
            <div className="overflow-x-auto flex-1">
              <table className="w-full text-[13px] tracking-tight">
                <thead className="bg-[#0f0f0f] text-neutral-500 font-black text-left border-b border-[#222] shadow-sm">
                  <tr>
                    <th className="p-3 w-10 text-center border-r border-[#1a1a1a]">P</th>
                    <th className="p-3 min-w-[140px] border-r border-[#1a1a1a]">DRIVER</th>
                    <th className="p-3 w-20 border-r border-[#1a1a1a]">TYRE</th>
                    <th className="p-3 w-20 text-right border-r border-[#1a1a1a]">GAP</th>
                    <th className="p-3 w-20 text-right border-r border-[#1a1a1a]">INT</th>
                    <th className="p-3 w-24 text-right border-r border-[#1a1a1a]">LAST LAP</th>
                    <th className="p-3 w-16 text-center border-r border-[#1a1a1a]">S1</th>
                    <th className="p-3 w-16 text-center border-r border-[#1a1a1a]">S2</th>
                    <th className="p-3 w-16 text-center border-r border-[#1a1a1a]">S3</th>
                    <th className="p-3 w-12 text-center">PITS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#151515]">
                  {sortedLines.length > 0 ? sortedLines.map((row) => (
                    <tr key={row.driver} className="hover:bg-[#111] transition-colors group relative">
                      <td className="p-2.5 text-center font-black text-neutral-500 border-r border-[#151515]">{row.position}</td>
                      
                      <td className="p-2.5 font-black text-white text-[14px] border-r border-[#151515] flex items-center gap-2">
                        <div className="w-1 h-5 rounded-sm shadow-sm" style={{ backgroundColor: teamColors[row.team] || '#fff' }}></div>
                        {row.driver}
                        {row.status === 'PIT' && <span className="ml-2 px-1 py-0.5 bg-red-600/20 text-red-500 border border-red-500/30 text-[9px] rounded-sm animate-pulse uppercase tracking-wider">IN PIT</span>}
                        {row.status !== 'PIT' && row.interval && !isNaN(parseFloat(row.interval)) && parseFloat(row.interval) < 1.0 && (
                          <span className="ml-1 px-1 py-0.5 bg-cyan-500/20 text-cyan-400 border border-cyan-500/30 text-[9px] rounded-sm uppercase tracking-wider drop-shadow-[0_0_5px_rgba(34,211,238,0.5)]" title="Manual Override Available">
                            OVR
                          </span>
                        )}
                      </td>
                      <td className="p-2.5 border-r border-[#151515]">
                        <TyreIcon compound={row.tyre} age={row.tyre_age} />
                      </td>
                      <td className="p-2.5 text-right text-neutral-300 font-mono border-r border-[#151515]">{row.gap}</td>
                      <td className="p-2.5 text-right text-neutral-400 font-mono border-r border-[#151515]">{row.interval}</td>
                      <td className="p-2.5 text-right border-r border-[#151515] bg-[#0c0c0c] group-hover:bg-[#151515] transition-colors shadow-inner">
                        <SectorTime time={row.lastLap} color={row.lap_color} />
                      </td>
                      <td className="p-2.5 text-center border-r border-[#151515]">
                        <SectorTime time={row.sector1} color={row.s1_color} />
                      </td>
                      <td className="p-2.5 text-center border-r border-[#151515]">
                        <SectorTime time={row.sector2} color={row.s2_color} />
                      </td>
                      <td className="p-2.5 text-center border-r border-[#151515]">
                        <SectorTime time={row.sector3} color={row.s3_color} />
                      </td>
                      <td className="p-2.5 text-center text-neutral-600 font-mono font-bold">{row.pits}</td>
                    </tr>
                  )) : (
                    Array.from({length: 20}).map((_, i) => (
                      <tr key={i} className="animate-pulse h-[36px]">
                        <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-[#222] rounded w-4 mx-auto"></div></td>
                        <td className="p-2 border-r border-[#1a1a1a]"><div className="h-4 bg-[#222] rounded w-16"></div></td>
                        <td className="p-2 border-r border-[#1a1a1a]"><div className="h-4 bg-[#222] rounded w-10"></div></td>
                        <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-[#222] rounded w-12 ml-auto"></div></td>
                        <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-[#222] rounded w-10 ml-auto"></div></td>
                        <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-[#222] rounded w-14 ml-auto"></div></td>
                        <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-[#222] rounded w-10 mx-auto"></div></td>
                        <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-[#222] rounded w-10 mx-auto"></div></td>
                        <td className="p-2 border-r border-[#1a1a1a]"><div className="h-3 bg-[#222] rounded w-10 mx-auto"></div></td>
                        <td className="p-2"><div className="h-3 bg-[#222] rounded w-4 mx-auto"></div></td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Right Sidebar */}
          <div className="lg:col-span-1 flex flex-col gap-6">
            
            {/* Track Map */}
            <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-5 shadow-xl relative overflow-hidden flex flex-col items-center">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent"></div>
              <h3 className="text-[10px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-4 w-full">
                <Activity size={14} /> Track Map Simulation
              </h3>
              <div className="relative w-full aspect-[2/1] bg-[#050505] rounded-lg border border-[#151515] flex items-center justify-center overflow-hidden shadow-inner">
                <svg viewBox="0 0 300 150" className="w-full h-full">
                  {/* Track outline */}
                  <ellipse cx="150" cy="75" rx="120" ry="50" fill="none" stroke="#111" strokeWidth="12" />
                  <ellipse cx="150" cy="75" rx="120" ry="50" fill="none" stroke="#333" strokeWidth="2" strokeDasharray="4 4" />
                  
                  {/* Start/Finish line */}
                  <line x1="150" y1="20" x2="150" y2="30" stroke="white" strokeWidth="2" />
                  <text x="150" y="15" fontSize="6" fill="#666" textAnchor="middle" className="font-mono">START</text>
                  
                  {sortedLines.filter(d => d.status === 'TRACK' || d.status === 'OUT').map(d => {
                     // Using ellipse math for positions
                     const progress = d.progress || 0;
                     const theta = (progress - 0.25) * 2 * Math.PI; 
                     const x = 150 + 120 * Math.cos(theta);
                     const y = 75 + 50 * Math.sin(theta);
                     
                     return (
                       <g key={d.driver} style={{ transform: `translate(${x}px, ${y}px)`, transition: 'all 2s linear' }}>
                         <circle r="4" fill={teamColors[d.team] || '#fff'} className="drop-shadow-lg" />
                         <text y="-6" fontSize="7" fill="#fff" textAnchor="middle" className="font-mono font-black" style={{ textShadow: '0px 1px 2px black, 0px 0px 4px rgba(0,0,0,0.8)' }}>
                           {d.driver}
                         </text>
                       </g>
                     )
                  })}
                </svg>
              </div>
            </div>

            {/* Track Status */}
            <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent"></div>
              <h3 className="text-[10px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-4">
                <Flag size={14} /> Track Status
              </h3>
              <div className={`w-full py-3 rounded-md font-black text-center text-xl tracking-widest shadow-inner border border-black/50 ${getStatusColor(data.trackStatus)}`}>
                {data.trackStatus}
              </div>
            </div>

            {/* Weather */}
            <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-5 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent"></div>
              <h3 className="text-[10px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-4">
                <CloudRain size={14} /> Local Conditions
              </h3>
              <div className="grid grid-cols-2 gap-4">
                <div className="bg-[#0a0a0a] p-3 rounded border border-[#151515]">
                  <div className="text-[9px] text-neutral-500 mb-1 font-bold tracking-wider">AIR TEMP</div>
                  <div className="font-bold flex items-center gap-2 text-md"><Thermometer size={14} className="text-red-500"/> {data.weather.air}</div>
                </div>
                <div className="bg-[#0a0a0a] p-3 rounded border border-[#151515]">
                  <div className="text-[9px] text-neutral-500 mb-1 font-bold tracking-wider">TRACK TEMP</div>
                  <div className="font-bold flex items-center gap-2 text-md"><Thermometer size={14} className="text-orange-500"/> {data.weather.track}</div>
                </div>
                <div className="bg-[#0a0a0a] p-3 rounded border border-[#151515]">
                  <div className="text-[9px] text-neutral-500 mb-1 font-bold tracking-wider">HUMIDITY</div>
                  <div className="font-bold flex items-center gap-2 text-md"><Wind size={14} className="text-blue-500"/> {data.weather.humidity}</div>
                </div>
                <div className="bg-[#0a0a0a] p-3 rounded border border-[#151515]">
                  <div className="text-[9px] text-neutral-500 mb-1 font-bold tracking-wider">RAIN RISK</div>
                  <div className="font-bold flex items-center gap-2 text-md"><CloudRain size={14} className="text-cyan-500"/> {data.weather.rain}</div>
                </div>
              </div>
            </div>

            {/* Tyre Strategy */}
            <TyreStrategy timingData={sortedLines} />

          </div>
        </div>

        {/* Bottom Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
          {/* Speed Trap (Dummy) */}
          <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-5 shadow-xl relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent"></div>
            <h3 className="text-[10px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-4">
              <Zap size={14} /> Speed Trap (Max)
            </h3>
            <div className="space-y-2">
              {sortedLines.slice(0, 3).map((d, i) => {
                 const speed = (342.5 - (i * 2.3 + (d.driver.length % 3))).toFixed(1);
                 return (
                   <div key={i} className="flex justify-between items-center bg-[#0a0a0a] p-2 rounded border border-[#151515]">
                     <span className="font-bold text-xs text-neutral-300">{d.driver}</span>
                     <span className="font-mono text-sm font-black text-purple-400 drop-shadow-[0_0_5px_rgba(168,85,247,0.8)]">
                       {speed} km/h
                     </span>
                   </div>
                 );
              })}
            </div>
          </div>

          {/* Race Control Messages */}
          <div className="bg-[#080808] border border-[#1a1a1a] rounded-xl p-4 flex flex-col shadow-xl h-48 relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-neutral-500/20 to-transparent"></div>
            <h3 className="text-[10px] text-neutral-500 uppercase font-black tracking-widest flex items-center gap-2 mb-2">
              <Radio size={14} /> Race Control Log
            </h3>
            <div className="flex-1 overflow-y-auto pr-3 space-y-2 font-mono text-[10px] custom-scrollbar">
              {data.messages.length > 0 ? data.messages.map((m, idx) => (
                <div key={idx} className="flex flex-col py-1.5 border-b border-[#151515] last:border-0 group hover:bg-[#0a0a0a] transition-colors rounded px-1">
                  <span className="text-neutral-600 font-bold">{m.time}</span>
                  <span className={`font-black tracking-wide ${m.type === 'pit' ? 'text-blue-400' : m.type === 'flag' ? 'text-yellow-400' : 'text-neutral-300'}`}>
                    {m.msg}
                  </span>
                </div>
              )) : (
                <div className="text-neutral-600 font-bold flex items-center justify-center h-full">Monitoring radio channels...</div>
              )}
            </div>
          </div>
        </div>
      </main>
    </div>
  );
};

export default LiveTimingPage;
