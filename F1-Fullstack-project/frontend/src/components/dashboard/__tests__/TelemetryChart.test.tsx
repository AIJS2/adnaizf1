import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import TelemetryChart from '../TelemetryChart';
import { Gauge } from 'lucide-react';
import type { TelemetryFlatPoint } from '../../../types/f1';

// Recharts ResponsiveContainer needs dimension mock in jsdom
vi.mock('recharts', async () => {
  const actual = await vi.importActual<Record<string, unknown>>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactNode }) => (
      <div data-testid="responsive-container" style={{ width: 800, height: 300 }}>
        {children}
      </div>
    ),
  };
});

describe('TelemetryChart with Synchronized Scrubbing Cursor', () => {
  const mockData: TelemetryFlatPoint[] = [
    { distance: 0, speed_ANT: 250, speed_RUS: 248 },
    { distance: 1000, speed_ANT: 310, speed_RUS: 305 },
    { distance: 2000, speed_ANT: 290, speed_RUS: 295 },
  ];

  const driverStyles = {
    ANT: { color: '#00D2BE' },
    RUS: { color: '#00A19B' },
  };

  it('renders chart title and responsive container', () => {
    render(
      <TelemetryChart
        title="Speed Profile"
        icon={<Gauge data-testid="gauge-icon" />}
        data={mockData}
        dataKeys="speed_{drv}"
        domain={['auto', 'auto']}
        drivers={['ANT', 'RUS']}
        driverStyles={driverStyles}
        setActiveDistance={vi.fn()}
        unit="km/h"
      />
    );

    expect(screen.getByText('Speed Profile')).toBeInTheDocument();
    expect(screen.getByTestId('responsive-container')).toBeInTheDocument();
  });

  it('renders synchronized distance badge when activeDistance is provided', () => {
    const { rerender } = render(
      <TelemetryChart
        title="Speed Profile"
        icon={<Gauge />}
        data={mockData}
        dataKeys="speed_{drv}"
        domain={['auto', 'auto']}
        drivers={['ANT', 'RUS']}
        driverStyles={driverStyles}
        setActiveDistance={vi.fn()}
        activeDistance={null}
        unit="km/h"
      />
    );

    expect(screen.queryByText(/TRACK/)).not.toBeInTheDocument();

    rerender(
      <TelemetryChart
        title="Speed Profile"
        icon={<Gauge />}
        data={mockData}
        dataKeys="speed_{drv}"
        domain={['auto', 'auto']}
        drivers={['ANT', 'RUS']}
        driverStyles={driverStyles}
        setActiveDistance={vi.fn()}
        activeDistance={1450}
        unit="km/h"
      />
    );

    expect(screen.getByText(/TRACK.*1[.,]450.*m/)).toBeInTheDocument();
  });
});
