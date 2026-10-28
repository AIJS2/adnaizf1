import { fireEvent, render, screen } from '@testing-library/react';
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

  it('shows the driver tooltip while hovering a segment and hides it on leave', () => {
    const telemetry = [point(0, -1200, 800), point(10, -900, 1200), point(20, 300, 4000)];
    const { container } = render(
      <TrackDominationMap
        telemetry={telemetry}
        drivers={['BOR']}
        driver_info={driverInfo}
        activeDistance={null}
      />
    );

    // [0] background outline, [1] glow, [2] main domination stroke
    const segment = container.querySelectorAll('polyline')[1];
    fireEvent.mouseEnter(segment);

    expect(screen.getByText('Gabriel Bortoleto')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId('domination-map'));
    expect(screen.queryByText('Gabriel Bortoleto')).not.toBeInTheDocument();
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

  it('projects onto canonical circuit geometry for Round 2 (Shanghai)', () => {
    const telemetry = [
      point(0, 0, 0),
      point(1000, 0, 0),
      point(2000, 0, 0),
      point(3000, 0, 0),
      point(5400, 0, 0),
    ];
    const { container } = render(
      <TrackDominationMap
        telemetry={telemetry}
        drivers={['BOR']}
        driver_info={driverInfo}
        activeDistance={null}
        circuitInfo={{ round: 2 }}
      />
    );

    // Domination polylines and background outline are rendered
    expect(container.querySelectorAll('polyline').length).toBeGreaterThan(0);
    expect(screen.queryByText(/published after a session finishes/i)).not.toBeInTheDocument();
  });

  it('projects onto canonical circuit geometry for Round 11 (Hungaroring)', () => {
    const telemetry = [
      point(0, 0, 0),
      point(1000, 0, 0),
      point(2000, 0, 0),
      point(4381, 0, 0),
    ];
    const { container } = render(
      <TrackDominationMap
        telemetry={telemetry}
        drivers={['BOR']}
        driver_info={driverInfo}
        activeDistance={null}
        circuitInfo={{ round: 11 }}
      />
    );

    expect(container.querySelectorAll('polyline').length).toBeGreaterThan(0);
    expect(screen.queryByText(/published after a session finishes/i)).not.toBeInTheDocument();
  });
});
