// Regression tests for the RacesPage "Next Up" hero banner.
//
// Bug: on race day the hero banner jumped to next weekend instead of the race
// happening today. The old `nextRace` logic compared
// `new Date(r.date + 'T00:00:00') >= new Date()`, which is already in the past
// by midday on race day, so today's "Ongoing" race was skipped and the banner
// showed "UNITED STATES GRAND PRIX" (Round 18) while the Singapore GP
// (Round 17) was actually on track.
//
// The fix compares by whole calendar day and includes "Ongoing" races, so a
// race happening today wins over one next weekend.
import { render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, afterEach } from 'vitest';
import RacesPage from './pages/RacesPage';

/** Anchored to "now" so the test is not date-sensitive. */
const now = new Date();
const TODAY = now.toISOString().slice(0, 10);
const NEXT_WEEKEND = new Date(now.getTime() + 14 * 864e5).toISOString().slice(0, 10);
const LAST_WEEK = new Date(now.getTime() - 7 * 864e5).toISOString().slice(0, 10);

/**
 * Race-day calendar: last week's race is finished, today's race is Ongoing,
 * and next weekend's race is Upcoming. Mirrors the live 2026 calendar on
 * 2026-10-11 (Singapore Ongoing, US GP Upcoming).
 */
const RACE_DAY_CALENDAR = [
  { round: 16, name: 'Bahrain Grand Prix', date: LAST_WEEK, location: 'Kuala Lumpur', status: 'Finished', winner: 'Lando Norris', winner_team: 'McLaren' },
  { round: 17, name: 'Singapore Grand Prix', date: TODAY, location: 'Marina Bay', status: 'Ongoing', winner: null },
  { round: 18, name: 'United States Grand Prix', date: NEXT_WEEKEND, location: 'Austin', status: 'Upcoming', winner: null },
  { round: 19, name: 'Mexico City Grand Prix', date: new Date(now.getTime() + 21 * 864e5).toISOString().slice(0, 10), location: 'Mexico City', status: 'Upcoming', winner: null },
];

function mockRacesFetch(payload: unknown) {
  return vi.fn(async (): Promise<Response> => ({
    ok: true,
    json: async () => payload,
    text: async () => JSON.stringify(payload),
  }) as unknown as Response);
}

function renderRacesPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/races']}>
        <RacesPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('RacesPage "Next Up" hero banner', () => {
  const original = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = original;
    vi.restoreAllMocks();
  });

  it('shows today\'s Ongoing race, not next weekend\'s Upcoming race', async () => {
    globalThis.fetch = mockRacesFetch(RACE_DAY_CALENDAR);

    renderRacesPage();

    // The "Next Up" banner must name today's race (Round 17).
    // The name also appears in the calendar card below, so match all.
    await waitFor(() => {
      expect(screen.getAllByText('Singapore Grand Prix').length).toBeGreaterThan(0);
    });

    // The banner's round label must be Round 17 (today), not Round 18.
    expect(screen.getByText(/Next Up · Round 17/)).toBeInTheDocument();
    expect(screen.queryByText(/Next Up · Round 18/)).not.toBeInTheDocument();

    // Next weekend's race must not appear in the hero banner heading.
    const bannerHeadings = Array.from(document.querySelectorAll('h2'))
      .map((h) => h.textContent);
    expect(bannerHeadings).toContain('Singapore Grand Prix');
    expect(bannerHeadings).not.toContain('United States Grand Prix');

    // The ongoing race shows a LIVE NOW badge, never a 0h 0m countdown.
    // It appears in both the hero banner and the Singapore race card.
    expect(screen.getAllByText(/LIVE NOW/i).length).toBeGreaterThan(0);
    expect(screen.queryByText('0h')).not.toBeInTheDocument();
    expect(screen.queryByText('0m')).not.toBeInTheDocument();
  });

  it('switches to the next weekend once today\'s race finishes', async () => {
    const afterRaceDay = RACE_DAY_CALENDAR.map((r) =>
      r.round === 17 ? { ...r, status: 'Finished' } : r,
    );
    globalThis.fetch = mockRacesFetch(afterRaceDay);

    renderRacesPage();

    await waitFor(() => {
      expect(screen.getByText(/Next Up · Round 18/)).toBeInTheDocument();
    });

    const bannerHeadings = Array.from(document.querySelectorAll('h2'))
      .map((h) => h.textContent);
    expect(bannerHeadings).toContain('United States Grand Prix');
    expect(bannerHeadings).not.toContain('Singapore Grand Prix');
  });

  it('shows a future race when no race is happening today', async () => {
    const midSeason = [
      { round: 3, name: 'Japanese Grand Prix', date: LAST_WEEK, location: 'Suzuka', status: 'Finished', winner: 'Max Verstappen', winner_team: 'Red Bull Racing' },
      { round: 4, name: 'Miami Grand Prix', date: NEXT_WEEKEND, location: 'Miami Gardens', status: 'Upcoming', winner: null },
      { round: 5, name: 'Canadian Grand Prix', date: new Date(now.getTime() + 21 * 864e5).toISOString().slice(0, 10), location: 'Montréal', status: 'Upcoming', winner: null },
    ];
    globalThis.fetch = mockRacesFetch(midSeason);

    renderRacesPage();

    await waitFor(() => {
      expect(screen.getByText(/Next Up · Round 4/)).toBeInTheDocument();
    });
    // Miami also appears in the calendar card below the banner.
    expect(screen.getAllByText('Miami Grand Prix').length).toBeGreaterThan(0);

    // A race that has not started yet must still show a live countdown, not a
    // LIVE badge and not nothing at all.
    expect(screen.queryByText(/LIVE NOW/i)).not.toBeInTheDocument();
    expect(screen.getAllByText(/^\d+d$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^\d+h$/).length).toBeGreaterThan(0);
    expect(screen.getAllByText(/^\d+m$/).length).toBeGreaterThan(0);
  });
});
