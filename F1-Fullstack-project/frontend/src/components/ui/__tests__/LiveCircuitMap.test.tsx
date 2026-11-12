import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { LiveCircuitMap } from '../LiveCircuitMap';
import type { LiveTimingCircuit, LiveTimingLine } from '../../../types/f1';

const SQUARE_TOTAL = 400;

function squarePoint(length: number): { x: number; y: number } {
  const t = Math.max(0, Math.min(SQUARE_TOTAL, length));
  if (t <= 100) return { x: t, y: 0 };
  if (t <= 200) return { x: 100, y: t - 100 };
  if (t <= 300) return { x: 100 - (t - 200), y: 100 };
  return { x: 0, y: 100 - (t - 300) };
}

const descriptorTotal = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getTotalLength');
const descriptorPoint = Object.getOwnPropertyDescriptor(SVGElement.prototype, 'getPointAtLength');

function installPathMock() {
  Object.defineProperty(SVGElement.prototype, 'getTotalLength', {
    configurable: true,
    value: () => SQUARE_TOTAL,
  });
  Object.defineProperty(SVGElement.prototype, 'getPointAtLength', {
    configurable: true,
    value: (length: number) => squarePoint(length),
  });
}

function restorePathMock() {
  if (descriptorTotal) {
    Object.defineProperty(SVGElement.prototype, 'getTotalLength', descriptorTotal);
  } else {
    delete (SVGElement.prototype as unknown as Record<string, unknown>).getTotalLength;
  }
  if (descriptorPoint) {
    Object.defineProperty(SVGElement.prototype, 'getPointAtLength', descriptorPoint);
  } else {
    delete (SVGElement.prototype as unknown as Record<string, unknown>).getPointAtLength;
  }
}

const circuit: LiveTimingCircuit = {
  key: 'monaco',
  name: 'Circuit de Monaco',
  location: 'Monte Carlo',
  country: 'Monaco',
  viewBox: '0 0 500 500',
  path: 'M 0 0 L 100 0 L 100 100 L 0 100 Z',
};

const line = (
  driver: string,
  position: number,
  progress: number,
  status: string = 'TRACK',
): LiveTimingLine => ({
  position,
  driver,
  team: driver === 'VER' ? 'Red Bull Racing' : 'McLaren',
  status,
  gap: position === 1 ? 'LEADER' : '+2.500',
  interval: position === 1 ? '-' : '+2.500',
  lastLap: '1:12.000',
  lap_color: 'green',
  sector1: '-',
  s1_color: 'green',
  sector2: '-',
  s2_color: 'green',
  sector3: '-',
  s3_color: 'green',
  pits: status === 'PIT' ? 1 : 0,
  tyre: 'M',
  tyre_age: 3,
  progress,
});

describe('LiveCircuitMap', () => {
  beforeEach(installPathMock);
  afterEach(restorePathMock);

  it('renders the circuit outline and car markers without distracting corner badges by default', () => {
    render(
      <LiveCircuitMap
        circuit={circuit}
        lines={[line('VER', 1, 0), line('NOR', 2, 0.25)]}
      />,
    );

    expect(screen.getByTestId('circuit-track-map')).toBeInTheDocument();
    expect(screen.getByText('VER')).toBeInTheDocument();
    expect(screen.getByText('NOR')).toBeInTheDocument();
    // Default during live timing: no corner badges
    expect(screen.queryByTestId('circuit-corner-markers')).not.toBeInTheDocument();
  });

  it('renders corner badges when showCorners is explicitly enabled', async () => {
    render(
      <LiveCircuitMap
        circuit={circuit}
        lines={[line('VER', 1, 0), line('NOR', 2, 0.25)]}
        showCorners
        preview
      />,
    );

    expect(screen.getByTestId('circuit-track-map')).toBeInTheDocument();
    await waitFor(() => {
      expect(
        screen.getByTestId('circuit-corner-markers').querySelectorAll('.corner-badge-circle'),
      ).toHaveLength(19);
    });
  });

  it('renders PIT drivers without dropping them, displaying pit styling', () => {
    render(
      <LiveCircuitMap
        circuit={circuit}
        lines={[
          line('VER', 1, 0, 'TRACK'),
          line('NOR', 2, 0.2, 'PIT'),
        ]}
      />,
    );

    expect(screen.getByTestId('circuit-track-map')).toBeInTheDocument();
    expect(screen.getByText('VER')).toBeInTheDocument();
    // NOR is in pit: must be rendered on the circuit map with ·P label
    expect(screen.getByText('NOR·P')).toBeInTheDocument();
    expect(screen.getByTestId('driver-marker-NOR')).toHaveStyle({ opacity: '0.75' });
  });

  it('omits corner badges when showCorners is false', () => {
    render(<LiveCircuitMap circuit={circuit} lines={[]} showCorners={false} />);

    expect(screen.queryByTestId('circuit-corner-markers')).not.toBeInTheDocument();
  });

  it('does not borrow corner data for the Madrid round', () => {
    render(
      <LiveCircuitMap
        circuit={{
          ...circuit,
          key: '15',
          name: 'Madrid Circuit',
          location: 'Madrid',
          country: 'Spain',
        }}
        lines={[]}
      />,
    );

    expect(screen.getByTestId('circuit-track-map')).toBeInTheDocument();
    expect(screen.queryByTestId('circuit-corner-markers')).not.toBeInTheDocument();
  });

  it('filters out retired OUT drivers so they do not pile up on the start/finish line', () => {
    render(
      <LiveCircuitMap
        circuit={circuit}
        lines={[
          line('VER', 1, 0, 'TRACK'),
          { ...line('ALB', 19, 0, 'OUT'), gap: 'OUT', lastLap: 'RET', retired: true },
        ]}
      />,
    );

    expect(screen.getByTestId('driver-marker-VER')).toBeInTheDocument();
    expect(screen.queryByTestId('driver-marker-ALB')).not.toBeInTheDocument();
  });

  it('renders aerial satellite tiles when satellite mode is enabled', () => {
    const { container } = render(
      <LiveCircuitMap
        circuit={circuit}
        lines={[line('VER', 1, 0, 'TRACK')]}
        satellite
      />,
    );

    const images = container.querySelectorAll('image');
    expect(images.length).toBeGreaterThan(0);
    expect(images[0].getAttribute('href')).toContain('World_Imagery/MapServer/tile');
  });
});
