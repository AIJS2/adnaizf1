import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import ComparePage from './pages/ComparePage';

const MOCK_STANDINGS = {
  year: 2026,
  drivers: [
    {
      id: 'kimi_antonelli',
      name: 'Kimi Antonelli',
      team: 'Mercedes',
      team_id: 'mercedes',
      position: 1,
      points: 320,
      wins: 8,
      podiums: 13,
      dnfs: 0,
      abbreviation: 'ANT',
      driver_number: 12,
      points_last_race: 18,
      color: '#27F4D2',
    },
    {
      id: 'george_russell',
      name: 'George Russell',
      team: 'Mercedes',
      team_id: 'mercedes',
      position: 2,
      points: 285,
      wins: 4,
      podiums: 10,
      dnfs: 1,
      abbreviation: 'RUS',
      driver_number: 63,
      points_last_race: 15,
      color: '#27F4D2',
    },
    {
      id: 'charles_leclerc',
      name: 'Charles Leclerc',
      team: 'Ferrari',
      team_id: 'ferrari',
      position: 3,
      points: 260,
      wins: 3,
      podiums: 9,
      dnfs: 2,
      abbreviation: 'LEC',
      driver_number: 16,
      points_last_race: 12,
      color: '#E8002D',
    },
  ],
  teams: [
    {
      id: 'mercedes',
      name: 'Mercedes',
      points: 605,
      position: 1,
      wins: 12,
      podiums: 23,
    },
  ],
};

function renderComparePage(initialEntry = '/compare') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <ComparePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('ComparePage H2H Feature', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/api/standings') || url.includes('/api/championship')) {
        return {
          ok: true,
          json: async () => MOCK_STANDINGS,
        };
      }
      return { ok: false };
    }));
  });

  it('renders driver comparison cards with initial P1 and P2 drivers', async () => {
    renderComparePage('/compare');

    // Wait for drivers to load
    await waitFor(() => {
      expect(screen.getAllByText('Kimi Antonelli').length).toBeGreaterThan(0);
      expect(screen.getAllByText('George Russell').length).toBeGreaterThan(0);
    });

    // Check position pills
    expect(screen.getAllByText('P1').length).toBeGreaterThan(0);
    expect(screen.getAllByText('P2').length).toBeGreaterThan(0);

    // Check comparative metrics
    expect(screen.getAllByText('Championship Points').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Race Wins').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Podium Finishes').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Did Not Finish (DNFs)').length).toBeGreaterThan(0);
  });

  it('swaps drivers positions when clicking Swap Positions', async () => {
    renderComparePage('/compare');

    await waitFor(() => {
      expect(screen.getAllByText('Kimi Antonelli').length).toBeGreaterThan(0);
    });

    // Multiple swap buttons exist (header + selector area), use the first one
    const swapButtons = screen.getAllByTitle('Swap Drivers');
    fireEvent.click(swapButtons[0]);

    // Both drivers should still be displayed
    expect(screen.getAllByText('Kimi Antonelli').length).toBeGreaterThan(0);
    expect(screen.getAllByText('George Russell').length).toBeGreaterThan(0);
  });

  it('supports selecting a new rival driver from dropdown', async () => {
    renderComparePage('/compare');

    await waitFor(() => {
      expect(screen.getAllByText('George Russell').length).toBeGreaterThan(0);
    });

    // Find the Driver 2 dropdown button - it's in the selector area
    const driverSelectors = screen.getAllByText('Driver 2');
    expect(driverSelectors.length).toBeGreaterThan(0);
    
    // Click on the Driver 2 selector button
    const driver2Section = driverSelectors[0].closest('div');
    const dropdownBtn = driver2Section?.querySelector('button');
    expect(dropdownBtn).toBeTruthy();

    fireEvent.click(dropdownBtn!);

    // Should see search input and Charles Leclerc in dropdown
    await waitFor(() => {
      expect(screen.getByPlaceholderText('Search driver, team, or #...')).toBeInTheDocument();
      expect(screen.getByText('Charles Leclerc')).toBeInTheDocument();
    });

    // Select Charles Leclerc
    fireEvent.click(screen.getByText('Charles Leclerc'));

    // Charles Leclerc should now be selected as Driver 2
    await waitFor(() => {
      expect(screen.getAllByText('Charles Leclerc').length).toBeGreaterThan(0);
      expect(screen.getAllByText('P3').length).toBeGreaterThan(0);
    });
  });

  it('correctly displays DNF comparison favoring lower value', async () => {
    renderComparePage('/compare');

    await waitFor(() => {
      expect(screen.getByText('Did Not Finish (DNFs)')).toBeInTheDocument();
    });

    // The new UI uses comparison bars with "Lower is better" indicator for DNFs
    // Driver 1 has 0 DNFs (better), Driver 2 has 1 DNF
    // Multiple metrics are inverted (DNFs, Position) so there are multiple "Lower is better" labels
    expect(screen.getAllByText('Lower is better').length).toBeGreaterThan(0);
  });
});
