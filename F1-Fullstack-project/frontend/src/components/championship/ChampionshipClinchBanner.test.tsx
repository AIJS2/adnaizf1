import { describe, it, expect } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import ChampionshipClinchBanner from './ChampionshipClinchBanner';

describe('ChampionshipClinchBanner', () => {
  const driversMock = [
    { name: 'Andrea Kimi Antonelli', points: 365, wins: 11, team: 'Mercedes' },
    { name: 'George Russell', points: 242, wins: 1, team: 'Mercedes' },
    { name: 'Lewis Hamilton', points: 241, wins: 2, team: 'Ferrari' },
  ];

  const teamsMock = [
    { name: 'Mercedes', points: 607, wins: 12 },
    { name: 'Ferrari', points: 474, wins: 2 },
  ];

  const racesMock = [
    { round: 1, name: 'Bahrain', status: 'Finished' },
    { round: 2, name: 'Saudi', status: 'Finished' },
    { round: 3, name: 'Australia', status: 'Finished' },
    { round: 4, name: 'Japan', status: 'Finished' },
    { round: 5, name: 'China', status: 'Finished' },
    { round: 6, name: 'Miami', status: 'Finished' },
    { round: 7, name: 'Emilia', status: 'Finished' },
    { round: 8, name: 'Monaco', status: 'Finished' },
    { round: 9, name: 'Canada', status: 'Finished' },
    { round: 10, name: 'Spain', status: 'Finished' },
    { round: 11, name: 'Austria', status: 'Finished' },
    { round: 12, name: 'Britain', status: 'Finished' },
    { round: 13, name: 'Hungary', status: 'Finished' },
    { round: 14, name: 'Belgium', status: 'Finished' },
    { round: 15, name: 'Netherlands', status: 'Finished' },
    { round: 16, name: 'Monza', status: 'Finished' },
    { round: 17, name: 'Baku', status: 'Finished' },
    { round: 18, name: 'Singapore', status: 'Finished' },
    { round: 19, name: 'Austin', status: 'Finished' },
    { round: 20, name: 'Mexico', status: 'Finished' },
    { round: 21, name: 'Brazil', status: 'Upcoming' },
    { round: 22, name: 'Qatar', status: 'Upcoming' },
    { round: 23, name: 'Abu Dhabi', status: 'Upcoming' },
  ];

  it('renders WDC & WCC clinched announcements correctly', () => {
    render(
      <ChampionshipClinchBanner
        drivers={driversMock}
        teams={teamsMock}
        races={racesMock}
        currentYear={2026}
      />
    );

    expect(screen.getByText(/2026 World Championship Title Status/i)).toBeInTheDocument();
    expect(screen.getByText(/WDC Champion Clinched/i)).toBeInTheDocument();
    expect(screen.getByText('Andrea Kimi Antonelli')).toBeInTheDocument();
    expect(screen.getByText(/WCC Champion Clinched/i)).toBeInTheDocument();
    expect(screen.getByText('Mercedes')).toBeInTheDocument();
  });

  it('toggles mathematical proof details when button is clicked', () => {
    render(
      <ChampionshipClinchBanner
        drivers={driversMock}
        teams={teamsMock}
        races={racesMock}
        currentYear={2026}
      />
    );

    const toggleBtn = screen.getByRole('button', { name: /Mathematical Proof/i });
    expect(screen.queryByText(/Official Clinching Formula/i)).not.toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.getByText(/Official Clinching Formula/i)).toBeInTheDocument();

    fireEvent.click(toggleBtn);
    expect(screen.queryByText(/Official Clinching Formula/i)).not.toBeInTheDocument();
  });
});
