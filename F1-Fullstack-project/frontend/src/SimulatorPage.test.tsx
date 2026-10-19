import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import SimulatorPage from './pages/SimulatorPage';

/** Three-driver championship fixture with the official post-R17 points. */
const MOCK_CHAMPIONSHIP = {
  year: 2026,
  drivers: [
    { id: 'kimi_antonelli', name: 'Kimi Antonelli', team: 'Mercedes', position: 1, points: 340, wins: 8, podiums: 13, dnfs: 0, dnss: 0, abbreviation: 'ANT', driver_number: 12 },
    { id: 'george_russell', name: 'George Russell', team: 'Mercedes', position: 2, points: 238, wins: 4, podiums: 10, dnfs: 3, dnss: 0, abbreviation: 'RUS', driver_number: 63 },
    { id: 'lewis_hamilton', name: 'Lewis Hamilton', team: 'Ferrari', position: 3, points: 229, wins: 3, podiums: 9, dnfs: 1, dnss: 0, abbreviation: 'HAM', driver_number: 44 },
  ],
  teams: [],
};

type RaceFixture = {
  round: number;
  name: string;
  location: string;
  date: string;
  status: string;
  is_sprint: boolean;
};

/** The six remaining rounds (R18–R23); all conventional per the 2026 schedule. */
const REMAINING_ROUNDS: RaceFixture[] = [
  { round: 18, name: 'United States Grand Prix', location: 'Austin', date: '2026-10-25', status: 'Upcoming', is_sprint: false },
  { round: 19, name: 'Mexico City Grand Prix', location: 'Mexico City', date: '2026-11-01', status: 'Upcoming', is_sprint: false },
  { round: 20, name: 'São Paulo Grand Prix', location: 'São Paulo', date: '2026-11-08', status: 'Upcoming', is_sprint: false },
  { round: 21, name: 'Las Vegas Grand Prix', location: 'Las Vegas', date: '2026-11-21', status: 'Upcoming', is_sprint: false },
  { round: 22, name: 'Qatar Grand Prix', location: 'Lusail', date: '2026-11-29', status: 'Upcoming', is_sprint: false },
  { round: 23, name: 'Abu Dhabi Grand Prix', location: 'Yas Marina', date: '2026-12-06', status: 'Upcoming', is_sprint: false },
];

/** Same calendar but with a Sprint weekend at R20, to exercise sprint maths. */
const SPRINT_ROUNDS: RaceFixture[] = REMAINING_ROUNDS.map((r) =>
  r.round === 20 ? { ...r, is_sprint: true } : r,
);

let racesFixture: RaceFixture[] = REMAINING_ROUNDS;

function renderSimulatorPage() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={['/simulator']}>
        <SimulatorPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

/**
 * Wait until a controlled select has received its options from the mocked
 * queries; firing `change` earlier is a silent no-op in jsdom.
 */
async function waitForSelectOptions(label: string, count: number): Promise<HTMLSelectElement> {
  const select = screen.getByLabelText(label) as HTMLSelectElement;
  await waitFor(() => {
    expect(select.options.length).toBe(count);
  });
  return select;
}

describe('SimulatorPage race-aware simulation', () => {
  beforeEach(() => {
    racesFixture = REMAINING_ROUNDS;
    vi.stubGlobal('fetch', vi.fn(async (url: string) => {
      if (url.includes('/api/championship')) {
        return { ok: true, json: async () => MOCK_CHAMPIONSHIP };
      }
      if (url.includes('/api/races')) {
        return { ok: true, json: async () => racesFixture };
      }
      return { ok: false };
    }));
  });

  it('offers only the six remaining rounds and defaults to R18', async () => {
    renderSimulatorPage();

    const select = await screen.findByLabelText('Grand Prix') as HTMLSelectElement;
    await waitFor(() => {
      expect(select.options.length).toBe(6);
    });

    const labels = Array.from(select.options).map((o) => o.textContent ?? '');
    expect(labels[0]).toContain('R18');
    expect(labels[5]).toContain('R23');
    expect(labels.some((l) => l.includes('R17'))).toBe(false);
    await waitFor(() => {
      expect(select.value).toBe('18');
    });
  });

  it('disables the Sprint pick on conventional rounds and enables it on Sprint weekends', async () => {
    racesFixture = SPRINT_ROUNDS;
    renderSimulatorPage();

    const raceSelect = await waitForSelectOptions('Grand Prix', 6);
    const sprintSelect = await waitForSelectOptions('Sprint Winner', 4);
    // Default selection is R18, a conventional weekend.
    await waitFor(() => {
      expect(sprintSelect).toBeDisabled();
    });
    expect(screen.getByText(/no Sprint session/i)).toBeInTheDocument();

    fireEvent.change(raceSelect, { target: { value: '20' } });
    await waitFor(() => {
      expect(sprintSelect).not.toBeDisabled();
    });
  });

  it('counts 156 max possible points with no Sprint sessions left', async () => {
    renderSimulatorPage();

    await waitFor(() => {
      expect(screen.getByText('Max Possible Points')).toBeInTheDocument();
    });
    // 6 remaining rounds x (25 win + 1 fastest lap) = 156.
    expect(screen.getByText('+156')).toBeInTheDocument();
    expect(screen.getByText(/6 rounds left/i)).toBeInTheDocument();
    expect(screen.getByText(/no Sprint sessions left/i)).toBeInTheDocument();
    expect(screen.getByText(/Title fight mathematically open/i)).toBeInTheDocument();
  });

  it('adds +8 per Sprint weekend to the max possible points', async () => {
    racesFixture = SPRINT_ROUNDS;
    renderSimulatorPage();

    // 6 rounds x 26 + 1 Sprint weekend x 8 = 164.
    await waitFor(() => {
      expect(screen.getByText('+164')).toBeInTheDocument();
    });
    expect(screen.getByText(/incl. 1 Sprint \(\+8 each\)/i)).toBeInTheDocument();
  });

  it('applies the predicted winner points to the selected round', async () => {
    renderSimulatorPage();

    const p1Select = await waitForSelectOptions('P1 Winner', 4);
    fireEvent.change(p1Select, { target: { value: 'george_russell' } });
    fireEvent.click(screen.getByRole('button', { name: /compute/i }));

    // 238 + 25 = 263 and the "+25" gain badge appears.
    await waitFor(() => {
      expect(screen.getByText('263')).toBeInTheDocument();
    });
    // The drivers table and the teams table both show a "+25" gain badge.
    expect(screen.getAllByText('+25').length).toBeGreaterThan(0);
    expect(screen.getByText('Simulated')).toBeInTheDocument();
  });

  it('credits Sprint winner points at a Sprint weekend and clears the pick when switching away', async () => {
    racesFixture = SPRINT_ROUNDS;
    renderSimulatorPage();

    const raceSelect = await waitForSelectOptions('Grand Prix', 6);
    await waitForSelectOptions('Sprint Winner', 4);
    fireEvent.change(raceSelect, { target: { value: '20' } });

    const sprintSelect = screen.getByLabelText('Sprint Winner') as HTMLSelectElement;
    await waitFor(() => {
      expect(sprintSelect).not.toBeDisabled();
    });
    fireEvent.change(sprintSelect, { target: { value: 'george_russell' } });
    fireEvent.click(screen.getByRole('button', { name: /compute/i }));

    // 238 + 8 sprint win = 246.
    await waitFor(() => {
      expect(screen.getByText('246')).toBeInTheDocument();
    });

    // Switching to a conventional round clears the sprint pick.
    fireEvent.change(raceSelect, { target: { value: '18' } });
    await waitFor(() => {
      expect((screen.getByLabelText('Sprint Winner') as HTMLSelectElement).value).toBe('');
    });
  });
});
