import { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { Radar as RadarIcon } from 'lucide-react';
import { teamColors } from '../data/teamData';
import type { NumericString } from '../types/f1';
import EmptyState from './ui/EmptyState';
import { toNumber } from '../utils/data';

interface RadarTeammate {
  name: string;
  points?: NumericString;
}

/**
 * The driver-profile slice the radar chart consumes. Stat fields arrive as
 * `NumericString` from the backend, so they are coerced with `Number()` inside
 * the chart rather than at every call site.
 */
interface RadarDriverProfile {
  name: string;
  team: string;
  points?: NumericString;
  poles?: NumericString;
  wins?: NumericString;
  podiums?: NumericString;
  dnfs?: NumericString;
  avg_finish?: NumericString | null;
  teammate?: RadarTeammate | null;
}

interface RadarChartPoint {
  subject: string;
  A: number;
  B: number;
  fullMark: number;
}

interface DriverRadarChartProps {
  profile1: RadarDriverProfile | null | undefined;
  profile2: RadarDriverProfile | null | undefined;
}

const DriverRadarChart: React.FC<DriverRadarChartProps> = ({ profile1, profile2 }) => {
  const chartData = useMemo<RadarChartPoint[]>(() => {
    if (!profile1 || !profile2) return [];

    const calculateAttributes = (profile: RadarDriverProfile): Record<string, number> => {
      // Coerce the NumericString payload fields once, up front. toNumber
      // treats "" / null / non-numeric as 0 rather than NaN, so a driver with
      // no stat data plots the floor instead of producing a NaN vertex.
      const points = toNumber(profile.points);
      const poles = toNumber(profile.poles);
      const wins = toNumber(profile.wins);
      const podiums = toNumber(profile.podiums);
      const dnfs = toNumber(profile.dnfs);
      const teammatePoints = toNumber(profile.teammate?.points);

      // 1. Pace: based on poles and avg_finish
      const avgF = profile.avg_finish == null ? 10 : toNumber(profile.avg_finish, 10);
      const pace = 60 + (poles * 3.5) + ((20 - avgF) * 1.8);
      
      // 2. Racecraft: based on wins and podiums
      const racecraft = 65 + (wins * 4) + (podiums * 2);
      
      // 3. Consistency: penalize DNFs, reward low avg_finish
      const consistency = 95 - (dnfs * 8) - (avgF * 1.5);
      
      // 4. Domination: Points relative to teammate
      let domination = 70;
      if (profile.teammate && points + teammatePoints > 0) {
         const totalTeamPts = points + teammatePoints;
         const ratio = points / totalTeamPts; // 0 to 1
         domination = 40 + (ratio * 60); 
      } else if (points > 0) {
         domination = 95;
      }
      
      // 5. Impact: based on total points (assume 400 is dominant season for scaling)
      const impact = 60 + (points / 400) * 40;

      const clamp = (val: number): number => Math.min(99, Math.max(40, Math.round(val)));

      return {
        Pace: clamp(pace),
        Racecraft: clamp(racecraft),
        Consistency: clamp(consistency),
        Domination: clamp(domination),
        Impact: clamp(impact)
      };
    };

    const attrs1 = calculateAttributes(profile1);
    const attrs2 = calculateAttributes(profile2);

    const categories: Array<keyof ReturnType<typeof calculateAttributes>> = ['Pace', 'Racecraft', 'Consistency', 'Domination', 'Impact'];
    
    return categories.map(cat => ({
      subject: cat,
      A: attrs1[cat],
      B: attrs2[cat],
      fullMark: 100
    }));
  }, [profile1, profile2]);

  if (!profile1 || !profile2) {
    return (
      <div className="bg-neutral-900/60 border border-neutral-800 rounded-3xl p-6">
        <EmptyState
          icon={RadarIcon}
          title="No driver comparison available"
          description="Select two drivers with season data to compare their attributes."
          className="min-h-[300px]"
        />
      </div>
    );
  }

  const color1 = teamColors[profile1.team] || '#EF4444';
  const color2 = teamColors[profile2.team] || '#3B82F6';

  return (
    <div className="bg-neutral-900/60 backdrop-blur-xl border border-neutral-800 rounded-3xl p-6 shadow-2xl relative overflow-hidden group">
      <div className="absolute inset-0 bg-gradient-to-br from-neutral-800/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
      
      <div className="flex flex-col items-center justify-center mb-4 relative z-10">
        <h3 className="text-xl font-black text-transparent bg-clip-text bg-gradient-to-r from-white to-neutral-400 uppercase tracking-widest mb-1">
          Driver Attributes Radar
        </h3>
        <p className="text-xs text-neutral-500 text-center max-w-sm">
          Calculated rating based on Pace, Racecraft, Consistency, Teammate Domination, and Overall Impact this season.
        </p>
      </div>

      <div className="h-[350px] w-full relative z-10">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart cx="50%" cy="50%" outerRadius="75%" data={chartData}>
            <PolarGrid stroke="#333" strokeDasharray="3 3" />
            <PolarAngleAxis 
              dataKey="subject" 
              tick={{ fill: '#aaa', fontSize: 11, fontWeight: 'bold' }} 
            />
            <PolarRadiusAxis 
              angle={90} 
              domain={[40, 100]} 
              tick={false} 
              axisLine={false} 
            />
            <Radar 
              name={profile1.name} 
              dataKey="A" 
              stroke={color1} 
              strokeWidth={3}
              fill={color1} 
              fillOpacity={0.4} 
            />
            <Radar 
              name={profile2.name} 
              dataKey="B" 
              stroke={color2} 
              strokeWidth={3}
              fill={color2} 
              fillOpacity={0.4} 
            />
            <RechartsTooltip 
              contentStyle={{ 
                backgroundColor: 'rgba(20, 20, 20, 0.95)', 
                borderColor: '#333',
                borderRadius: '12px',
                padding: '10px 14px',
                boxShadow: '0 10px 25px rgba(0,0,0,0.5)'
              }}
              itemStyle={{ fontSize: '13px', fontWeight: 'bold', paddingTop: '4px' }}
              labelStyle={{ color: '#fff', fontWeight: 'black', textTransform: 'uppercase', fontSize: '11px', marginBottom: '4px' }}
            />
            <Legend 
              wrapperStyle={{ paddingTop: '20px', fontSize: '13px', fontWeight: 'bold' }}
              iconType="circle"
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

export default DriverRadarChart;
