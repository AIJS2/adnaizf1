import React, { useMemo } from 'react';
import { Radar, RadarChart, PolarGrid, PolarAngleAxis, PolarRadiusAxis, ResponsiveContainer, Tooltip as RechartsTooltip, Legend } from 'recharts';
import { teamColors } from '../data/teamData';

const DriverRadarChart = ({ profile1, profile2 }) => {
  const chartData = useMemo(() => {
    if (!profile1 || !profile2) return [];

    const calculateAttributes = (profile) => {
      // 1. Pace: based on poles and avg_finish
      const poles = profile.poles || 0;
      const avgF = profile.avg_finish || 10;
      let pace = 60 + (poles * 3.5) + ((20 - avgF) * 1.8);
      
      // 2. Racecraft: based on wins and podiums
      const wins = profile.wins || 0;
      const podiums = profile.podiums || 0;
      let racecraft = 65 + (wins * 4) + (podiums * 2);
      
      // 3. Consistency: penalize DNFs, reward low avg_finish
      const dnfs = profile.dnfs || 0;
      let consistency = 95 - (dnfs * 8) - (avgF * 1.5);
      
      // 4. Domination: Points relative to teammate
      let domination = 70;
      if (profile.teammate && (profile.points + profile.teammate.points > 0)) {
         const totalTeamPts = profile.points + profile.teammate.points;
         const ratio = profile.points / totalTeamPts; // 0 to 1
         domination = 40 + (ratio * 60); 
      } else if (profile.points > 0) {
         domination = 95;
      }
      
      // 5. Impact: based on total points (assume 400 is dominant season for scaling)
      let impact = 60 + ((profile.points || 0) / 400) * 40;

      const clamp = (val) => Math.min(99, Math.max(40, Math.round(val)));

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

    const categories = ['Pace', 'Racecraft', 'Consistency', 'Domination', 'Impact'];
    
    return categories.map(cat => ({
      subject: cat,
      A: attrs1[cat],
      B: attrs2[cat],
      fullMark: 100
    }));
  }, [profile1, profile2]);

  if (!profile1 || !profile2) return null;

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
