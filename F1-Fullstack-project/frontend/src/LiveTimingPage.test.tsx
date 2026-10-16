import { render, screen, waitFor } from '@testing-library/react';
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
  onopen: (() => void) | null = null;
  onclose: (() => void) | null = null;
  onmessage: ((ev: { data: string }) => void) | null = null;
  onerror: (() => void) | null = null;
  close() {}
  send() {}
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
      expect(screen.getByText(/Bahrain Grand Prix/i)).toBeInTheDocument();
    });

    expect(screen.getByText(/LIGHTS OUT COUNTDOWN/i)).toBeInTheDocument();
  });
});
