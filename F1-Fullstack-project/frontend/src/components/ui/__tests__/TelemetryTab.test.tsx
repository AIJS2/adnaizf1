// The telemetry endpoint answers with several partial payload shapes after
// the zero-mock-data purge: the full one, the "no drivers selected" one, and
// the error/exception one that only carries `unavailable_reasons`. The tab
// must render all of them without reading a property off a missing field.
import { render, screen, waitFor, fireEvent, act } from '@testing-library/react';
import { describe, expect, it, vi, afterEach } from 'vitest';
import TelemetryTab from '../TelemetryTab';

/** Payload the router returns when FastF1 raised while processing. */
const UNAVAILABLE_ONLY = {
  unavailable_drivers: ['VER', 'NOR'],
  unavailable_reasons: {
    VER: 'Telemetry could not be processed for this session.',
    NOR: 'Telemetry could not be processed for this session.',
  },
};

/** Payload the router returns when the caller selected no drivers. */
const NO_DRIVERS_SELECTED = {
  drivers: [],
  driver_info: {},
  telemetry: [],
  unavailable_drivers: [],
  unavailable_reasons: {},
  message: 'No drivers were selected for comparison.',
};

/** A fully populated payload, so the happy path stays covered. */
const FULL_PAYLOAD = {
  drivers: ['VER'],
  driver_info: {
    VER: { team: 'Red Bull Racing', name: 'Max Verstappen', lap_time: '1:29.5', compound: 'SOFT', max_speed: 340, avg_speed: 210 },
  },
  telemetry: [{ distance: 0, speed_VER: 300 }],
  unavailable_drivers: [],
  unavailable_reasons: {},
};

/** Two valid-lap drivers plus one non-starter, for the DNS affordances. */
const DRIVERS_WITH_STATUS = [
  { abbreviation: 'BOR', full_name: 'Gabriel Bortoleto', team_name: 'Audi', status: 'Lapped' },
  { abbreviation: 'HUL', full_name: 'Nico Hulkenberg', team_name: 'Audi', status: 'Did not start' },
];

/** Valid data for BOR, an honest DNS reason for HUL. */
const DNS_UNAVAILABLE = {
  drivers: ['BOR'],
  driver_info: {
    BOR: { team: 'Audi', name: 'Gabriel Bortoleto', lap_time: '1:23.2', compound: 'HARD', max_speed: 320, avg_speed: 227 },
  },
  telemetry: [{ distance: 0, speed_BOR: 300 }],
  unavailable_drivers: ['HUL'],
  unavailable_reasons: { HUL: 'Did not start this race - no lap telemetry exists for this driver.' },
};

/**
 * `TelemetryTab` reads the response through both `res.text()` and `res.json()`,
 * so a mocked response must provide both.
 */
function mockEndpoint(comparePayload: unknown) {
  const serialized = JSON.stringify(comparePayload);
  return vi.fn(async (url: RequestInfo | URL) => {
    const target = String(url);
    if (target.includes('/api/telemetry-drivers/')) {
      return { ok: true, json: async () => [] } as unknown as Response;
    }
    return {
      ok: true,
      text: async () => serialized,
      json: async () => comparePayload,
    } as unknown as Response;
  });
}

/** Same as `mockEndpoint`, but the drivers lookup returns real entries with statuses. */
function mockEndpointWithDrivers(comparePayload: unknown, drivers: unknown) {
  const serialized = JSON.stringify(comparePayload);
  return vi.fn(async (url: RequestInfo | URL) => {
    const target = String(url);
    if (target.includes('/api/telemetry-drivers/')) {
      return { ok: true, json: async () => drivers } as unknown as Response;
    }
    return {
      ok: true,
      text: async () => serialized,
      json: async () => comparePayload,
    } as unknown as Response;
  });
}

/** Select the VER chip and run the analysis. */
async function selectDriverAndFetch() {
  const driverButton = await screen.findByRole('button', { name: 'VER' });
  await act(async () => {
    fireEvent.click(driverButton);
  });
  const runButton = screen.getByRole('button', { name: /Run Analysis/ });
  await act(async () => {
    fireEvent.click(runButton);
  });
}

describe('TelemetryTab with partial backend payloads', () => {
  const original = globalThis.fetch;

  afterEach(() => {
    globalThis.fetch = original;
    vi.restoreAllMocks();
  });

  it('renders the unavailable reasons instead of crashing on a partial payload', async () => {
    globalThis.fetch = mockEndpoint(UNAVAILABLE_ONLY);

    render(<TelemetryTab year={2026} round={1} />);
    await selectDriverAndFetch();

    // The whole session failed for the same reason, so it is reported once
    // (with the affected drivers) instead of being repeated for each driver.
    await waitFor(() => {
      expect(
        screen.getByText('Telemetry could not be processed for this session.')
      ).toBeInTheDocument();
      expect(screen.getByText('Driver: VER, NOR')).toBeInTheDocument();
    });
  });

  it('renders the empty payload when the backend selected no drivers', async () => {
    globalThis.fetch = mockEndpoint(NO_DRIVERS_SELECTED);

    render(<TelemetryTab year={2026} round={1} />);
    await selectDriverAndFetch();

    await waitFor(() => {
      expect(screen.getByText('No drivers were selected for comparison.')).toBeInTheDocument();
    });
  });

  it('still renders a full payload', async () => {
    globalThis.fetch = mockEndpoint(FULL_PAYLOAD);

    render(<TelemetryTab year={2026} round={1} />);
    await selectDriverAndFetch();

    await waitFor(() => {
      expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
    });
  });

  it('flags DNS drivers in the picker and warns before running', async () => {
    globalThis.fetch = mockEndpointWithDrivers(FULL_PAYLOAD, DRIVERS_WITH_STATUS);

    render(<TelemetryTab year={2026} round={1} />);

    const hulButton = await screen.findByRole('button', { name: /HUL/ });
    expect(screen.getByTitle(/did not start/i)).toBeInTheDocument();

    await act(async () => {
      fireEvent.click(hulButton);
    });

    await waitFor(() => {
      expect(screen.getByText(/Tanpa data: HUL/)).toBeInTheDocument();
    });
  });

  it('reports the DNS reason for unavailable drivers next to valid data', async () => {
    globalThis.fetch = mockEndpointWithDrivers(DNS_UNAVAILABLE, DRIVERS_WITH_STATUS);

    render(<TelemetryTab year={2026} round={1} />);

    const borButton = await screen.findByRole('button', { name: /BOR/ });
    const hulButton = screen.getByRole('button', { name: /HUL/ });

    await act(async () => {
      fireEvent.click(borButton);
    });
    await act(async () => {
      fireEvent.click(hulButton);
    });
    await act(async () => {
      fireEvent.click(screen.getByRole('button', { name: /Run Analysis/ }));
    });

    await waitFor(() => {
      expect(screen.getByText(/HUL: Did not start this race/)).toBeInTheDocument();
    });
  });
});
