import { act, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import OverlayLivePage from './pages/OverlayLivePage';

const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

const MOCK_DASHBOARD = {
  year: 2026,
  status: 'active',
  race_analytics: [
    {
      round: 19,
      name: 'Mexico City Grand Prix',
      date: futureDate,
      winner: null,
      top_drivers: [],
    },
  ],
  next_race_event: {
    name: 'Mexico City Grand Prix - Race',
    date: futureDate,
    round: 19,
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

function renderOverlay(entry = '/overlay/live') {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      <MemoryRouter initialEntries={[entry]}>
        <OverlayLivePage />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('OverlayLivePage', () => {
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

  it('renders the next-round circuit preview and an empty timing state before a session starts', async () => {
    renderOverlay();

    expect(screen.getByText(/Awaiting live session/i)).toBeInTheDocument();
    expect(screen.getByText(/NO LIVE SESSION/i)).toBeInTheDocument();

    await waitFor(() => {
      expect(screen.getByTestId('circuit-track-map')).toBeInTheDocument();
    });
    expect(screen.getByText(/Next round · Mexico City Grand Prix/i)).toBeInTheDocument();
  });

  it('renders the timing tower, circuit map and race-control ticker from a live feed', async () => {
    renderOverlay();

    const socket = MockWebSocket.instances[0];
    expect(socket).toBeDefined();

    act(() => {
      socket.emitOpen();
      socket.emitMessage({
        type: 'TimingData',
        status: 'live',
        is_live_session: true,
        session_state: 'live',
        session_title: 'Mexico City Grand Prix — Race',
        circuit: {
          key: 'mexico',
          name: 'Autódromo Hermanos Rodríguez',
          location: 'Mexico City',
          country: 'Mexico',
          viewBox: '0 0 500 500',
          path: 'M 10 10 L 100 10 L 100 100 L 10 100 Z',
        },
        lap: 12,
        total_laps: 57,
        trackStatus: 'GREEN',
        weather: { air: '24°C', track: '41°C', humidity: '38%', rain: '0%' },
        messages: [{ time: '20:15', msg: 'DRS ENABLED' }],
        lines: [
          {
            position: 1,
            driver: 'VER',
            team: 'Red Bull Racing',
            status: 'TRACK',
            gap: 'LEADER',
            interval: '-',
            lastLap: '1:21.000',
            lap_color: 'green',
            sector1: '-',
            s1_color: 'green',
            sector2: '-',
            s2_color: 'green',
            sector3: '-',
            s3_color: 'green',
            pits: 0,
            tyre: 'M',
            tyre_age: 6,
            progress: 0,
            gap_seconds: 0,
          },
          {
            position: 2,
            driver: 'NOR',
            team: 'McLaren',
            status: 'TRACK',
            gap: '+2.500',
            interval: '+2.500',
            lastLap: '1:21.400',
            lap_color: 'yellow',
            sector1: '-',
            s1_color: 'yellow',
            sector2: '-',
            s2_color: 'yellow',
            sector3: '-',
            s3_color: 'yellow',
            pits: 0,
            tyre: 'H',
            tyre_age: 11,
            progress: 0.18,
            gap_seconds: 2.5,
          },
        ],
      });
    });

    expect(screen.getByText('VER')).toBeInTheDocument();
    expect(screen.getByText('NOR')).toBeInTheDocument();
    expect(screen.getByText('LEADER')).toBeInTheDocument();
    expect(screen.getByText('+2.500')).toBeInTheDocument();
    expect(screen.getAllByText(/LAP 12 \/ 57/).length).toBeGreaterThan(0);
    expect(screen.getByText('GREEN')).toBeInTheDocument();
    expect(screen.getByText('DRS ENABLED')).toBeInTheDocument();
    expect(screen.getByText('Autódromo Hermanos Rodríguez')).toBeInTheDocument();
    expect(screen.getByTestId('circuit-track-map')).toBeInTheDocument();
  });

  it('is transparent by default and only shows the OBS control bar in preview mode', () => {
    renderOverlay();

    expect(document.documentElement.style.background).toBe('transparent');
    expect(document.body.style.background).toBe('transparent');
    expect(screen.queryByText(/OBS 1920×1080/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Copy transparent URL/i)).not.toBeInTheDocument();
  });

  it('shows the preview badge and OBS controls with ?preview=1', () => {
    renderOverlay('/overlay/live?preview=1');

    expect(screen.getByText(/^Preview$/)).toBeInTheDocument();
    expect(screen.getByText(/OBS 1920×1080/i)).toBeInTheDocument();
    expect(screen.getByText(/Copy transparent URL/i)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Pit Wall/i })).toHaveAttribute('href', '/live');
  });
});
