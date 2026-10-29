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

    // [0] background outline, [1] glow, [2] main domination stroke, [3] hit target
    const segment = container.querySelectorAll('polyline')[1];
    fireEvent.mouseEnter(segment);

    expect(screen.getByText('Gabriel Bortoleto')).toBeInTheDocument();

    fireEvent.mouseLeave(screen.getByTestId('domination-map'));
    expect(screen.queryByText('Gabriel Bortoleto')).not.toBeInTheDocument();
  });

  it('keeps every stroke width constant across hover so segments cannot flicker', () => {
    const telemetry = [point(0, -1200, 800), point(10, -900, 1200), point(20, 300, 4000)];
    const { container } = render(
      <TrackDominationMap
        telemetry={telemetry}
        drivers={['BOR']}
        driver_info={driverInfo}
        activeDistance={null}
      />
    );

    const widths = () =>
      Array.from(container.querySelectorAll('polyline')).map((node) =>
        node.getAttribute('stroke-width'),
      );

    const before = widths();
    expect(before.length).toBeGreaterThan(0);
    expect(before.every((width) => width !== null)).toBe(true);

    fireEvent.mouseEnter(container.querySelectorAll('polyline')[1]);
    expect(screen.getByText('Gabriel Bortoleto')).toBeInTheDocument();

    expect(widths()).toEqual(before);
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

  it('renders turn number badges and toggles them with the Turns button', () => {
    const telemetry = [
      point(0, 0, 0),
      point(1000, 0, 0),
      point(2000, 0, 0),
      point(4381, 0, 0),
    ];
    render(
      <TrackDominationMap
        telemetry={telemetry}
        drivers={['BOR']}
        driver_info={driverInfo}
        activeDistance={null}
        circuitInfo={{ round: 19 }} // Mexico (17 corners)
      />
    );

    // Toggle button is present and defaults to ON
    const toggle = screen.getByTestId('toggle-turn-numbers');
    expect(toggle).toBeInTheDocument();
    expect(toggle).toHaveTextContent(/Turns ON/i);

    // Corner markers are rendered
    expect(screen.getByTestId('circuit-corner-markers')).toBeInTheDocument();
    expect(
      screen.getByTestId('circuit-corner-markers').querySelectorAll('.corner-badge-circle'),
    ).toHaveLength(17);

    // Clicking toggle turns badges off
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent(/Turns OFF/i);
    expect(screen.queryByTestId('circuit-corner-markers')).not.toBeInTheDocument();

    // Clicking again turns them back on
    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent(/Turns ON/i);
    expect(screen.getByTestId('circuit-corner-markers')).toBeInTheDocument();
  });

  it('displays domination percentages and clarifies 0% non-dominant drivers', () => {
    const multiDriverInfo = {
      NOR: { team: 'McLaren', name: 'Lando Norris' },
      HAM: { team: 'Ferrari', name: 'Lewis Hamilton' },
      STR: { team: 'Aston Martin', name: 'Lance Stroll' },
    };

    // NOR dominates point 0 and 1000 (67%), HAM dominates 2000 (33%), STR dominates 0 (0%)
    const telemetry: TelemetryDataPoint[] = [
      { distance: 0, x: 0, y: 0, dominant_driver: 'NOR' },
      { distance: 1000, x: 1000, y: 0, dominant_driver: 'NOR' },
      { distance: 2000, x: 2000, y: 0, dominant_driver: 'HAM' },
    ];

    render(
      <TrackDominationMap
        telemetry={telemetry}
        drivers={['STR', 'NOR', 'HAM']}
        driver_info={multiDriverInfo}
        activeDistance={null}
      />
    );

    // Legend pills must render percentages
    expect(screen.getByTestId('driver-pill-NOR')).toHaveTextContent(/NOR.*67%/);
    expect(screen.getByTestId('driver-pill-HAM')).toHaveTextContent(/HAM.*33%/);
    expect(screen.getByTestId('driver-pill-STR')).toHaveTextContent(/STR.*0%/);

    // Hovering 0% driver pill clarifies that no sectors were dominated
    fireEvent.mouseEnter(screen.getByTestId('driver-pill-STR'));
    expect(screen.getByText(/0% · No sectors dominated/i)).toBeInTheDocument();
    expect(screen.getByText(/Slower in all track sectors/i)).toBeInTheDocument();
  });
});
