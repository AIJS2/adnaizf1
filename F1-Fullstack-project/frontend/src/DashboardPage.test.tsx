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

// ---------------------------------------------------------------------------
// Regression: the "Next Grand Prix" hero section must show ONE event, with the
// name and the countdown target derived from the same event.
//
// Bug: on race day the backend's `next_race_event` pointed at the race
// happening today, while `race_analytics` already listed the next weekend as
// "Upcoming". The page rendered the next weekend's NAME but counted down to
// today's race — e.g. "UNITED STATES GRAND PRIX" with a 10-hour timer for the
// Singapore GP.
// ---------------------------------------------------------------------------
describe('DashboardPage next-race name/countdown sync', () => {
  const original = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = original;
    vi.restoreAllMocks();
  });

  /**
   * Anchored to "now" so the test is not date-sensitive.
   * The Singapore GP is ongoing today, so the backend's `next_race_event`
   * resolves to today's Singapore race, while `race_analytics` already marks
   * the US GP (next weekend) as "Upcoming".
   */
  const now = new Date();
  const TODAY = now.toISOString().slice(0, 10);
  const NEXT_WEEKEND = new Date(now.getTime() + 14 * 864e5).toISOString().slice(0, 10);
  const TODAY_T20 = `${TODAY}T20:00:00Z`;

  const RACE_DAY = {
    year: 2025,
    total_races: 24,
    last_race_name: 'Japanese Grand Prix',
    driver_standings: [{ name: 'Lando Norris', team: 'McLaren', points: '300' }],
    team_standings: [{ name: 'McLaren', points: '500' }],
    race_analytics: [
      { round: 17, name: 'Singapore Grand Prix', date: TODAY, location: 'Singapore', status: 'Ongoing', winner: null },
      { round: 18, name: 'United States Grand Prix', date: NEXT_WEEKEND, location: 'Austin', status: 'Upcoming', winner: null },
    ],
    // Backend _find_next_session: first session starting after now -> today's race.
    next_race_event: { name: 'Singapore Grand Prix - Race', date: TODAY_T20 },
  };

  it('shows the same event in the heading and the countdown target', async () => {
    globalThis.fetch = mockFetchOnce(RACE_DAY);

    renderDashboard();

    // The hero heading must name the SAME event the timer is counting to.
    // Before the fix this rendered the US GP name (next weekend) while
    // counting down to today's Singapore race.
    await waitFor(() => {
      const heroH1 = Array.from(document.querySelectorAll('h1'))
        .some((h) => h.textContent === 'Singapore Grand Prix');
      expect(heroH1).toBe(true);
    });

    // The next weekend's race must NOT be the hero heading on race day.
    const heroIsUS = Array.from(document.querySelectorAll('h1'))
      .some((h) => h.textContent === 'United States Grand Prix');
    expect(heroIsUS).toBe(false);

    // The countdown must show the LIVE badge (today's race is on track), not a
    // day count. A "00DAYS" tile would mean the timer had desynced to next
    // weekend while the name still said Singapore.
    expect(screen.queryByText(/SESSION IS LIVE ON TRACK/i)).toBeInTheDocument();
    const daysTile = Array.from(document.querySelectorAll('div'))
      .find((d) => d.textContent === '00DAYS');
    expect(daysTile).toBeUndefined();
  });

  it('counts down to the US GP once Singapore has finished', async () => {
    const afterSingapore = {
      ...RACE_DAY,
      race_analytics: [
        { round: 17, name: 'Singapore Grand Prix', date: TODAY, location: 'Singapore', status: 'Finished', winner: 'Lando Norris' },
        { round: 18, name: 'United States Grand Prix', date: NEXT_WEEKEND, location: 'Austin', status: 'Upcoming', winner: null },
      ],
      next_race_event: { name: 'United States Grand Prix - Practice 1', date: `${NEXT_WEEKEND}T17:30:00Z` },
    };
    globalThis.fetch = mockFetchOnce(afterSingapore);

    renderDashboard();

    await waitFor(() => {
      // The race name appears in several places (hero, calendar, "Next:"),
      // so assert on the hero heading specifically via its h1 element.
      const heroH1 = Array.from(document.querySelectorAll('h1'))
        .some((h) => h.textContent === 'United States Grand Prix');
      expect(heroH1).toBe(true);
    });

    // Singapore's race is over, so it must not be the hero heading any more.
    const heroIsSingapore = Array.from(document.querySelectorAll('h1'))
      .some((h) => h.textContent === 'Singapore Grand Prix');
    expect(heroIsSingapore).toBe(false);

    // A race that has not started yet must still show the day/hour/min/sec
    // countdown — the LIVE badge is only for races happening right now.
    expect(screen.queryByText(/SESSION IS LIVE ON TRACK/i)).not.toBeInTheDocument();
    expect(screen.getAllByText('DAYS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('HRS').length).toBeGreaterThan(0);
    expect(screen.getAllByText('MIN').length).toBeGreaterThan(0);
    expect(screen.getAllByText('SEC').length).toBeGreaterThan(0);

    // The timer is now two weeks out, so the days tile must NOT read 00.
    const daysTile = Array.from(document.querySelectorAll('div'))
      .find((d) => d.textContent === '00DAYS');
    expect(daysTile).toBeUndefined();
  });
});
