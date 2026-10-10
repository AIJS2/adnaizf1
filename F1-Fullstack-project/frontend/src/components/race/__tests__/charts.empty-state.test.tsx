/**
 * Regression tests for the race charts' empty-payload behaviour.
 *
 * With mock data gone, `/api/race/{year}/{round}` returns `null` for every
 * chart payload on an unrun session. These charts previously rendered their
 * full toolbar plus an empty chart frame, and LapTimesChart additionally
 * computed a Y domain from `Math.max(...[])`.
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';

// recharts needs a measured container; in jsdom it renders at 0x0, so stub
// ResponsiveContainer to a fixed box for these tests.
vi.mock('recharts', async () => {
  const actual = await vi.importActual<typeof import('recharts')>('recharts');
  return {
    ...actual,
    ResponsiveContainer: ({ children }: { children: React.ReactElement }) => (
      <div style={{ width: 800, height: 400 }}>{children}</div>
    ),
  };
});

import LapTimesChart from '../../race/LapTimesChart';
import GapChart from '../../race/GapChart';
import LapChart from '../../race/LapChart';

const NO_DATA = 'Not enough data to plot yet';

describe('race charts with an empty payload', () => {
  it('LapTimesChart shows the empty state, not a blank chart frame', () => {
    render(<LapTimesChart lapTimesChart={[]} results={[]} />);
    expect(screen.getByText(NO_DATA)).toBeInTheDocument();
    // The driver-toggle toolbar must not render when there are no drivers.
    expect(screen.queryByText('All Drivers')).toBeNull();
  });

  it('GapChart shows the empty state when gapChart is undefined', () => {
    render(<GapChart results={[]} />);
    expect(screen.getByText(NO_DATA)).toBeInTheDocument();
  });

  it('LapChart shows the empty state when lapChart is undefined', () => {
    render(<LapChart results={[]} />);
    expect(screen.getByText(NO_DATA)).toBeInTheDocument();
  });

  it('none of them throw when every prop is omitted entirely', () => {
    expect(() => render(<LapTimesChart />)).not.toThrow();
    expect(() => render(<GapChart />)).not.toThrow();
    expect(() => render(<LapChart />)).not.toThrow();
  });
});
