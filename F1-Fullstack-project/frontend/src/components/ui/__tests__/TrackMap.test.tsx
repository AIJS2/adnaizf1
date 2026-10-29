import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { TrackMap } from '../TrackMap';

describe('TrackMap Component (Image 1 Style Circuit Layout)', () => {
  it('renders header, tabs, vector track, turn badges, and bottom telemetry stats for Australia', () => {
    render(
      <TrackMap
        raceInfo={{
          round: 1,
          name: 'Albert Park Circuit',
          location: 'Melbourne',
          country: 'Australia',
        }}
      />,
    );

    // 1. Header identity
    expect(screen.getByTestId('circuit-layout-card')).toBeInTheDocument();
    expect(screen.getByText('Australia')).toBeInTheDocument();
    expect(screen.getByText('Albert Park Circuit')).toBeInTheDocument();

    // 2. Segmented mode tabs
    expect(screen.getByTestId('circuit-tab-turns')).toBeInTheDocument();
    expect(screen.getByTestId('circuit-tab-sectors')).toBeInTheDocument();
    expect(screen.getByTestId('circuit-tab-drs')).toBeInTheDocument();
    expect(screen.getByTestId('circuit-tab-tracking')).toBeInTheDocument();

    // 3. Turns are rendered by default
    expect(screen.getByTestId('circuit-corner-markers')).toBeInTheDocument();
    // Melbourne has 14 corners
    expect(
      screen.getByTestId('circuit-corner-markers').querySelectorAll('.corner-badge-circle'),
    ).toHaveLength(14);
    // Leader lines must be clean (0 lines)
    expect(
      screen.getByTestId('circuit-corner-markers').querySelectorAll('line'),
    ).toHaveLength(0);

    // 4. Start/Finish bar & Pit line
    expect(screen.getByTestId('start-finish-bar')).toBeInTheDocument();

    // 5. Bottom telemetry stat metrics (Image 1 3-column layout)
    expect(screen.getByText(/Average Speed/i)).toBeInTheDocument();
    expect(screen.getByText(/Circuit Length/i)).toBeInTheDocument();
    expect(screen.getByText(/Lap Record/i)).toBeInTheDocument();
    expect(screen.getByText('5.278 km')).toBeInTheDocument();
    expect(screen.getByText('1:19.813')).toBeInTheDocument();
  });

  it('switches between Sectors, DRS, and Tracking tabs smoothly', () => {
    render(
      <TrackMap
        raceInfo={{
          round: 1,
          name: 'Albert Park Circuit',
          location: 'Melbourne',
          country: 'Australia',
        }}
      />,
    );

    // Switch to Sectors
    fireEvent.click(screen.getByTestId('circuit-tab-sectors'));
    expect(screen.getByTestId('sector-segments')).toBeInTheDocument();
    expect(screen.queryByTestId('circuit-corner-markers')).not.toBeInTheDocument();

    // Switch to DRS
    fireEvent.click(screen.getByTestId('circuit-tab-drs'));
    expect(screen.getByTestId('drs-zones')).toBeInTheDocument();
    expect(screen.queryByTestId('sector-segments')).not.toBeInTheDocument();

    // Switch to Tracking
    fireEvent.click(screen.getByTestId('circuit-tab-tracking'));
    expect(screen.getByTestId('speed-trap-markers')).toBeInTheDocument();
    expect(screen.queryByTestId('drs-zones')).not.toBeInTheDocument();

    // Switch back to Turns
    fireEvent.click(screen.getByTestId('circuit-tab-turns'));
    expect(screen.getByTestId('circuit-corner-markers')).toBeInTheDocument();
  });

  it('falls back gracefully when race info is missing or unknown', () => {
    render(<TrackMap raceInfo={null} />);

    expect(screen.getByTestId('circuit-layout-card')).toBeInTheDocument();
    expect(screen.getByText(/Average Speed/i)).toBeInTheDocument();
  });
});
