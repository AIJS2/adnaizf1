import { render, screen, waitFor } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import DriverProfilePage from '../DriverProfilePage';
import TeamProfilePage from '../TeamProfilePage';
import DriverComparePage from '../DriverComparePage';
import * as api from '../../services/api';

vi.mock('../../services/api', async () => {
  const actual = await vi.importActual<typeof import('../../services/api')>('../../services/api');
  return {
    ...actual,
    fetchDriverProfile: vi.fn(),
    fetchTeamProfile: vi.fn(),
  };
});

const mockDriverVer: api.DriverProfilePayload = {
  id: 'max_verstappen',
  name: 'Max Verstappen',
  abbreviation: 'VER',
  driver_number: 1,
  team: 'Red Bull Racing',
  position: 1,
  points: 50,
  wins: 2,
  podiums: 2,
  poles: 2,
  best_finish: 1,
  avg_finish: 1.0,
  dnfs: 0,
  dnss: 0,
  race_dnfs: 0,
  sprint_dnfs: 0,
  race_dnss: 0,
  sprint_dnss: 0,
  dnf_details: [],
  dns_details: [],
  progression: [
    {
      round: 1,
      race_name: 'Australian Grand Prix',
      location: 'Melbourne',
      points: 25,
      cumulative_points: 25,
      position: 1,
    },
  ],
  teammate: {
    id: 'liam_lawson',
    name: 'Liam Lawson',
    abbreviation: 'LAW',
    driver_number: 30,
    points: 12,
    position: 5,
    race_h2h: { driver_ahead: 2, teammate_ahead: 0 },
    quali_h2h: { driver_ahead: 2, teammate_ahead: 0 },
  },
};

const mockDriverNor: api.DriverProfilePayload = {
  ...mockDriverVer,
  id: 'lando_norris',
  name: 'Lando Norris',
  abbreviation: 'NOR',
  driver_number: 4,
  team: 'McLaren',
  position: 2,
  points: 36,
  wins: 0,
  podiums: 2,
  poles: 0,
};

const mockTeamRedBull: api.TeamProfilePayload = {
  id: 'red_bull',
  name: 'Red Bull Racing',
  position: 1,
  points: 62,
  wins: 2,
  podiums: 2,
  dnfs: 0,
  dnss: 0,
  race_dnfs: 0,
  sprint_dnfs: 0,
  race_dnss: 0,
  sprint_dnss: 0,
  dnf_details: [],
  dns_details: [],
  drivers: [
    {
      driverId: 'max_verstappen',
      number: 1,
      code: 'VER',
      firstName: 'Max',
      lastName: 'Verstappen',
      team: 'Red Bull Racing',
      teamColor: '#3671C6',
      id: 'max_verstappen',
      name: 'Max Verstappen',
      abbreviation: 'VER',
      driver_number: 1,
      points: 50,
      position: 1,
      points_share: 80.6,
    },
    {
      driverId: 'liam_lawson',
      number: 30,
      code: 'LAW',
      firstName: 'Liam',
      lastName: 'Lawson',
      team: 'Red Bull Racing',
      teamColor: '#3671C6',
      id: 'liam_lawson',
      name: 'Liam Lawson',
      abbreviation: 'LAW',
      driver_number: 30,
      points: 12,
      position: 5,
      points_share: 19.4,
    },
  ],
  progression: [
    {
      round: 1,
      race_name: 'Australian Grand Prix',
      location: 'Melbourne',
      points: 33,
      cumulative_points: 33,
    },
  ],
};

describe('DriverProfilePage, TeamProfilePage, and DriverComparePage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(api.fetchDriverProfile).mockImplementation(async (_year, id) => {
      if (String(id).includes('norris')) return mockDriverNor;
      return mockDriverVer;
    });
    vi.mocked(api.fetchTeamProfile).mockResolvedValue(mockTeamRedBull);
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        json: async () => ({
          year: 2026,
          status: 'completed',
          drivers: [mockDriverVer, mockDriverNor],
          teams: [mockTeamRedBull],
        }),
      })),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('renders DriverProfilePage with key stats and teammate H2H', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/driver/max_verstappen']}>
          <Routes>
            <Route path="/driver/:id" element={<DriverProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Max Verstappen').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText(/Red Bull Racing/i).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/Liam Lawson/i).length).toBeGreaterThan(0);
  });

  it('renders TeamProfilePage with championship rank, points, and driver roster', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/team/red_bull']}>
          <Routes>
            <Route path="/team/:id" element={<TeamProfilePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText('Red Bull Racing').length).toBeGreaterThan(0);
    });
    expect(screen.getAllByText('Max Verstappen').length).toBeGreaterThan(0);
  });

  it('renders DriverComparePage and compares two drivers', async () => {
    const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={['/compare?d1=max_verstappen&d2=lando_norris']}>
          <Routes>
            <Route path="/compare" element={<DriverComparePage />} />
          </Routes>
        </MemoryRouter>
      </QueryClientProvider>,
    );

    await waitFor(() => {
      expect(screen.getAllByText(/Max Verstappen/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/Lando Norris/i).length).toBeGreaterThan(0);
    });
  });
});
