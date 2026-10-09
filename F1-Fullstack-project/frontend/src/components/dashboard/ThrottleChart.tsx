import React from 'react';
import { TelemetryFlatPoint } from '../../types/f1';
import TelemetryChart from './TelemetryChart';
import { Zap } from 'lucide-react';

export interface ThrottleChartProps {
  data: TelemetryFlatPoint[];
  drivers: string[];
  driverStyles: Record<string, { color: string; strokeDasharray?: string }>;
  setActiveDistance: (distance: number | null) => void;
}

const ThrottleChart: React.FC<ThrottleChartProps> = ({
  data,
  drivers,
  driverStyles,
  setActiveDistance
}) => {
  return (
    <TelemetryChart 
      title="Throttle Application"
      icon={<Zap className="text-orange-500"/>}
      data={data}
      dataKeys="throttle_{drv}"
      domain={[0, 105]}
      drivers={drivers}
      driverStyles={driverStyles}
      setActiveDistance={setActiveDistance}
    />
  );
};

export default ThrottleChart;
