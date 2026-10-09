import React from 'react';
import { TelemetryFlatPoint } from '../../types/f1';
import TelemetryChart from './TelemetryChart';
import { TrendingUp } from 'lucide-react';

export interface TimeDeltaChartProps {
  data: TelemetryFlatPoint[];
  drivers: string[];
  driverStyles: Record<string, { color: string; strokeDasharray?: string }>;
  setActiveDistance: (distance: number | null) => void;
}

const TimeDeltaChart: React.FC<TimeDeltaChartProps> = ({
  data,
  drivers,
  driverStyles,
  setActiveDistance
}) => {
  // If only 1 driver is selected, time delta doesn't make sense
  if (drivers.length <= 1) return null;

  return (
    <TelemetryChart 
      title={`Time Delta (to ${drivers[0]})`}
      icon={<TrendingUp className="text-green-500"/>}
      data={data}
      dataKeys="delta_{drv}"
      domain={['auto', 'auto']}
      drivers={drivers}
      driverStyles={driverStyles}
      setActiveDistance={setActiveDistance}
    />
  );
};

export default TimeDeltaChart;
