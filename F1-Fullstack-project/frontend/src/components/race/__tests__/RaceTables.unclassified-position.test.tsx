/**
 * Regression tests for the "P0" bug.
 *
 * OpenF1's session_result never classifies retired cars — `position` comes
 * back null and the backend serialises it as 0, which the tables rendered as
 * a confident "P0" above every finisher (Azerbaijan 2026, round 15). These
 * tests pin the replacement: the POS cell shows the retirement reason and the
 * tyre strategy column shows it too, while real positions are untouched.
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';

import { RaceResultTable, TyreStrategyTable } from '../RaceTables';
import type { SessionResultRow, TyreStrategyEntry } from '../../../types/f1';

const renderTable = (ui: React.ReactElement) =>
  render(<MemoryRouter>{ui}</MemoryRouter>);

/** OpenF1's shape for a car it did not classify. */
const unclassifiedRow = (fullName: string): SessionResultRow => ({
  position: 0,
  driver_number: 43,
  full_name: fullName,
  team_name: 'Alpine',
  time: '',
  status: 'DNF',
  laps: 36,
  points: 0,
  gap_to_leader: '',
  interval: '',
});

const classifiedRow = (position: number, fullName: string): SessionResultRow => ({
  position,
  driver_number: 63,
  full_name: fullName,
  team_name: 'Mercedes',
  time: '1:27:11.335',
  status: 'Finished',
  laps: 51,
  points: 25,
  gap_to_leader: '',
  interval: '',
});

const unclassifiedStrategy: TyreStrategyEntry = {
  driver: 'COL',
  full_name: 'Franco Colapinto',
  team_name: 'Alpine',
  driver_number: 43,
  position: 0,
  status: 'DNF',
  total_laps: 36,
  stints: [{ stint: 1, compound: 'MEDIUM', start_lap: 1, end_lap: 36, laps: 36 }],
};

const classifiedStrategy: TyreStrategyEntry = {
  driver: 'RUS',
  full_name: 'George Russell',
  team_name: 'Mercedes',
  driver_number: 63,
  position: 1,
  status: 'Finished',
  total_laps: 51,
  stints: [{ stint: 1, compound: 'MEDIUM', start_lap: 1, end_lap: 51, laps: 51 }],
};

describe('unclassified cars in the result tables', () => {
  it('shows the retirement reason in the POS cell instead of 0', () => {
    renderTable(
      <RaceResultTable data={[classifiedRow(1, 'George Russell'), unclassifiedRow('Franco Colapinto')]} />,
    );

    const [positionCell] = Array.from(
      screen.getByText('Franco Colapinto').closest('tr')!.cells,
    );
    expect(positionCell).toHaveTextContent('DNF');
    expect(positionCell).not.toHaveTextContent('0');
  });

  it('keeps the real position for classified drivers', () => {
    renderTable(<RaceResultTable data={[classifiedRow(4, 'George Russell')]} />);

    const [positionCell] = Array.from(
      screen.getByText('George Russell').closest('tr')!.cells,
    );
    expect(positionCell).toHaveTextContent('4');
  });
});

describe('unclassified cars in the tyre strategy table', () => {
  it('labels the row DNF rather than P0', () => {
    renderTable(
      <TyreStrategyTable tyreData={[classifiedStrategy, unclassifiedStrategy]} />,
    );

    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.getByText('DNF')).toBeInTheDocument();
    expect(screen.queryByText('P0')).toBeNull();
  });

  it('still labels a classified driver with their position', () => {
    renderTable(<TyreStrategyTable tyreData={[classifiedStrategy]} />);

    expect(screen.getByText('P1')).toBeInTheDocument();
    expect(screen.queryByText('DNF')).toBeNull();
  });
});
