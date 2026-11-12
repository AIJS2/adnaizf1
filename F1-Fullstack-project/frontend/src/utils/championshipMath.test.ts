import { describe, it, expect } from 'vitest';
import {
  calculateMaxRemainingPoints,
  evaluateChampionship,
  getSeasonRemainingRaces,
} from './championshipMath';

describe('championshipMath utilities', () => {
  describe('calculateMaxRemainingPoints', () => {
    it('returns 0 when no races remain', () => {
      expect(calculateMaxRemainingPoints(0, 0, false)).toBe(0);
      expect(calculateMaxRemainingPoints(0, 0, true)).toBe(0);
    });

    it('calculates driver maximum points correctly for 3 races with 0 sprints', () => {
      // 3 * 25 = 75
      expect(calculateMaxRemainingPoints(3, 0, false)).toBe(75);
    });

    it('calculates driver maximum points with 1 sprint weekend', () => {
      // 3 * 25 + 1 * 8 = 83
      expect(calculateMaxRemainingPoints(3, 1, false)).toBe(83);
    });

    it('calculates constructor maximum points for 3 races with 0 sprints', () => {
      // 3 * 43 = 129
      expect(calculateMaxRemainingPoints(3, 0, true)).toBe(129);
    });

    it('calculates constructor maximum points with 1 sprint weekend', () => {
      // 3 * 43 + 1 * 15 = 144
      expect(calculateMaxRemainingPoints(3, 1, true)).toBe(144);
    });
  });

  describe('getSeasonRemainingRaces', () => {
    it('calculates completed and remaining races from race list', () => {
      const mockRaces = [
        { round: 1, name: 'GP 1', status: 'Finished', is_sprint: false },
        { round: 2, name: 'GP 2', status: 'Finished', is_sprint: false },
        { round: 3, name: 'GP 3', status: 'Upcoming', is_sprint: true },
        { round: 4, name: 'GP 4', status: 'Upcoming', is_sprint: false },
      ];

      const res = getSeasonRemainingRaces(mockRaces);
      expect(res.totalRaces).toBe(4);
      expect(res.completedRaces).toBe(2);
      expect(res.remainingRaces).toBe(2);
      expect(res.remainingSprints).toBe(1);
    });

    it('handles partial race_analytics sliding window and past dates marked Upcoming', () => {
      const slidingWindow = [
        { round: 17, name: 'Japanese GP', date: '2026-10-11', status: 'Finished' },
        { round: 18, name: 'United States GP', date: '2026-10-25', status: 'Finished' },
        { round: 19, name: 'Mexico City GP', date: '2026-11-01', status: 'Upcoming' },
        { round: 20, name: 'São Paulo GP', date: '2099-11-08', status: 'Upcoming' },
      ];

      const res = getSeasonRemainingRaces(slidingWindow, 23, 18);
      expect(res.totalRaces).toBe(23);
      expect(res.completedRaces).toBe(19);
      expect(res.remainingRaces).toBe(4);
    });
  });

  describe('evaluateChampionship - 2026 Antonelli WDC Clinch Scenario', () => {
    const drivers2026 = [
      { name: 'Andrea Kimi Antonelli', points: 365, wins: 11, team: 'Mercedes' },
      { name: 'George Russell', points: 242, wins: 1, team: 'Mercedes' },
      { name: 'Lewis Hamilton', points: 241, wins: 2, team: 'Ferrari' },
      { name: 'Max Verstappen', points: 236, wins: 2, team: 'Red Bull' },
      { name: 'Charles Leclerc', points: 233, wins: 0, team: 'Ferrari' },
      { name: 'Lando Norris', points: 211, wins: 1, team: 'McLaren' },
    ];

    it('confirms Kimi Antonelli has CLINCHED WDC when 3 or 4 races remain', () => {
      // Antonelli: 365, Russell: 242. Gap = 123 pts.
      // With 4 races remaining without sprints: max = 4 * 25 = 100 pts.
      // Gap 123 > 100 -> Clinched!
      const result = evaluateChampionship(drivers2026, {
        remainingRaces: 4,
        remainingSprints: 0,
      });

      expect(result.isClinched).toBe(true);
      expect(result.champion?.name).toBe('Andrea Kimi Antonelli');
      expect(result.gap).toBe(123);
      expect(result.magicNumber).toBe(0);

      // Antonelli is Champion
      expect(result.entries[0].status).toBe('CHAMPION');
      expect(result.entries[0].isChampion).toBe(true);

      // All contenders are Eliminated
      expect(result.entries[1].status).toBe('ELIMINATED');
      expect(result.entries[1].isEliminated).toBe(true);
      expect(result.entries[2].status).toBe('ELIMINATED');
      expect(result.entries[3].status).toBe('ELIMINATED');
    });

    it('confirms Kimi Antonelli has CLINCHED WDC even with 4 races and 1 sprint', () => {
      // Max remaining points = 4 * 25 + 1 * 8 = 108 pts.
      // Gap 123 > 108 -> Still Clinched!
      const result = evaluateChampionship(drivers2026, {
        remainingRaces: 4,
        remainingSprints: 1,
      });

      expect(result.isClinched).toBe(true);
      expect(result.champion?.name).toBe('Andrea Kimi Antonelli');
    });
  });

  describe('evaluateChampionship - 2026 Mercedes WCC Clinch Scenario', () => {
    const teams2026 = [
      { name: 'Mercedes', points: 607, wins: 12 },
      { name: 'Ferrari', points: 474, wins: 2 },
      { name: 'Red Bull', points: 355, wins: 2 },
      { name: 'McLaren', points: 355, wins: 2 },
    ];

    it('confirms Mercedes has CLINCHED WCC when 3 races remain with no sprints', () => {
      // Mercedes: 607, Ferrari: 474. Gap = 133 pts.
      // 3 races remaining: 3 * 43 = 129 pts max.
      // Gap 133 > 129 -> Clinched!
      const result = evaluateChampionship(teams2026, {
        remainingRaces: 3,
        remainingSprints: 0,
        isConstructor: true,
      });

      expect(result.isClinched).toBe(true);
      expect(result.champion?.name).toBe('Mercedes');
      expect(result.gap).toBe(133);
      expect(result.entries[0].status).toBe('CHAMPION');
      expect(result.entries[1].status).toBe('ELIMINATED');
    });
  });

  describe('evaluateChampionship - Mid-Season Active Contention', () => {
    const activeGrid = [
      { name: 'Leader', points: 150, wins: 4 },
      { name: 'Challenger', points: 135, wins: 3 },
      { name: 'Backmarker', points: 10, wins: 0 },
    ];

    it('evaluates active contention correctly when title is not clinched', () => {
      // Gap = 15 pts, 10 races remaining: max points = 250
      const result = evaluateChampionship(activeGrid, {
        remainingRaces: 10,
        remainingSprints: 0,
      });

      expect(result.isClinched).toBe(false);
      expect(result.champion).toBeNull();
      expect(result.magicNumber).toBeGreaterThan(0);

      // Challenger can still win
      expect(result.entries[1].status).toBe('IN_CONTENTION');
      expect(result.entries[1].canWinTitle).toBe(true);

      // Backmarker with 10 pts + 250 = 260 can theoretically still contest if leader stalls
      expect(result.entries[2].status).toBe('IN_CONTENTION');
    });

    it('marks mathematically eliminated driver when cannot catch leader', () => {
      const lateGrid = [
        { name: 'Leader', points: 300, wins: 8 },
        { name: 'Challenger', points: 280, wins: 4 },
        { name: 'Eliminated Driver', points: 100, wins: 0 },
      ];

      // 2 races remaining: max points = 2 * 25 = 50.
      // Eliminated Driver max = 150 < 300 -> ELIMINATED!
      // Challenger max = 280 + 50 = 330 >= 300 -> IN_CONTENTION!
      const result = evaluateChampionship(lateGrid, {
        remainingRaces: 2,
        remainingSprints: 0,
      });

      expect(result.isClinched).toBe(false);
      expect(result.entries[1].status).toBe('IN_CONTENTION');
      expect(result.entries[2].status).toBe('ELIMINATED');
      expect(result.entries[2].isEliminated).toBe(true);
    });
  });
});
