import React from 'react';
import { TelemetryFlatPoint } from '../../types/f1';
import TelemetryChart from './TelemetryChart';
import { Gauge } from 'lucide-react';

export interface SpeedChartProps {
  data: TelemetryFlatPoint[];
  drivers: string[];
  driverStyles: Record<string, { color: string; strokeDasharray?: string }>;
  setActiveDistance: (distance: number | null) => void;
}

const SpeedChart: React.FC<SpeedChartProps> = ({
  data,
  drivers,
  driverStyles,
  setActiveDistance
}) => {
  return (
    <TelemetryChart 
      title="Speed Profile"
      icon={<Gauge className="text-blue-500"/>}
      data={data}
      dataKeys="speed_{drv}"
      domain={['auto', 'auto']}
      drivers={drivers}
      driverStyles={driverStyles}
      setActiveDistance={setActiveDistance}
      unit="km/h"
    />
  );
};

export default SpeedChart;
