/**
 * Empty-state rendering tests.
 *
 * The zero-mock-data policy means every component must survive an empty
 * payload without crashing and must say something useful rather than showing
 * a bare table header or a blank chart frame.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';

import EmptyState, { EMPTY_TABLE_MESSAGES } from '../EmptyState';

describe('EmptyState', () => {
  it('renders the title and description', () => {
    render(<EmptyState title="No results available" description="Try again later." />);
    expect(screen.getByText('No results available')).toBeInTheDocument();
    expect(screen.getByText('Try again later.')).toBeInTheDocument();
  });

  it('is exposed to assistive tech as a status region', () => {
    render(<EmptyState title="No telemetry data available" />);
    expect(screen.getByRole('status')).toBeInTheDocument();
  });

  it('omits the description when none is given', () => {
    const { container } = render(<EmptyState title="Nothing here" />);
    expect(container.querySelectorAll('p')).toHaveLength(0);
  });

  it('supports the compact variant for inline table cells', () => {
    render(<EmptyState title="No rows" compact />);
    expect(screen.getByText('No rows')).toBeInTheDocument();
    // Compact mode must not render the large icon tile.
    expect(document.querySelector('.w-14')).toBeNull();
  });

  it('does not render an icon tile when no icon is supplied', () => {
    const { container } = render(<EmptyState title="Plain" />);
    expect(container.querySelector('.rounded-2xl')).toBeNull();
  });
});

describe('EMPTY_TABLE_MESSAGES', () => {
  it('provides copy for every empty-data surface', () => {
    for (const key of ['raceResults', 'telemetry', 'charts'] as const) {
      expect(EMPTY_TABLE_MESSAGES[key].title.length).toBeGreaterThan(0);
      expect(EMPTY_TABLE_MESSAGES[key].description.length).toBeGreaterThan(0);
    }
  });
});
