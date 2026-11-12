import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RaceDetailPage from '../RaceDetailPage';

const COMPLETED_RACE_FIXTURE = {
  race_info: {
    name: 'Japanese Grand Prix',
    circuit: 'Suzuka Circuit',
    location: 'Suzuka',
    country: 'Japan',
    date: '2026-04-05',
    round: 3,
  },
  status: 'Finished',
  available_tabs: ['Qualifying', 'Race'],
  race_winner: {
    full_name: 'Lando Norris',
    team_name: 'McLaren',
  },
  pole_position: {
    full_name: 'Max Verstappen',
    team_name: 'Red Bull Racing',
  },
  fastest_lap: {
    full_name: 'Lando Norris',
    lap_number: 44,
    lap_time: '1:30.983',
    time: '1:30.983',
  },
  results: [
    {
      position: 1,
      abbreviation: 'NOR',
      full_name: 'Lando Norris',
      team_name: 'McLaren',
      grid_position: 2,
      time: '1:28:12.000',
      status: 'Finished',
      points: 25,
      laps: 53,
    },
  ],
  qualifying_results: [
    {
      position: 1,
      abbreviation: 'VER',
      full_name: 'Max Verstappen',
      team_name: 'Red Bull Racing',
      q1: '1:29.500',
      q2: '1:29.100',
      q3: '1:28.877',
    },
  ],
  tyre_strategy: [
    {
      driver: 'NOR',
      position: 1,
      team: 'McLaren',
      stints: [
        { compound: 'MEDIUM', start_lap: 1, end_lap: 22, total_laps: 22 },
        { compound: 'HARD', start_lap: 23, end_lap: 53, total_laps: 31 },
      ],
    },
  ],
  weather_info: [],
};

const SCHEDULE_FIXTURE = [
  { round: 3, name: 'Japanese Grand Prix', location: 'Suzuka', country: 'Japan', date: '2026-04-05' },
  { round: 21, name: 'Las Vegas Grand Prix', location: 'Las Vegas', country: 'United States', date: '2026-11-21' },
];

function renderRaceDetailPage(initialEntry = '/race/2026/3') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[initialEntry]}>
        <Routes>
          <Route path="/race/:year/:round" element={<RaceDetailPage />} />
        </Routes>
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RaceDetailPage', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders completed race summary cards, fastest lap time, and switches tabs via click & keyboard', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/races/2026')) {
          return { ok: true, json: async () => SCHEDULE_FIXTURE };
        }
        return { ok: true, json: async () => COMPLETED_RACE_FIXTURE };
      }),
    );

    renderRaceDetailPage('/race/2026/3');

    await waitFor(() => {
      expect(screen.getByText('Japanese Grand Prix')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Lando Norris').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Max Verstappen').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1:30.983').length).toBeGreaterThan(0);

    const qualifyingBtn = screen.getByRole('button', { name: /Qualifying/i });
    fireEvent.click(qualifyingBtn);
    expect(screen.getByText('1:28.877')).toBeInTheDocument();

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(screen.getByRole('button', { name: /^Race$/i })).toBeInTheDocument();
  });

  it('renders upcoming race weekend preview when status is Upcoming', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string) => {
        if (url.includes('/api/races/2026')) {
          return { ok: true, json: async () => SCHEDULE_FIXTURE };
        }
        return {
          ok: true,
          json: async () => ({
            race_info: {
              name: 'Las Vegas Grand Prix',
              circuit: 'Las Vegas Strip Circuit',
              location: 'Las Vegas',
              country: 'United States',
              date: '2026-11-21',
              round: 21,
            },
            status: 'Upcoming',
            available_tabs: [],
            message: 'This race weekend has not started yet.',
          }),
        };
      }),
    );

    renderRaceDetailPage('/race/2026/21');

    await waitFor(() => {
      expect(screen.getByText('Las Vegas Grand Prix')).toBeInTheDocument();
    });
    expect(screen.getByText('Upcoming Race Weekend')).toBeInTheDocument();
    expect(screen.getByText('This race weekend has not started yet.')).toBeInTheDocument();
  });
});
