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

    // The warning banner must show the per-driver reason. Before the fix this
    // threw "Cannot read properties of undefined" on the missing `drivers`
    // array, because the render guard only checked the payload object itself.
    await waitFor(() => {
      expect(screen.getByText(/VER: Telemetry could not be processed/)).toBeInTheDocument();
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
});
