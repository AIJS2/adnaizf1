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
      dnss: 0,
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
      dnss: 0,
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
      dnss: 1,
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
  // Real R16 (Bahrain) and R17 (Singapore) rows: R17 carried a Sprint where
  // Russell retired (ClassifiedPosition "R") while still finishing P9 in the
  // Grand Prix — the exact shape the battle log must render correctly.
  session_results: [
    { RoundNumber: 16, FullName: 'Kimi Antonelli', SessionType: 'R', Position: 2, Points: 18, Status: 'Finished', ClassifiedPosition: '2', EventName: 'Bahrain Grand Prix', Location: 'Sakhir' },
    { RoundNumber: 16, FullName: 'George Russell', SessionType: 'R', Position: 20, Points: 0, Status: 'Retired', ClassifiedPosition: '20', EventName: 'Bahrain Grand Prix', Location: 'Sakhir' },
    { RoundNumber: 16, FullName: 'George Russell', SessionType: 'Q', Position: 8, Points: 0, Status: '', ClassifiedPosition: '', EventName: 'Bahrain Grand Prix', Location: 'Sakhir' },
    { RoundNumber: 17, FullName: 'Kimi Antonelli', SessionType: 'R', Position: 3, Points: 15, Status: 'Finished', ClassifiedPosition: '3', EventName: 'Singapore Grand Prix', Location: 'Marina Bay' },
    { RoundNumber: 17, FullName: 'George Russell', SessionType: 'R', Position: 9, Points: 2, Status: 'Finished', ClassifiedPosition: '9', EventName: 'Singapore Grand Prix', Location: 'Marina Bay' },
    { RoundNumber: 17, FullName: 'Kimi Antonelli', SessionType: 'Sprint', Position: 4, Points: 5, Status: 'Finished', ClassifiedPosition: '4', EventName: 'Singapore Grand Prix', Location: 'Marina Bay' },
    { RoundNumber: 17, FullName: 'George Russell', SessionType: 'Sprint', Position: 20, Points: 0, Status: 'Retired', ClassifiedPosition: 'R', EventName: 'Singapore Grand Prix', Location: 'Marina Bay' },
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
      expect(screen.getByPlaceholderText('Search driver, team, or #…')).toBeInTheDocument();
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

  it('renders the Sprint-aware DNS metric next to the DNF metric', async () => {
    renderComparePage('/compare');

    await waitFor(() => {
      expect(screen.getByText('Did Not Finish (DNFs)')).toBeInTheDocument();
    });
    expect(screen.getByText('Did Not Start (DNSs)')).toBeInTheDocument();
  });

  it('merges Sprint results into the Race H2H log without P99 or fake zeros', async () => {
    renderComparePage('/compare');

    await waitFor(() => {
      expect(screen.getAllByText('George Russell').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /race h2h/i }));

    await waitFor(() => {
      expect(screen.getByText('Grand Prix Battle Log')).toBeInTheDocument();
    });

    // R16: a classified retiree keeps its official position (P20), not P99.
    expect(screen.getByText('P20')).toBeInTheDocument();

    // R17: race + Sprint points are merged per round.
    expect(screen.getByText('+18 pts')).toBeInTheDocument(); // R16 Antonelli
    expect(screen.getByText('+20 pts')).toBeInTheDocument(); // R17 Antonelli: 15 + 5
    expect(screen.getByText('+2 pts')).toBeInTheDocument(); // R17 Russell: 2 + 0

    // Sprint badges: a points finish and a retirement.
    expect(screen.getByText('SPRINT P4 (+5)')).toBeInTheDocument();
    expect(screen.getByText('SPRINT DNF')).toBeInTheDocument();
  });

  it('renders the battle log even when a stale SQLite standings payload sits under the old shared key', async () => {
    const queryClient = new QueryClient({
      defaultOptions: { queries: { retry: false, staleTime: 5 * 60 * 1000 } },
    });
    // Reproduces the reported bug: /stats stored the relational standings
    // (no session_results) under ['standings', year]; with the global
    // 5-minute staleTime the Compare page reused it without refetching and
    // the battle log stayed empty.
    queryClient.setQueryData(['standings', 2026], {
      year: 2026,
      drivers: MOCK_STANDINGS.drivers,
      teams: MOCK_STANDINGS.teams,
      source: 'sqlite_database',
    });

    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/compare']}>
          <ComparePage />
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Kimi Antonelli').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /race h2h/i }));

    await waitFor(() => {
      expect(screen.getByText('Grand Prix Battle Log')).toBeInTheDocument();
    });
    expect(screen.getByText('+18 pts')).toBeInTheDocument(); // R16 Antonelli
  });

  it('scores the Race H2H badge from race finishes and tolerates name variants', async () => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/api/standings') || url.includes('/api/championship')) {
        return {
          ok: true,
          json: async () => ({
            ...MOCK_STANDINGS,
            // FastF1's full name for Antonelli differs from the championship
            // table's short name; the abbreviation must bridge the two.
            session_results: [
              { RoundNumber: 15, FullName: 'Andrea Kimi Antonelli', Abbreviation: 'ANT', SessionType: 'R', Position: 5, Points: 10, Status: 'Finished', ClassifiedPosition: '5', EventName: 'Azerbaijan Grand Prix', Location: 'Baku' },
              { RoundNumber: 15, FullName: 'George Russell', Abbreviation: 'RUS', SessionType: 'R', Position: 1, Points: 25, Status: 'Finished', ClassifiedPosition: '1', EventName: 'Azerbaijan Grand Prix', Location: 'Baku' },
              { RoundNumber: 16, FullName: 'Andrea Kimi Antonelli', Abbreviation: 'ANT', SessionType: 'R', Position: 2, Points: 18, Status: 'Finished', ClassifiedPosition: '2', EventName: 'Bahrain Grand Prix', Location: 'Sakhir' },
              { RoundNumber: 16, FullName: 'George Russell', Abbreviation: 'RUS', SessionType: 'R', Position: 20, Points: 0, Status: 'Retired', ClassifiedPosition: '20', EventName: 'Bahrain Grand Prix', Location: 'Sakhir' },
            ],
          }),
        };
      }
      return { ok: false };
    }));

    renderComparePage('/compare');

    await waitFor(() => {
      expect(screen.getAllByText('Kimi Antonelli').length).toBeGreaterThan(0);
    });

    // Race-based score: Russell takes R15, Antonelli takes R16. The old
    // metric-bar count read 8-0, which was the reported wrong H2H.
    await waitFor(() => {
      expect(screen.getByLabelText('Race H2H 1 - 1')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /race h2h/i }));

    await waitFor(() => {
      expect(screen.getByText('Grand Prix Battle Log')).toBeInTheDocument();
    });
    // Both rounds render despite the "Andrea Kimi Antonelli" full name.
    expect(screen.getByText('+10 pts')).toBeInTheDocument();
    expect(screen.getByText('+25 pts')).toBeInTheDocument();
  });
});
