import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CircuitCornerMarkers } from '../CircuitCornerMarkers';
import { getCircuitCorners } from '../../../data/circuitCorners';

// jsdom does not implement SVG geometry APIs. These helpers give every path a
// 100 x 100 square starting at the origin so `getPointAtLength` can be trusted
// in assertions about sampling, outward offsets and clamping.
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

const monacoCorners = getCircuitCorners({ name: 'Circuit de Monaco' });

describe('CircuitCornerMarkers', () => {
  beforeEach(installPathMock);
  afterEach(restorePathMock);

  it('renders one numbered badge per Monaco corner, in lap order', async () => {
    render(
      <svg viewBox="0 0 500 500">
        <CircuitCornerMarkers
          corners={monacoCorners}
          path="M 0 0 L 100 0 L 100 100 L 0 100 Z"
          viewBox="0 0 500 500"
        />
      </svg>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('circuit-corner-markers').querySelectorAll('.corner-badge-circle'),
      ).toHaveLength(19);
    });

    const labels = Array.from(
      screen.getByTestId('circuit-corner-markers').querySelectorAll('text'),
    ).map((node) => node.textContent);
    expect(labels).toEqual(
      Array.from({ length: 19 }, (_, index) => String(index + 1)),
    );

    // Anchor dots are rendered at apex
    expect(
      screen.getByTestId('circuit-corner-markers').querySelectorAll('.corner-anchor-dot'),
    ).toHaveLength(19);
    // Leader lines are clean and omitted by default
    expect(
      screen.getByTestId('circuit-corner-markers').querySelectorAll('line'),
    ).toHaveLength(0);
  });

  it('renders leader lines when showLeaderLines is explicitly true', async () => {
    render(
      <svg viewBox="0 0 500 500">
        <CircuitCornerMarkers
          corners={monacoCorners}
          path="M 0 0 L 100 0 L 100 100 L 0 100 Z"
          viewBox="0 0 500 500"
          showLeaderLines
        />
      </svg>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('circuit-corner-markers').querySelectorAll('line'),
      ).toHaveLength(19);
    });
  });

  it('keeps every badge inside the padded viewBox after repulsion and clamping', async () => {
    const { container } = render(
      <svg viewBox="0 0 500 500">
        <CircuitCornerMarkers
          corners={monacoCorners}
          path="M 0 0 L 100 0 L 100 100 L 0 100 Z"
          viewBox="0 0 500 500"
        />
      </svg>,
    );

    await waitFor(() => {
      expect(container.querySelectorAll('.corner-badge-circle')).toHaveLength(19);
    });

    for (const circle of Array.from(container.querySelectorAll<SVGCircleElement>('.corner-badge-circle'))) {
      const cx = Number(circle.getAttribute('cx'));
      const cy = Number(circle.getAttribute('cy'));
      const r = Number(circle.getAttribute('r'));
      expect(Number.isFinite(cx)).toBe(true);
      expect(Number.isFinite(cy)).toBe(true);
      expect(cx - r).toBeGreaterThanOrEqual(0);
      expect(cy - r).toBeGreaterThanOrEqual(0);
      expect(cx + r).toBeLessThanOrEqual(500);
      expect(cy + r).toBeLessThanOrEqual(500);
    }
  });

  it('supports explicit geometric track points and sampler', async () => {
    const sample = (d: number) => squarePoint(d * SQUARE_TOTAL);
    const trackPoints = Array.from({ length: 40 }, (_, i) => sample(i / 40));

    render(
      <svg viewBox="0 0 500 500">
        <CircuitCornerMarkers
          corners={monacoCorners}
          trackPoints={trackPoints}
          sample={sample}
          viewBox="0 0 500 500"
        />
      </svg>,
    );

    await waitFor(() => {
      expect(
        screen.getByTestId('circuit-corner-markers').querySelectorAll('.corner-badge-circle'),
      ).toHaveLength(19);
    });
  });

  it('renders nothing when there are no corners', () => {
    render(
      <svg viewBox="0 0 500 500">
        <CircuitCornerMarkers
          corners={[]}
          path="M 0 0 L 100 0 L 100 100 Z"
          viewBox="0 0 500 500"
        />
      </svg>,
    );

    expect(
      screen.getByTestId('circuit-corner-markers').querySelectorAll('text'),
    ).toHaveLength(0);
  });

  it('triggers onCornerClick and highlights selected corner', async () => {
    const onCornerClick = vi.fn();

    const { rerender } = render(
      <svg viewBox="0 0 500 500">
        <CircuitCornerMarkers
          corners={monacoCorners}
          path="M 0 0 L 100 0 L 100 100 L 0 100 Z"
          viewBox="0 0 500 500"
          onCornerClick={onCornerClick}
        />
      </svg>,
    );

    await waitFor(() => {
      expect(screen.getByTestId('corner-marker-1')).toBeInTheDocument();
    });

    const marker1 = screen.getByTestId('corner-marker-1');
    expect(marker1).toHaveAttribute('role', 'button');
    expect(marker1).toHaveAttribute('tabindex', '0');

    // Click corner
    marker1.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(onCornerClick).toHaveBeenCalledTimes(1);
    expect(onCornerClick).toHaveBeenCalledWith(expect.objectContaining({ number: 1 }));

    // Rerender with selected corner
    rerender(
      <svg viewBox="0 0 500 500">
        <CircuitCornerMarkers
          corners={monacoCorners}
          path="M 0 0 L 100 0 L 100 100 L 0 100 Z"
          viewBox="0 0 500 500"
          onCornerClick={onCornerClick}
          selectedCorner={{ number: 1 }}
        />
      </svg>,
    );

    expect(screen.getByTestId('corner-marker-1')).toHaveAttribute('aria-pressed', 'true');
    // Active leader line appears for selected corner
    expect(
      screen.getByTestId('circuit-corner-markers').querySelectorAll('line'),
    ).toHaveLength(1);
  });
});
