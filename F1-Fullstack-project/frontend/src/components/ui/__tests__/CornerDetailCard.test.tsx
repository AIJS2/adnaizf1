import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CornerDetailCard } from '../CornerDetailCard';
import { getCornerDetail } from '../../../data/cornerDetails';

describe('CornerDetailCard and cornerDetails lore helper', () => {
  it('retrieves iconic corner details for Spa Turn 2 (Eau Rouge)', () => {
    const detail = getCornerDetail({ name: 'Spa-Francorchamps', country: 'Belgium' }, 2);

    expect(detail.isIconic).toBe(true);
    expect(detail.name).toBe('Eau Rouge');
    expect(detail.speedCategory).toBe('Flat Out');
    expect(detail.gear).toBe('7th');
    expect(detail.speedKmh).toBe('310 km/h');
    expect(detail.funFact).toContain('Red Water');
  });

  it('retrieves iconic corner details for Monaco Turn 6 (Grand Hotel Hairpin)', () => {
    const detail = getCornerDetail({ name: 'Circuit de Monaco' }, 6);

    expect(detail.isIconic).toBe(true);
    expect(detail.name).toContain('Grand Hotel Hairpin');
    expect(detail.speedCategory).toBe('Slow');
    expect(detail.gear).toBe('1st');
    expect(detail.speedKmh).toBe('48 km/h');
    expect(detail.type).toContain('Slowest Corner in F1');
  });

  it('renders CornerDetailCard with all technical badges and lore callout', () => {
    const detail = getCornerDetail({ name: 'Silverstone Circuit', country: 'Great Britain' }, 9);
    const onClose = vi.fn();
    const onPrev = vi.fn();
    const onNext = vi.fn();

    render(
      <CornerDetailCard
        detail={detail}
        circuitName="Silverstone Circuit"
        onClose={onClose}
        onPrev={onPrev}
        onNext={onNext}
      />,
    );

    expect(screen.getByTestId('corner-detail-card')).toBeInTheDocument();
    expect(screen.getByTestId('corner-detail-name')).toHaveTextContent('Copse');
    expect(screen.getByTestId('iconic-badge')).toBeInTheDocument();
    expect(screen.getByText('Silverstone Circuit', { exact: false })).toBeInTheDocument();
    expect(screen.getByText('High Speed')).toBeInTheDocument();
    expect(screen.getByText('290 km/h')).toBeInTheDocument();
    expect(screen.getByText(/Gear 7th/i)).toBeInTheDocument();
    expect(screen.getByTestId('corner-detail-desc')).toHaveTextContent(/Hamilton-Verstappen 2021/i);
    expect(screen.getByTestId('corner-detail-funfact')).toHaveTextContent(/5.2G lateral/i);

    // Navigation buttons
    fireEvent.click(screen.getByTestId('corner-prev-btn'));
    expect(onPrev).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByTestId('corner-next-btn'));
    expect(onNext).toHaveBeenCalledTimes(1);

    // Close button
    fireEvent.click(screen.getByTestId('corner-detail-close'));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('handles keyboard navigation and Escape key dismissal', () => {
    const detail = getCornerDetail({ name: 'Suzuka International Racing Course' }, 15);
    const onClose = vi.fn();
    const onPrev = vi.fn();
    const onNext = vi.fn();

    render(
      <CornerDetailCard
        detail={detail}
        onClose={onClose}
        onPrev={onPrev}
        onNext={onNext}
      />,
    );

    expect(screen.getByTestId('corner-detail-name')).toHaveTextContent('130R');

    // Arrow keys
    fireEvent.keyDown(window, { key: 'ArrowLeft' });
    expect(onPrev).toHaveBeenCalledTimes(1);

    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onNext).toHaveBeenCalledTimes(1);

    // Escape
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('hides the lore callout when showFunFact is false but keeps the technical specs', () => {
    const detail = getCornerDetail({ name: 'Spa-Francorchamps', country: 'Belgium' }, 2);

    render(<CornerDetailCard detail={detail} showFunFact={false} onClose={vi.fn()} />);

    expect(screen.getByTestId('corner-detail-name')).toHaveTextContent('Eau Rouge');
    expect(screen.getByTestId('corner-detail-desc')).toBeInTheDocument();
    expect(screen.getByText('Flat Out')).toBeInTheDocument();
    expect(screen.queryByTestId('corner-detail-funfact')).not.toBeInTheDocument();
    expect(screen.queryByText(/Lore & History/i)).not.toBeInTheDocument();
  });
});
