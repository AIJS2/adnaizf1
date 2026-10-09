import React from 'react';
import { Trophy, Clock, Flag, AlertTriangle, Target, Zap, Activity, Navigation, Thermometer, Droplets, CloudRain } from 'lucide-react';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';

const RaceControlMessagesComponent = ({ messages, status }) => {
  if (!messages || messages.length === 0) {
    return <div className="p-6 text-neutral-500 italic">No race control messages available.</div>;
  }

  const isLive = status === 'Ongoing';

  const getFlagColor = (flag) => {
    const f = flag?.toUpperCase() || '';
    if (f.includes('RED')) return 'bg-red-500 shadow-[0_0_10px_rgba(239,68,68,0.6)] text-white';
    if (f.includes('YELLOW')) return 'bg-yellow-500 shadow-[0_0_10px_rgba(234,179,8,0.6)] text-black';
    if (f.includes('GREEN')) return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] text-white';
    if (f.includes('BLUE')) return 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.6)] text-white';
    if (f.includes('BLACK')) return 'bg-neutral-900 border border-neutral-700 text-white';
    if (f.includes('CHEQUERED')) return 'bg-[url("data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+PHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjZmZmIi8+PHJlY3QgeD0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzAwMCIvPjxyZWN0IHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMwMDAiLz48cmVjdCB4PSIxMCIgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iI2ZmZiIvPjwvc3ZnPg==")] text-white shadow-[0_0_10px_rgba(255,255,255,0.6)] drop-shadow-[0_1px_1px_rgba(0,0,0,1)]';
    if (f === 'CLEAR') return 'bg-green-500 shadow-[0_0_10px_rgba(34,197,94,0.6)] text-white';
    return 'bg-neutral-700 text-white';
  };

  const getCategoryIcon = (cat) => {
    const c = cat?.toUpperCase() || '';
    if (c.includes('FLAG')) return <Flag size={14} />;
    if (c.includes('CAR')) return <Activity size={14} />;
    if (c.includes('OTHER')) return <AlertTriangle size={14} />;
    return <AlertTriangle size={14} />;
  };

  return (
    <div className="p-6 h-[500px] flex flex-col bg-neutral-950/80 rounded-xl border border-neutral-800">
      <div className="mb-4 flex items-center justify-between border-b border-neutral-800 pb-4">
        <div className="flex items-center gap-3">
          <Activity className={`text-red-500 ${isLive ? 'animate-pulse' : ''}`} size={24} />
          <div>
            <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-red-500 to-orange-500 tracking-wider">FIA RACE CONTROL</h3>
            <p className="text-[10px] text-neutral-400 font-mono tracking-widest uppercase">
              {isLive ? 'Live Communication Feed' : 'Session Communication Log'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          {isLive ? (
            <>
              <span className="w-2 h-2 rounded-full bg-red-500 animate-ping"></span>
              <span className="text-xs font-mono font-bold text-red-500 uppercase tracking-widest">LIVE</span>
            </>
          ) : (
            <>
              <span className="w-2 h-2 rounded-full bg-neutral-500"></span>
              <span className="text-xs font-mono font-bold text-neutral-500 uppercase tracking-widest">ARCHIVED</span>
            </>
          )}
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto pr-2 space-y-3 custom-scrollbar">
        {messages.map((msg, idx) => (
          <div key={idx} className="flex gap-4 group">
            <div className="flex flex-col items-end w-24 shrink-0 pt-1">
              <span className="text-xs font-mono font-bold text-neutral-500 group-hover:text-neutral-300 transition-colors">{msg.time}</span>
            </div>
            
            <div className="relative flex-1 bg-neutral-900/50 hover:bg-neutral-800/80 transition-all border border-neutral-800/50 hover:border-neutral-700 rounded-lg p-3 group-hover:-translate-y-0.5">
              <div className="absolute left-0 top-0 bottom-0 w-1 bg-neutral-800 group-hover:bg-red-500/50 rounded-l-lg transition-colors"></div>
              
              <div className="flex flex-col gap-2 pl-2">
                <div className="flex items-center gap-2">
                  <span className="flex items-center gap-1.5 text-[10px] font-black uppercase tracking-wider text-neutral-400 bg-neutral-950 px-2 py-0.5 rounded border border-neutral-800">
                    {getCategoryIcon(msg.category)}
                    {msg.category}
                  </span>
                  
                  {msg.flag && (
                    <span className={`px-2 py-0.5 text-[10px] font-black uppercase tracking-wider rounded border border-black/20 ${getFlagColor(msg.flag)}`}>
                      {msg.flag} FLAG
                    </span>
                  )}
                </div>
                
                <p className="font-mono text-sm text-neutral-200 group-hover:text-white font-medium leading-relaxed uppercase">
                  {msg.message}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
export default RaceControlMessagesComponent;
