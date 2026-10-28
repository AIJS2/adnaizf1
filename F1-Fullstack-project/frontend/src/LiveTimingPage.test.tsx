import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest';
import LiveTimingPage from './pages/LiveTimingPage';

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const MOCK_DASHBOARD = {
  year: 2026,
  status: 'active',
  race_analytics: [
    {
      round: 1,
      name: 'Bahrain Grand Prix',
      date: futureDate,
      winner: null,
      top_drivers: [],
    },
  ],
  next_race_event: {
    name: 'Bahrain Grand Prix - Race',
    date: futureDate,
    round: 1,
  },
};

class MockWebSocket {
  static instances: MockWebSocket[] = [];
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;

  constructor(public url: string) {
    MockWebSocket.instances.push(this);
  }

  close() {}
  send() {}

  emitOpen() {
    this.onopen?.();
  }

  emitMessage(payload: unknown) {
    this.onmessage?.({ data: JSON.stringify(payload) });
  }
}

function renderLiveTiming(entry = '/live-timing') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <LiveTimingPage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('LiveTimingPage empty state & countdown integration', () => {
  const origFetch = globalThis.fetch;
  const origWebSocket = globalThis.WebSocket;

  beforeEach(() => {
    MockWebSocket.instances = [];
    // @ts-expect-error mock websocket
    globalThis.WebSocket = MockWebSocket;
    globalThis.fetch = vi.fn(async () => ({
      ok: true,
      json: async () => MOCK_DASHBOARD,
      text: async () => JSON.stringify(MOCK_DASHBOARD),
    })) as unknown as typeof fetch;
  });

  afterEach(() => {
    globalThis.fetch = origFetch;
    globalThis.WebSocket = origWebSocket;
  });

  it('renders "No Live Session Data" and the integrated HeroCountdown centerpiece when there is no live data', async () => {
    renderLiveTiming();

    expect(screen.getByText(/No Live Session Data/i)).toBeInTheDocument();
    expect(screen.getByText(/Timing appears here only while an F1 session is running/i)).toBeInTheDocument();

    await waitFor(() => {
      // The next-round name appears in the countdown and in the track-map
      // preview overlay, so more than one matching node is expected.
      expect(screen.getAllByText(/Bahrain Grand Prix/i).length).toBeGreaterThan(0);
    });

    expect(screen.getByText(/LIGHTS OUT COUNTDOWN/i)).toBeInTheDocument();
  });

  it('shows the paywall message when the backend reports unavailable_subscription', () => {    renderLiveTiming();
    const socket = MockWebSocket.instances[0];
    expect(socket).toBeDefined();

    act(() => {
      socket.emitOpen();
      socket.emitMessage({
        type: 'TimingData',
        status: 'unavailable_subscription',
        is_live_session: false,
        lines: [],
        trackStatus: 'GREEN',
        weather: { air: '--', track: '--', humidity: '--', rain: '--' },
        messages: [],
        radio: [],
        reason: 'auth',
      });
    });

    // The timing table and the team-radio panel both show the heading.
    expect(
      screen.getAllByRole('heading', { name: /LIVE TIMING UNAVAILABLE/i }).length,
    ).toBeGreaterThanOrEqual(2);
    // The timing table and the team-radio panel share the same explanation.
    expect(
      screen.getAllByText(/Real-time timing requires a paid data feed/i).length,
    ).toBeGreaterThanOrEqual(2);
    expect(
      screen.getByText(/never simulates telemetry/i),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Live race control is unavailable/i),
    ).toBeInTheDocument();
  });

  it('renders the finished-session badge, session title, chequered flag and real circuit map', () => {
    renderLiveTiming();
    const socket = MockWebSocket.instances[0];
    expect(socket).toBeDefined();

    act(() => {
      socket.emitOpen();
      socket.emitMessage({
        type: 'TimingData',
        status: 'live',
        is_live_session: true,
        session_state: 'finished',
        session_title: 'United States Grand Prix — Race',
        circuit: {
          key: 'austin',
          name: 'Circuit of the Americas',
          location: 'Austin',
          country: 'USA',
          viewBox: '0 0 500 500',
          path: 'M 10 10 L 100 10 L 100 100 Z',
        },
        lap: 56,
        total_laps: 56,
        lines: [
          {
            position: 1,
            driver: 'VER',
            team: 'Red Bull Racing',
            status: 'TRACK',
            gap: 'LEADER',
            interval: '-',
            lastLap: '1:38.000',
            lap_color: 'yellow',
            sector1: '-',
            s1_color: 'yellow',
            sector2: '-',
            s2_color: 'yellow',
            sector3: '-',
            s3_color: 'yellow',
            pits: 0,
            tyre: 'M',
            tyre_age: 5,
            progress: 0,
            gap_seconds: 0,
          },
          {
            position: 2,
            driver: 'NOR',
            team: 'McLaren',
            status: 'TRACK',
            gap: '+12.345',
            interval: '+12.345',
            lastLap: '1:38.500',
            lap_color: 'yellow',
            sector1: '-',
            s1_color: 'yellow',
            sector2: '-',
            s2_color: 'yellow',
            sector3: '-',
            s3_color: 'yellow',
            pits: 0,
            tyre: 'H',
            tyre_age: 8,
            progress: 0.126,
            gap_seconds: 12.345,
          },
        ],
        trackStatus: 'GREEN',
        weather: { air: '25°C', track: '30°C', humidity: '40%', rain: '0%' },
        messages: [],
        radio: [],
      });
    });

    expect(
      screen.getByText('🏁 SESSION FINISHED — FINAL CLASSIFICATION'),
    ).toBeInTheDocument();
    expect(screen.getByText('United States Grand Prix • Race')).toBeInTheDocument();
    expect(
      screen.getByText('🏁 CHEQUERED FLAG (SESSION ENDED)'),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/CIRCUIT OF THE AMERICAS — TRACK MAP/i),
    ).toBeInTheDocument();
    expect(screen.getByTestId('circuit-track-map')).toBeInTheDocument();
    expect(screen.queryByText(/TRACK MAP SIMULATION/i)).not.toBeInTheDocument();
  });

  it('shows the last completed session and archive/simulator links when no session is active', () => {
    renderLiveTiming();
    const socket = MockWebSocket.instances[0];
    expect(socket).toBeDefined();

    act(() => {
      socket.emitOpen();
      socket.emitMessage({
        type: 'TimingData',
        status: 'no_session',
        session_state: 'no_session',
        is_live_session: false,
        last_session: {
          session_title: 'Singapore Grand Prix — Race',
          circuit: {
            key: 'marina-bay',
            name: 'Marina Bay Street Circuit',
            location: 'Marina Bay',
            country: 'Singapore',
            viewBox: '0 0 500 500',
            path: 'M 0 0 L 10 10',
          },
          lap: 62,
          total_laps: 62,
          leader: 'VER',
        },
        lines: [],
        trackStatus: 'GREEN',
        weather: { air: '--', track: '--', humidity: '--', rain: '--' },
        messages: [],
        radio: [],
      });
    });

    expect(screen.getByText('Last Completed Session')).toBeInTheDocument();
    expect(screen.getByText('Singapore Grand Prix — Race')).toBeInTheDocument();
    expect(screen.getByText('NO SESSION')).toBeInTheDocument();
    expect(screen.queryByText('GREEN')).not.toBeInTheDocument();
    expect(
      screen.getByRole('link', { name: /View Race Archive/i }),
    ).toHaveAttribute('href', '/races');
    expect(
      screen.getByRole('link', { name: /Open Simulator/i }),
    ).toHaveAttribute('href', '/simulator');
  });

  it('renders previous race telemetry when clicking Previous Race and switches back to Live', () => {
    renderLiveTiming();

    const socket = MockWebSocket.instances[0];
    expect(socket).toBeDefined();

    act(() => {
      socket.emitOpen();
      socket.emitMessage({
        type: 'TimingData',
        session_title: 'Australian Grand Prix — Free Practice 1',
        session_state: 'no_session',
        status: 'live',
        is_live_session: false,
        circuit: null,
        lap: null,
        total_laps: null,
        last_session: {
          session_title: 'United States Grand Prix — Race',
          session_state: 'finished',
          circuit: {
            key: 'cota',
            name: 'Circuit of the Americas',
            location: 'Austin',
            country: 'USA',
            viewBox: '0 0 500 500',
            path: 'M 10 10 L 50 50',
          },
          lap: 56,
          total_laps: 56,
          leader: 'ANT',
          leader_team: 'Mercedes',
          lines: [
            {
              position: 1,
              driver: 'ANT',
              driver_name: 'Kimi Antonelli',
              team: 'Mercedes',
              interval: 'LEADER',
              gap: 'LEADER',
              best_lap: '1:37.234',
              last_lap: '1:38.100',
              s1: '25.100',
              s2: '38.200',
              s3: '33.934',
              s1_color: 'purple',
              s2_color: 'green',
              s3_color: 'yellow',
              tyre_compound: 'HARD',
              tyre_age: 18,
              pits: 1,
            },
            {
              position: 2,
              driver: 'VER',
              driver_name: 'Max Verstappen',
              team: 'Red Bull Racing',
              interval: '+1.450',
              gap: '+1.450',
              best_lap: '1:37.500',
              last_lap: '1:38.300',
              s1: '25.300',
              s2: '38.100',
              s3: '34.100',
              s1_color: 'green',
              s2_color: 'purple',
              s3_color: 'yellow',
              tyre_compound: 'HARD',
              tyre_age: 19,
              pits: 1,
            },
          ],
          trackStatus: 'FINISH',
          weather: { air: '22.9°C', track: '37.8°C', humidity: '31%', rain: '0%' },
          messages: [{ time: '16:45', msg: 'CHEQUERED FLAG', type: 'flag' }],
          radio: [],
        },
        lines: [],
        trackStatus: 'NO SESSION',
        weather: { air: '--', track: '--', humidity: '--', rain: '--' },
        messages: [],
        radio: [],
      });
    });

    // In live mode without active session, empty state is visible
    expect(screen.getByText('No Live Session Data')).toBeInTheDocument();
    expect(screen.queryByText('Kimi Antonelli')).not.toBeInTheDocument();

    // Click the "Previous" toggle button
    const prevButtons = screen.getAllByRole('button', { name: /Previous/i });
    expect(prevButtons.length).toBeGreaterThan(0);
    act(() => {
      fireEvent.click(prevButtons[0]);
    });

    // Classification table, tyre strategy, driver rows, weather and status are now rendered
    expect(screen.getAllByText('ANT').length).toBeGreaterThanOrEqual(2);
    expect(screen.getAllByText('VER').length).toBeGreaterThanOrEqual(2);

    // The timing table must grow with the field instead of trapping drivers in
    // a nested vertical scroller; only horizontal overflow is allowed.
    const timingScroll = screen.getByTestId('timing-table-scroll');
    expect(timingScroll.className).toContain('overflow-x-auto');
    expect(timingScroll.className).not.toContain('max-h');
    expect(timingScroll.className).not.toContain('overflow-y');

    expect(screen.getByText('22.9°C')).toBeInTheDocument();
    expect(screen.getByText('37.8°C')).toBeInTheDocument();
    expect(screen.getAllByText(/CHEQUERED FLAG/i).length).toBeGreaterThanOrEqual(2);

    // Click "Live Race" toggle button to switch back
    const liveButtons = screen.getAllByRole('button', { name: /Live Race/i });
    act(() => {
      fireEvent.click(liveButtons[0]);
    });

    // Returns to live empty state
    expect(screen.getByText('No Live Session Data')).toBeInTheDocument();
    expect(screen.queryByText('ANT')).not.toBeInTheDocument();
  });
});
