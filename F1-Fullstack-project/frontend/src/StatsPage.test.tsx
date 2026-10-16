// Regression test for the /stats WORM tab.
//
// The relational standings route (/api/standings, SQLite) carries only the
// final classification — no per-round session_results — so the worm chart
// used to render "No progression data available." forever. The page must now
// feed the chart from the championship payload's session_results.
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import StatsPage from './pages/StatsPage';

const DRIVERS = [
  { id: 'kimi_antonelli', name: 'Kimi Antonelli', team: 'Mercedes', team_id: 'mercedes', position: 1, points: 340, wins: 8, podiums: 14, dnfs: 0, dnss: 0, abbreviation: 'ANT', driver_number: 12, points_last_race: 20 },
  { id: 'george_russell', name: 'George Russell', team: 'Mercedes', team_id: 'mercedes', position: 2, points: 238, wins: 3, podiums: 8, dnfs: 3, dnss: 0, abbreviation: 'RUS', driver_number: 63, points_last_race: 2 },
  { id: 'lewis_hamilton', name: 'Lewis Hamilton', team: 'Ferrari', team_id: 'ferrari', position: 3, points: 229, wins: 1, podiums: 6, dnfs: 1, dnss: 0, abbreviation: 'HAM', driver_number: 44, points_last_race: 15 },
];

const TEAMS = [
  { id: 'mercedes', name: 'Mercedes', position: 1, points: 578, wins: 11, podiums: 22, dnfs: 3, dnss: 0, points_last_race: 22 },
  { id: 'ferrari', name: 'Ferrari', position: 2, points: 444, wins: 2, podiums: 15, dnfs: 4, dnss: 0, points_last_race: 39 },
  { id: 'mclaren', name: 'McLaren', position: 3, points: 339, wins: 2, podiums: 9, dnfs: 4, dnss: 1, points_last_race: 23 },
];

/** The SQLite route: final classification only, no session_results. */
const SQLITE_STANDINGS = { year: 2026, source: 'sqlite_database', drivers: DRIVERS, teams: TEAMS };

/** The championship route: same standings plus per-round session results. */
const CHAMPIONSHIP = {
  year: 2026,
  drivers: DRIVERS,
  teams: TEAMS,
  session_results: [
    { RoundNumber: 1, FullName: 'Kimi Antonelli', Abbreviation: 'ANT', TeamName: 'Mercedes', SessionType: 'R', Position: 2, Points: 18, Status: 'Finished', ClassifiedPosition: '2', EventName: 'Australian Grand Prix', Location: 'Melbourne' },
    { RoundNumber: 1, FullName: 'George Russell', Abbreviation: 'RUS', TeamName: 'Mercedes', SessionType: 'R', Position: 1, Points: 25, Status: 'Finished', ClassifiedPosition: '1', EventName: 'Australian Grand Prix', Location: 'Melbourne' },
    { RoundNumber: 2, FullName: 'Kimi Antonelli', Abbreviation: 'ANT', TeamName: 'Mercedes', SessionType: 'R', Position: 1, Points: 25, Status: 'Finished', ClassifiedPosition: '1', EventName: 'Chinese Grand Prix', Location: 'Shanghai' },
    { RoundNumber: 2, FullName: 'George Russell', Abbreviation: 'RUS', TeamName: 'Mercedes', SessionType: 'R', Position: 3, Points: 15, Status: 'Finished', ClassifiedPosition: '3', EventName: 'Chinese Grand Prix', Location: 'Shanghai' },
  ],
};

function renderStatsPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/stats']}>
        <StatsPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('StatsPage WORM tab', () => {
  beforeEach(() => {
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/api/standings')) {
        return { ok: true, json: async () => SQLITE_STANDINGS };
      }
      if (url.includes('/api/championship')) {
        return { ok: true, json: async () => CHAMPIONSHIP };
      }
      return { ok: false };
    }));
  });

  it('renders the championship worm from the championship session_results', async () => {
    renderStatsPage();

    await waitFor(() => {
      expect(screen.getAllByText('Kimi Antonelli').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByRole('button', { name: /worm/i }));

    await waitFor(() => {
      expect(screen.getByText('Championship Progression')).toBeInTheDocument();
    });
    expect(screen.queryByText('No progression data available.')).not.toBeInTheDocument();

    // Both worm views are offered for the fetched rounds. The page tab bar
    // also has a "Constructors" button, so scope the query to the worm card.
    const wormCard = screen.getByText('Championship Progression').closest('.animate-fade-in');
    expect(wormCard).not.toBeNull();
    expect(within(wormCard as HTMLElement).getByRole('button', { name: /drivers \(top 10\)/i })).toBeInTheDocument();
    expect(within(wormCard as HTMLElement).getByRole('button', { name: /constructors/i })).toBeInTheDocument();
  });
});
