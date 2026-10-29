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

    // 4. Start/Finish bar
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

  it('displays interactive corner spotlight with iconic lore on corner click and supports navigation', () => {
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

    // Initial state: click hint is visible and no card is open
    expect(screen.getByTestId('corner-click-hint')).toBeInTheDocument();
    expect(screen.queryByTestId('corner-detail-card')).not.toBeInTheDocument();

    // Click Turn 1 (Jones Chicane)
    const turn1Marker = screen.getByTestId('corner-marker-1');
    fireEvent.click(turn1Marker);

    // Spotlight card opens
    expect(screen.getByTestId('corner-detail-card')).toBeInTheDocument();
    expect(screen.getByTestId('corner-detail-name')).toHaveTextContent('Jones Chicane');
    expect(screen.getByTestId('iconic-badge')).toHaveTextContent(/Iconic Corner/i);
    expect(screen.getAllByText(/150 km\/h/i).length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText(/Gear 3rd/i)).toBeInTheDocument();
    expect(screen.getByTestId('corner-detail-funfact')).toHaveTextContent(/brake from ~325 km\/h/i);

    // Navigate to Next Corner (Turn 2: Brabham Chicane)
    fireEvent.click(screen.getByTestId('corner-next-btn'));
    expect(screen.getByTestId('corner-detail-name')).toHaveTextContent('Brabham Chicane');
    expect(screen.getByText(/180 km\/h/i)).toBeInTheDocument();

    // Navigate back to Prev Corner (Turn 1)
    fireEvent.click(screen.getByTestId('corner-prev-btn'));
    expect(screen.getByTestId('corner-detail-name')).toHaveTextContent('Jones Chicane');

    // Close the card
    fireEvent.click(screen.getByTestId('corner-detail-close'));
    expect(screen.queryByTestId('corner-detail-card')).not.toBeInTheDocument();
  });
});
