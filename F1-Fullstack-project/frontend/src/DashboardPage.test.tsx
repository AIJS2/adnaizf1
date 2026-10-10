// Reproduces the "Zero Mock Data" crash on /dashboard.
//
// After the mock-data purge the dashboard endpoint can legitimately answer
// with a pre-season payload (no standings, no calendar) or with the backend
// `{ error: ... }` envelope. Every one of those must render as an empty or
// error state instead of throwing on a property read of a missing object.
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import DashboardPage from './pages/DashboardPage';

/** Payload for a season that has not started: no standings, no calendar. */
const PRE_SEASON = {
  year: 2026,
  status: 'pre_season',
  message: 'Season has not started yet.',
  driver_standings: [],
  team_standings: [],
  race_analytics: [],
  next_race_event: null,
};

/** Payload where the API answered with the backend error envelope. */
const API_ERROR = { error: 'Failed to load dashboard' };

function mockFetchOnce(payload: unknown) {
  return vi.fn(
    async (): Promise<Response> =>
      ({
        ok: true,
        json: async () => payload,
        text: async () => JSON.stringify(payload),
      }) as unknown as Response,
  );
}

function renderDashboard() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/dashboard']}>
        <DashboardPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('DashboardPage with empty / pre-season backend data', () => {
  const original = globalThis.fetch;

  beforeEach(() => {
    globalThis.fetch = mockFetchOnce(PRE_SEASON);
  });

  afterEach(() => {
    globalThis.fetch = original;
    vi.restoreAllMocks();
  });

  it('renders the empty pre-season dashboard without throwing', async () => {
    renderDashboard();

    // The page's hero heading must be present even though every collection
    // is empty. Before the fix this threw
    // "Cannot read properties of undefined (reading 'M_ID')".
    await waitFor(() => {
      expect(screen.getByText('Grand Prix')).toBeInTheDocument();
    });
  });

  it('shows an empty-state message when the backend has no data at all', async () => {
    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText(/no (live )?data available/i)).toBeInTheDocument();
    });
  });

  it('falls back to the previous season when the current one is pre-season', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce({
        ok: true,
        json: async () => PRE_SEASON,
        text: async () => JSON.stringify(PRE_SEASON),
      } as unknown as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          year: 2025,
          driver_standings: [{ name: 'Lando Norris', team: 'McLaren', points: '408' }],
          team_standings: [],
          race_analytics: [],
        }),
        text: async () => '{}',
      } as unknown as Response);
    globalThis.fetch = fetchMock;

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Lando Norris (408 PTS)')).toBeInTheDocument();
    });
  });

  it('never renders "undefined" in the season calendar card', async () => {
    renderDashboard();

    // A pre-season payload with no `year` must fall back to the current year
    // rather than printing "undefined FIA F1 Season".
    await waitFor(() => {
      expect(screen.getByText(/FIA F1 Season$/)).toBeInTheDocument();
    });
    expect(document.body.textContent).not.toContain('undefined');
  });
});

describe('DashboardPage with the backend error envelope', () => {
  const original = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = original;
    vi.restoreAllMocks();
  });

  it('renders the error state instead of crashing', async () => {
    globalThis.fetch = mockFetchOnce(API_ERROR);

    renderDashboard();

    await waitFor(() => {
      expect(screen.getByText('Failed to load dashboard')).toBeInTheDocument();
    });
  });
});
