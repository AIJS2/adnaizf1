import { render, screen, fireEvent } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { vi, describe, it, expect } from 'vitest';
import IncidentBreakdownModal from '../IncidentBreakdownModal';
import type { IncidentDetail } from '../../../types/f1';

const incidents: IncidentDetail[] = [
  {
    round: 5,
    race_name: 'Canadian Grand Prix',
    location: 'Montréal',
    session_type: 'Race',
    status: 'Retired',
    grid: 1,
    position_text: 'DNF',
    driver_name: 'George Russell',
    driver_abbreviation: 'RUS',
  },
  {
    round: 17,
    race_name: 'Singapore Grand Prix',
    location: 'Marina Bay',
    session_type: 'Sprint',
    status: 'Retired',
    grid: 2,
    position_text: 'DNF',
    driver_name: 'George Russell',
    driver_abbreviation: 'RUS',
  },
];

const renderModal = (props?: Partial<Parameters<typeof IncidentBreakdownModal>[0]>) =>
  render(
    <MemoryRouter>
      <IncidentBreakdownModal kind="dnf" incidents={incidents} onClose={() => {}} year={2026} {...props} />
    </MemoryRouter>,
  );

describe('IncidentBreakdownModal', () => {
  it('lists every incident with round links and Grand Prix / Sprint badges', () => {
    renderModal();

    expect(screen.getByText('DNF Breakdown')).toBeTruthy();
    expect(screen.getByText(/2 incidents/)).toBeTruthy();
    expect(screen.getByText('Canadian Grand Prix')).toBeTruthy();
    expect(screen.getByText('Singapore Grand Prix')).toBeTruthy();

    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(2);
    expect(links[0]).toHaveAttribute('href', '/race/2026/5');
    expect(links[1]).toHaveAttribute('href', '/race/2026/17');

    expect(screen.getAllByText('Retired')).toHaveLength(2);
    expect(screen.getByText('Grid P1')).toBeTruthy();
    expect(screen.getByText('Grid P2')).toBeTruthy();
  });

  it('shows the driver name only when showDriver is set (team profile)', () => {
    renderModal({ showDriver: true });
    expect(screen.getAllByText('RUS · George Russell')).toHaveLength(2);
  });

  it('closes on Escape and on backdrop click', () => {
    const onClose = vi.fn();
    renderModal({ onClose });

    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onClose).toHaveBeenCalledTimes(1);

    fireEvent.click(screen.getByRole('dialog'));
    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it('renders the DNS variant copy', () => {
    renderModal({ kind: 'dns', incidents: [] });
    expect(screen.getByText('DNS Breakdown')).toBeTruthy();
    expect(screen.getByText(/0 incidents/)).toBeTruthy();
  });
});
