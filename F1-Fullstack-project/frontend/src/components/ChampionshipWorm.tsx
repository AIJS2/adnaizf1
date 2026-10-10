import React, { useMemo, useState } from 'react';
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Legend
} from 'recharts';
import { teamColors } from '../data/teamData';
import { DriverProfile, SessionResultEntry, TeamProfile } from '../types/f1';
import { TrendingUp, Users, Factory } from 'lucide-react';
import { safeMax, toNumber } from '../utils/data';

interface ChampionshipWormProps {
  sessionResults?: SessionResultEntry[];
  drivers?: DriverProfile[];
  teams?: TeamProfile[];
}

/**
 * A single round on the championship worm: the X-axis label plus one numeric
 * series per driver/team. `name`/`round` are the reserved axis keys, so the
 * numeric index signature is declared alongside them with a union type.
 */
type ChampionshipPoint = { name: string; round: number } & Record<string, string | number>;
type ChampionshipLine = { key: string; name: string; color: string };

const ChampionshipWorm: React.FC<ChampionshipWormProps> = ({ sessionResults = [], drivers = [], teams = [] }) => {
  const [viewMode, setViewMode] = useState('drivers'); // 'drivers' or 'constructors'

  const { chartData, lines, maxPoints } = useMemo<{ chartData: ChampionshipPoint[]; lines: ChampionshipLine[]; maxPoints: number }>(() => {
    if (!sessionResults.length || (!drivers.length && !teams.length)) {
      return { chartData: [], lines: [], maxPoints: 0 };
    }

    // Identify all rounds
    const rounds = [...new Set(sessionResults.map(r => r.RoundNumber))].sort((a, b) => a - b);

    if (viewMode === 'drivers') {
      // Pick Top 10 Drivers
      const top10 = drivers.slice(0, 10).map(d => d.name || d.abbreviation || d.driverId);
      
      const data: ChampionshipPoint[] = rounds.map(round => {
        const point: ChampionshipPoint = { name: `Round ${round}`, round };
        top10.forEach(driver => {
          const pointsUpToRound = sessionResults
            .filter(r => r.FullName === driver && r.RoundNumber <= round)
            .reduce((sum, r) => sum + toNumber(r.Points), 0);
          point[driver] = pointsUpToRound;
        });
        return point;
      });

      const lines: ChampionshipLine[] = top10.map(driver => {
        const dObj = drivers.find(d => d.name === driver);
        return {
          key: driver,
          name: dObj?.abbreviation || driver,
          color: teamColors[dObj?.team || ''] || '#ffffff'
        };
      });

      // safeMax never yields -Infinity (Math.max(...[]) does), which would
      // corrupt the Y domain when the season has no points yet.
      const maxPts = safeMax(top10.map(d => toNumber(data[data.length - 1]?.[d])), 100);
      return { chartData: data, lines, maxPoints: maxPts };
    } else {
      // Constructors
      const allTeams = teams.map(t => t.name || t.id);
      
      const data: ChampionshipPoint[] = rounds.map(round => {
        const point: ChampionshipPoint = { name: `Round ${round}`, round };
        allTeams.forEach(team => {
          // Team points are accumulated from all drivers in that team
          const pointsUpToRound = sessionResults
            .filter(r => r.TeamName === team && r.RoundNumber <= round)
            .reduce((sum, r) => sum + toNumber(r.Points), 0);
          point[team] = pointsUpToRound;
        });
        return point;
      });

      const lines: ChampionshipLine[] = allTeams.map(team => ({
        key: team,
        name: team,
        color: teamColors[team] || '#ffffff'
      }));

      const maxPts = safeMax(allTeams.map(t => toNumber(data[data.length - 1]?.[t])), 100);
      return { chartData: data, lines, maxPoints: maxPts };
    }
  }, [sessionResults, drivers, teams, viewMode]);

  if (!sessionResults.length) {
    return (
      <div className="flex flex-col items-center justify-center p-12 bg-neutral-900/40 rounded-3xl border border-neutral-800">
        <TrendingUp className="text-neutral-600 mb-4" size={48} />
        <h3 className="text-neutral-400 font-bold text-lg">No progression data available.</h3>
      </div>
    );
  }

  // Calculate Y-Axis upper bound (round to next 50)
  const yDomainMax = Math.ceil((maxPoints || 10) / 50) * 50;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 shadow-2xl">
        <div>
          <h2 className="text-xl md:text-2xl font-black flex items-center gap-3 tracking-tight">
            <TrendingUp className="text-red-500" /> Championship Progression
          </h2>
          <p className="text-neutral-400 text-sm mt-1">Track the points evolution race by race.</p>
        </div>
        
        {/* Toggle Mode */}
        <div className="flex bg-neutral-950 p-1.5 rounded-xl border border-neutral-800/80">
          <button 
            onClick={() => setViewMode('drivers')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
              viewMode === 'drivers' ? 'bg-neutral-800 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Users size={14} /> Drivers (Top 10)
          </button>
          <button 
            onClick={() => setViewMode('constructors')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black transition-all ${
              viewMode === 'constructors' ? 'bg-neutral-800 text-white shadow-md' : 'text-neutral-500 hover:text-neutral-300'
            }`}
          >
            <Factory size={14} /> Constructors
          </button>
        </div>
      </div>

      <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 md:p-8 shadow-2xl">
        <div className="h-[500px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData} margin={{ top: 20, right: 30, left: 0, bottom: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#333" vertical={false} />
              <XAxis 
                dataKey="name" 
                stroke="#666" 
                tick={{ fill: '#888', fontSize: 12, fontWeight: 700 }}
                tickMargin={15}
              />
              <YAxis 
                stroke="#666" 
                tick={{ fill: '#888', fontSize: 12, fontWeight: 700 }}
                domain={[0, yDomainMax]}
                tickFormatter={(val) => `${val} pts`}
                width={80}
              />
              <RechartsTooltip 
                contentStyle={{ 
                  backgroundColor: 'rgba(20, 20, 20, 0.95)', 
                  borderColor: '#333',
                  borderRadius: '16px',
                  boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
                  padding: '12px 16px',
                  fontWeight: 'bold'
                }}
                itemStyle={{ fontSize: '13px', paddingTop: '4px' }}
                labelStyle={{ color: '#aaa', marginBottom: '8px', borderBottom: '1px solid #333', paddingBottom: '4px' }}
                formatter={(value, name, props) => {
                  const friendly = props?.payload?.[`${name}_name`];
                  return [
                    `${value} pts`,
                    typeof friendly === 'string' && friendly ? friendly : name,
                  ];
                }}
              />
              <Legend 
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="circle"
              />
              {lines.map((line, index) => (
                <Line 
                  key={line.key}
                  type="monotone" 
                  dataKey={line.key} 
                  name={line.name}
                  stroke={line.color} 
                  strokeWidth={viewMode === 'drivers' && index < 3 ? 4 : 2}
                  dot={{ r: 4, fill: '#111', stroke: line.color, strokeWidth: 2 }}
                  activeDot={{ r: 7, stroke: '#fff', strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};

export default ChampionshipWorm;
