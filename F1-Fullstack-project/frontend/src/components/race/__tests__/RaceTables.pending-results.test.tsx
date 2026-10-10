/**
 * Regression tests for the "Awaiting Official Results" badge.
 *
 * F1's archive leaves Laps/Time/Points empty while stewards review post-race
 * incidents (Singapore 2026 Sprint sat like this for hours). The backend now
 * guards the NaN crash and serialises those fields as 0 / "", which the tables
 * used to render as a confident "0" next to a driver who had actually won.
 * These tests pin the masking behaviour and, crucially, that a real
 * classification still shows its numbers.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { SprintResultTable, RaceResultTable } from '../RaceTables';
import type { SessionResultRow } from '../../../types/f1';

// Both tables link drivers to /driver/<slug>, which needs a router.
const renderTable = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

/** What the backend returns for a session F1 has not finalised yet. */
const pendingRow = (position: number, fullName: string): SessionResultRow => ({
  position,
  driver_number: position === 1 ? 3 : 44,
  full_name: fullName,
  team_name: 'Red Bull Racing',
  time: null,
  status: '',
  laps: 0,
  points: 0,
  gap_to_leader: '',
  interval: '',
});

/** What a finalised session returns — points may be 0 outside the top 8. */
const finalisedRow = (position: number, fullName: string): SessionResultRow => ({
  position,
  driver_number: position === 1 ? 3 : 10,
  full_name: fullName,
  team_name: 'Red Bull Racing',
  time: '39:48.162',
  status: '',
  laps: 20,
  points: position === 1 ? 8 : 0,
  gap_to_leader: '',
  interval: position === 1 ? '' : '+36.220',
});

const BADGE = 'Awaiting Official Results';

describe('result tables when the classification is pending', () => {
  it('masks the numeric cells instead of rendering 0', () => {
    renderTable(<SprintResultTable data={[pendingRow(1, 'Max Verstappen')]} />);

    // One pending row = all five numeric cells masked.
    expect(screen.getAllByText(BADGE)).toHaveLength(5);

    // "0" must not appear anywhere in the row (laps/points cells used to
    // render it; driver_number is 3 here so there is no collision).
    const row = screen.getByText('Max Verstappen').closest('tr')!;
    expect(row).not.toHaveTextContent('0');
  });

  it('masks every numeric cell for every pending driver', () => {
    renderTable(
      <SprintResultTable
        data={[
          pendingRow(1, 'Max Verstappen'),
          pendingRow(2, 'Lewis Hamilton'),
        ]}
      />
    );

    // 5 cells x 2 rows.
    expect(screen.getAllByText(BADGE)).toHaveLength(10);
  });

  it('keeps the classification order and the driver identity', () => {
    renderTable(
      <SprintResultTable
        data={[
          pendingRow(1, 'Max Verstappen'),
          pendingRow(2, 'Lewis Hamilton'),
        ]}
      />
    );

    expect(screen.getByText('Max Verstappen')).toBeInTheDocument();
    expect(screen.getByText('Lewis Hamilton')).toBeInTheDocument();
    // Positions are reliable even when the numbers are not.
    expect(screen.getByText('1')).toBeInTheDocument();
    expect(screen.getByText('2')).toBeInTheDocument();
  });
});

describe('result tables when the classification IS finalised', () => {
  it('shows the real numbers, not the badge', () => {
    renderTable(
      <SprintResultTable
        data={[
          finalisedRow(1, 'Max Verstappen'),
          finalisedRow(2, 'Pierre Gasly'),
        ]}
      />
    );

    expect(screen.queryByText(BADGE)).toBeNull();
    // laps=20 for both drivers, so scope to each row rather than getByText.
    const [verstappen] = screen.getAllByText('Max Verstappen').map(el => el.closest('tr')!);
    expect(verstappen).toHaveTextContent('8');
    expect(verstappen).toHaveTextContent('20');
    expect(verstappen).toHaveTextContent('39:48.162');
    const gasly = screen.getByText('Pierre Gasly').closest('tr')!;
    expect(gasly).toHaveTextContent('20');
    expect(gasly).toHaveTextContent('+36.220');
  });

  /**
   * The load-bearing negative case: a driver outside the points scores 0 laps
   * is false but points IS 0 in a real classification. If the predicate ever
   * dropped the laps/time/gap conditions, this row would be masked as pending.
   */
  it('does not mask a genuine 0-points finisher', () => {
    renderTable(<RaceResultTable data={[finalisedRow(2, 'Pierre Gasly')]} />);

    expect(screen.queryByText(BADGE)).toBeNull();
    expect(screen.getByText('20')).toBeInTheDocument();
  });

  it('RaceResultTable masks pending rows the same way', () => {
    renderTable(<RaceResultTable data={[pendingRow(1, 'Max Verstappen')]} />);
    expect(screen.getAllByText(BADGE)).toHaveLength(5);
  });
});
