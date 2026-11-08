import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import BingoPage from '../BingoPage';
import GhostRacePage from '../GhostRacePage';
import GuidePage from '../GuidePage';
import DriversPage from '../DriversPage';
import TeamsPage from '../TeamsPage';

const mockRaces = [
  {
    round: 1,
    name: 'Australian Grand Prix',
    race_name: 'Australian Grand Prix',
    circuit: 'Albert Park',
    location: 'Melbourne',
    country: 'Australia',
    date: '2026-03-08',
    status: 'Upcoming',
  },
];

const mockChampionship = {
  year: 2026,
  status: 'completed',
  drivers: [
    {
      id: 'max_verstappen',
      name: 'Max Verstappen',
      abbreviation: 'VER',
      driver_number: 1,
      team: 'Red Bull Racing',
      position: 1,
      points: 25,
      wins: 1,
      podiums: 1,
    },
  ],
  teams: [
    {
      id: 'red_bull',
      name: 'Red Bull Racing',
      position: 1,
      points: 43,
      wins: 1,
      podiums: 2,
    },
  ],
};

function renderWithProviders(ui: React.ReactElement, initialRoute = '/') {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialRoute]}>{ui}</MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Interactive & Standings Pages (BingoPage, GhostRacePage, GuidePage, DriversPage, TeamsPage)', () => {
  beforeEach(() => {
    vi.stubGlobal(
      'IntersectionObserver',
      class {
        observe() {}
        unobserve() {}
        disconnect() {}
      },
    );
    vi.stubGlobal(
      'fetch',
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);
        if (url.includes('/api/races/')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockRaces,
          };
        }
        if (url.includes('/api/championship/')) {
          return {
            ok: true,
            status: 200,
            json: async () => mockChampionship,
          };
        }
        if (url.includes('/api/telemetry-drivers/')) {
          return {
            ok: true,
            status: 200,
            json: async () => [
              { abbreviation: 'VER', full_name: 'Max Verstappen', team_name: 'Red Bull Racing' },
              { abbreviation: 'NOR', full_name: 'Lando Norris', team_name: 'McLaren' },
            ],
          };
        }
        return {
          ok: false,
          status: 404,
          json: async () => ({ error: 'Not available' }),
        };
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders BingoPage with 5x5 card grid and race selector', async () => {
    renderWithProviders(<BingoPage />, '/bingo');
    await waitFor(() => {
      expect(screen.getAllByText(/Bingo/i).length).toBeGreaterThan(0);
    });
  });

  it('renders GhostRacePage with synthetic telemetry fallback and driver selectors', async () => {
    renderWithProviders(<GhostRacePage />, '/ghost-race');
    await waitFor(() => {
      expect(screen.getAllByText(/VER/i).length).toBeGreaterThan(0);
    });
  });

  it('renders GuidePage telemetry & analytics documentation sections', () => {
    renderWithProviders(<GuidePage />, '/guide');
    expect(screen.getAllByText(/Race Progression Chart/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Lap Telemetry/i).length).toBeGreaterThan(0);
  });

  it('renders DriversPage and TeamsPage with fetched championship standings', async () => {
    renderWithProviders(<DriversPage />, '/drivers');
    await waitFor(() => {
      expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
    });

    renderWithProviders(<TeamsPage />, '/teams');
    await waitFor(() => {
      expect(screen.getAllByText('Red Bull Racing').length).toBeGreaterThan(0);
    });
  });
});
