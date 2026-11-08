import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchAllRaces,
  fetchChampionship,
  fetchDashboardData,
  fetchDriverProfile,
  fetchRaceDetails,
  fetchStandings,
  fetchTeamProfile,
  fetchTelemetryCompare,
  isApiError,
} from '../api';

describe('services/api.ts contract & error handling', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('identifies error envelopes via isApiError()', () => {
    expect(isApiError({ error: 'Driver not found' })).toBe(true);
    expect(isApiError({ error: 123 })).toBe(false);
    expect(isApiError(null)).toBe(false);
    expect(isApiError({ year: 2026 })).toBe(false);
  });

  it('fetches dashboard, races, championship, and standings payloads', async () => {
    const fetchMock = vi.fn(async (url: string) => {
      if (url.endsWith('/api/dashboard/2026')) {
        return { ok: true, json: async () => ({ year: 2026, last_race_name: 'Miami GP' }) };
      }
      if (url.endsWith('/api/races/2026')) {
        return { ok: true, json: async () => [{ round: 1, name: 'Bahrain GP' }] };
      }
      if (url.endsWith('/api/championship/2026')) {
        return { ok: true, json: async () => ({ year: 2026, drivers: [], teams: [] }) };
      }
      if (url.endsWith('/api/standings/2026')) {
        return { ok: true, json: async () => ({ year: 2026, drivers: [{ name: 'NOR' }], teams: [] }) };
      }
      return { ok: false, status: 404, statusText: 'Not Found' };
    });
    vi.stubGlobal('fetch', fetchMock);

    const dash = await fetchDashboardData(2026);
    expect(dash.last_race_name).toBe('Miami GP');

    const races = await fetchAllRaces(2026);
    expect(races).toHaveLength(1);

    const champ = await fetchChampionship(2026);
    expect(champ.year).toBe(2026);

    const standings = await fetchStandings(2026);
    expect(standings.drivers).toHaveLength(1);
  });

  it('fetches race details, driver/team profiles, and URL-encodes telemetry compare params', async () => {
    const fetchMock = vi.fn(async (url: string) => ({
      ok: true,
      json: async () => ({ requestedUrl: url }),
    }));
    vi.stubGlobal('fetch', fetchMock);

    await fetchRaceDetails(2026, 6);
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/race/2026/6'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    await fetchDriverProfile(2026, 'NOR');
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/driver/2026/NOR'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    await fetchTeamProfile(2026, 'red_bull');
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/team/2026/red_bull'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );

    await fetchTelemetryCompare(2026, 5, 'VER,NOR');
    expect(fetchMock).toHaveBeenLastCalledWith(
      expect.stringContaining('/api/telemetry/2026/5?drivers=VER%2CNOR'),
      expect.objectContaining({ signal: expect.any(AbortSignal) }),
    );
  });

  it('throws descriptive errors when HTTP status is not ok or backend returns an error envelope', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: false,
        status: 503,
        statusText: 'Service Unavailable',
        json: async () => ({}),
      })),
    );

    await expect(fetchDashboardData(2026)).rejects.toThrow('Failed to fetch dashboard data');

    vi.stubGlobal(
      'fetch',
      vi.fn(async () => ({
        ok: true,
        status: 200,
        statusText: 'OK',
        json: async () => ({ error: 'Telemetry session missing' }),
      })),
    );

    await expect(fetchTelemetryCompare(2026, 1, 'VER,LEC')).rejects.toThrow('Telemetry session missing');
  });
});
