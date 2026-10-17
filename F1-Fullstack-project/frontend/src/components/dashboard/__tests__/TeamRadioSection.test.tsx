import { render, screen, waitFor } from '@testing-library/react';
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
});
