import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import AnimatedNumber from '../AnimatedNumber';

describe('AnimatedNumber Component', () => {
  it('renders initial value formatted with prefix and suffix', () => {
    render(<AnimatedNumber value={150} prefix="+" suffix=" PTS" />);
    expect(screen.getByText('+150 PTS')).toBeInTheDocument();
  });

  it('renders decimals correctly', () => {
    render(<AnimatedNumber value={99.456} decimals={1} />);
    expect(screen.getByText('99.5')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(<AnimatedNumber value={42} className="font-mono text-red-500" />);
    const span = container.querySelector('span');
    expect(span).toHaveClass('font-mono', 'text-red-500');
  });
});
