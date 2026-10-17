import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import TrackDominationMap from '../TrackDominationMap';
import type { TelemetryDataPoint, TeamDriverInfo } from '../../../types/f1';

const driverInfo: Record<string, TeamDriverInfo> = {
  BOR: { team: 'Audi', name: 'Gabriel Bortoleto' },
};

const point = (distance: number, x: number, y: number): TelemetryDataPoint => ({
  distance,
  x,
  y,
  dominant_driver: 'BOR',
});

describe('TrackDominationMap positional data guards', () => {
  it('renders the map when coordinates have real spread', () => {
    const telemetry = [point(0, -1200, 800), point(10, -900, 1200), point(20, 300, 4000)];
    const { container } = render(
      <TrackDominationMap
        telemetry={telemetry}
        drivers={['BOR']}
        driver_info={driverInfo}
        activeDistance={null}
      />
    );

    expect(container.querySelectorAll('polyline').length).toBeGreaterThan(0);
    expect(screen.queryByText(/published after a session finishes/i)).not.toBeInTheDocument();
  });

  it('shows the empty state when coordinates are all zero (no position data)', () => {
    const telemetry = [point(0, 0, 0), point(10, 0, 0), point(20, 0, 0)];
    render(
      <TrackDominationMap
        telemetry={telemetry}
        drivers={['BOR']}
        driver_info={driverInfo}
        activeDistance={null}
      />
    );

    expect(screen.getByText(/published after a session finishes/i)).toBeInTheDocument();
  });

  it('shows the empty state when telemetry is empty', () => {
    render(<TrackDominationMap telemetry={[]} drivers={[]} driver_info={{}} activeDistance={null} />);

    expect(screen.getByText(/published after a session finishes/i)).toBeInTheDocument();
  });
});
