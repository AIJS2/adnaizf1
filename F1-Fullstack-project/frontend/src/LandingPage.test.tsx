// LandingPage "Next Race" badge: the badge must never desync (name and
// countdown from the same event), and a race that has not started must still
// show a live countdown rather than a LIVE badge.
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, afterEach } from 'vitest';
import LandingPage from './pages/LandingPage';

const now = new Date();
const TODAY = now.toISOString().slice(0, 10);
const NEXT_WEEKEND = new Date(now.getTime() + 14 * 864e5).toISOString().slice(0, 10);

function mockFetchOnce(payload: unknown) {
  return vi.fn(async (): Promise<Response> => ({
    ok: true,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }) as unknown as Response);
}

function renderLanding() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/']}>
        <LandingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LandingPage next-race badge', () => {
  const original = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = original;
    vi.restoreAllMocks();
  });

  it('shows a live countdown for a race that has not started', async () => {
    globalThis.fetch = mockFetchOnce({
      year: now.getFullYear(),
      race_analytics: [
        { round: 18, name: 'United States Grand Prix', date: NEXT_WEEKEND, status: 'Upcoming' },
      ],
      next_race_event: { name: 'United States Grand Prix - Practice 1', date: `${NEXT_WEEKEND}T17:30:00Z` },
    });

    renderLanding();

    // Badge names the upcoming race.
    await waitFor(() => {
      expect(screen.getByText(/Next Race: United States Grand Prix/)).toBeInTheDocument();
    });

    // No LIVE badge for a race that has not begun.
    expect(screen.queryByText(/RACE IS LIVE/i)).not.toBeInTheDocument();

    // The HARI:JAM:MENIT:DETIK countdown is present and ticking — four tiles.
    expect(screen.getAllByText(/^\d{2}$/).length).toBeGreaterThanOrEqual(4);
  });

  it('shows the LIVE badge when a race is ongoing today AND its start time has passed', async () => {
    globalThis.fetch = mockFetchOnce({
      year: now.getFullYear(),
      race_analytics: [
        { round: 17, name: 'Singapore Grand Prix', date: TODAY, status: 'Ongoing' },
        { round: 18, name: 'United States Grand Prix', date: NEXT_WEEKEND, status: 'Upcoming' },
      ],
      // Start time already in the past -> genuinely live.
      next_race_event: { name: 'Singapore Grand Prix - Race', date: `${TODAY}T00:00:00Z` },
    });

    renderLanding();

    await waitFor(() => {
      expect(screen.getByText(/Live Now: Singapore Grand Prix/)).toBeInTheDocument();
    });
    expect(screen.getByText(/RACE IS LIVE/i)).toBeInTheDocument();
  });

  it('shows a RACE DAY badge + countdown (never LIVE) when race day is before start time', async () => {
    globalThis.fetch = mockFetchOnce({
      year: now.getFullYear(),
      race_analytics: [
        { round: 17, name: 'Singapore Grand Prix', date: TODAY, status: 'Ongoing' },
        { round: 18, name: 'United States Grand Prix', date: NEXT_WEEKEND, status: 'Upcoming' },
      ],
      // Start time far in the future today (e.g. 19:00 local = ~12:00Z) ->
      // still waiting, must NOT read LIVE.
      next_race_event: { name: 'Singapore Grand Prix - Race', date: `${TODAY}T23:59:00Z` },
    });

    renderLanding();

    await waitFor(() => {
      expect(screen.getByText(/Race Day: Singapore Grand Prix/)).toBeInTheDocument();
    });
    // The whole point: no LIVE wording before the start time.
    expect(screen.queryByText(/RACE IS LIVE/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Live Now/i)).not.toBeInTheDocument();
    // A TODAY badge + the countdown tiles are shown instead.
    expect(screen.getByText(/RACE STARTS SOON/i)).toBeInTheDocument();
    expect(screen.getAllByText(/^\d{2}$/).length).toBeGreaterThanOrEqual(4);
  });
});
