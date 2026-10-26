import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { describe, expect, it, vi, beforeEach } from 'vitest';
import TeamRadioSection from '../TeamRadioSection';

const MOCK_RADIO_DATA = {
  status: 'ok',
  source: 'openf1',
  data: [
    {
      session_key: 9158,
      meeting_key: 1219,
      date: '2026-03-08T15:20:00Z',
      driver_number: 12,
      recording_url: 'https://livetiming.formula1.com/static/2026/radio/12_turn4.mp3',
    },
    {
      session_key: 9158,
      meeting_key: 1219,
      date: '2026-03-08T15:22:15Z',
      driver_number: 63,
      recording_url: 'https://livetiming.formula1.com/static/2026/radio/63_box.mp3',
    },
  ],
};

function renderWithClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe('TeamRadioSection component', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('renders section header with live race toggle', () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', data: [] }),
    } as Response);

    renderWithClient(<TeamRadioSection />);
    expect(screen.getByRole('heading', { name: /Team Radio/i })).toBeInTheDocument();
    expect(screen.getByText('Live Race')).toBeInTheDocument();
    expect(screen.getByText('Previous')).toBeInTheDocument();
  });

  it('renders radio transmissions with driver badge and audio controls', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => MOCK_RADIO_DATA,
    } as Response);

    renderWithClient(<TeamRadioSection />);

    await waitFor(() => {
      expect(screen.getByText('Kimi Antonelli')).toBeInTheDocument();
      expect(screen.getByText('George Russell')).toBeInTheDocument();
    });

    expect(screen.getByText('#12 ANT')).toBeInTheDocument();
    expect(screen.getByText('#63 RUS')).toBeInTheDocument();
  });

  it('renders empty state when no radio messages are returned', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ status: 'ok', source: 'openf1', data: [] }),
    } as Response);

    renderWithClient(<TeamRadioSection />);

    await waitFor(() => {
      expect(screen.getByText('Tidak Ada Siaran Radio Ditemukan')).toBeInTheDocument();
    });
  });

  it('shows the shared unavailable message and skips the OpenF1 query during a paywall', () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderWithClient(
      <TeamRadioSection
        liveStatus="unavailable_subscription"
        connectionStatus="connected"
      />
    );

    expect(
      screen.getByRole('heading', { name: /LIVE TIMING UNAVAILABLE/i })
    ).toBeInTheDocument();
    expect(
      screen.getByText(/Real-time timing requires a paid data feed/i)
    ).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('renders live SignalR radio and skips the OpenF1 query', async () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderWithClient(
      <TeamRadioSection
        liveStatus="live"
        connectionStatus="connected"
        liveRadio={[
          {
            session_key: 9158,
            meeting_key: 1219,
            date: '2026-03-08T15:20:00Z',
            driver_number: 12,
            recording_url:
              'https://livetiming.formula1.com/static/2026/radio/12_turn4.mp3',
          },
        ]}
      />
    );

    await waitFor(() => {
      expect(screen.getByText('Kimi Antonelli')).toBeInTheDocument();
    });
    expect(screen.getByText('#12 ANT')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('waits for live radio instead of querying OpenF1 when the feed has no captures yet', () => {
    const fetchMock = vi.fn();
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderWithClient(
      <TeamRadioSection
        liveStatus="live"
        connectionStatus="connected"
        liveRadio={[]}
      />
    );

    expect(screen.getByText('Menunggu Radio Tim')).toBeInTheDocument();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('falls back to SignalR captures on Previous instead of showing Failed to fetch', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('Failed to fetch'));
    globalThis.fetch = fetchMock as unknown as typeof fetch;

    renderWithClient(
      <TeamRadioSection
        liveStatus="live"
        connectionStatus="connected"
        liveRadio={[
          {
            session_key: 9158,
            meeting_key: 1219,
            date: '2026-03-08T15:20:00Z',
            driver_number: 12,
            recording_url:
              'https://livetiming.formula1.com/static/2026/radio/12_turn4.mp3',
          },
        ]}
      />
    );

    fireEvent.click(screen.getByText('Previous'));

    await waitFor(() => {
      expect(screen.getByText('Kimi Antonelli')).toBeInTheDocument();
    });
    expect(screen.queryByText(/Gagal Memuat Radio Tim/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/Failed to fetch/i)).not.toBeInTheDocument();
    expect(
      screen.getByText(/menampilkan tangkapan SignalR terakhir/i),
    ).toBeInTheDocument();

    expect(fetchMock).toHaveBeenCalled();
    const firstCall = fetchMock.mock.calls[0]?.[0] as string | undefined;
    expect(String(firstCall)).toContain('127.0.0.1:8000');
    expect(String(firstCall)).toContain('session_key=previous');
  });

  it('renders the backend SignalR cache for Previous without an error state', async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        status: 'success',
        source: 'signalr_cache',
        fallback: true,
        session_title: 'United States Grand Prix — Race',
        data: [
          {
            session_key: 11396,
            meeting_key: 1297,
            date: '2026-10-25T16:11:22Z',
            driver_number: 12,
            recording_url:
              'https://livetiming.formula1.com/static/2026/radio/12_turn4.mp3',
          },
        ],
      }),
    } as Response);

    renderWithClient(
      <TeamRadioSection
        liveStatus="live"
        connectionStatus="connected"
        liveRadio={[]}
      />
    );

    fireEvent.click(screen.getByText('Previous'));

    await waitFor(() => {
      expect(screen.getByText('Kimi Antonelli')).toBeInTheDocument();
    });
    expect(screen.getByText(/SignalR cache/i)).toBeInTheDocument();
    expect(screen.queryByText(/Gagal Memuat Radio Tim/i)).not.toBeInTheDocument();
  });

  it('lists only drivers that have a radio clip in the current session', () => {
    globalThis.fetch = vi.fn();

    renderWithClient(
      <TeamRadioSection
        liveStatus="live"
        connectionStatus="connected"
        liveRadio={[
          {
            session_key: 9158,
            meeting_key: 1219,
            date: '2026-03-08T15:20:00Z',
            driver_number: 12,
            recording_url:
              'https://livetiming.formula1.com/static/2026/radio/12_turn4.mp3',
          },
        ]}
      />
    );

    expect(screen.getByText('All Drivers (1)')).toBeInTheDocument();
    expect(screen.getByRole('option', { name: /#12/ })).toBeInTheDocument();
    expect(screen.queryByRole('option', { name: /#63/ })).not.toBeInTheDocument();
  });
});
