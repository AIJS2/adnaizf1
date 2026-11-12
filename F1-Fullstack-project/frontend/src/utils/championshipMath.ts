/**
 * Mathematical F1 World Championship Clinching & Elimination Engine
 * Calculates maximum remaining points, title clinching scenarios, magic numbers,
 * and elimination thresholds for both Drivers (WDC) and Constructors (WCC).
 */

export interface ChampionshipRace {
  round: number;
  name?: string;
  date?: string;
  status?: string;
  is_sprint?: boolean;
}

export interface ChampionshipEntry {
  id?: string;
  name: string;
  team?: string;
  position?: number;
  points: number;
  wins?: number;
  color?: string;
  [key: string]: unknown;
}

export type TitleStatus = 'CHAMPION' | 'IN_CONTENTION' | 'ELIMINATED';

export interface EvaluatedEntry<T extends ChampionshipEntry = ChampionshipEntry> {
  entry: T;
  position: number;
  points: number;
  gapToLeader: number;
  maxPossiblePoints: number;
  status: TitleStatus;
  isChampion: boolean;
  isEliminated: boolean;
  canWinTitle: boolean;
}

export interface ChampionshipCalculation<T extends ChampionshipEntry = ChampionshipEntry> {
  leader: T | null;
  runnerUp: T | null;
  gap: number;
  totalRaces: number;
  completedRaces: number;
  remainingRaces: number;
  remainingSprints: number;
  maxPointsPerRace: number;
  maxPointsPerSprint: number;
  maxRemainingPoints: number;
  isClinched: boolean;
  champion: T | null;
  magicNumber: number; // Points leader needs to guarantee title without relying on runner-up results
  entries: EvaluatedEntry<T>[];
}

/**
 * Standard F1 Points System (2025/2026 Regulations)
 * Grand Prix Win: 25 pts
 * Sprint Win: 8 pts
 * Constructor 1-2 GP: 25 + 18 = 43 pts
 * Constructor 1-2 Sprint: 8 + 7 = 15 pts
 * Fastest lap point (optional/historical): 1 pt
 */
export const F1_POINTS = {
  DRIVER_GP_WIN: 25,
  DRIVER_SPRINT_WIN: 8,
  CONSTRUCTOR_GP_MAX: 43, // 1st (25) + 2nd (18)
  CONSTRUCTOR_SPRINT_MAX: 15, // 1st (8) + 2nd (7)
  FASTEST_LAP_POINT: 0, // 0 for 2025+ FIA regulations, 1 for legacy
} as const;

/**
 * Resolve remaining races and sprint weekends from schedule list.
 */
export function getSeasonRemainingRaces(
  races: ChampionshipRace[] = [],
  fallbackTotalRaces: number = 24,
  fallbackCompletedRaces: number = 0
): {
  totalRaces: number;
  completedRaces: number;
  remainingRaces: number;
  remainingSprints: number;
} {
  if (!races || races.length === 0) {
    const remaining = Math.max(0, fallbackTotalRaces - fallbackCompletedRaces);
    return {
      totalRaces: fallbackTotalRaces,
      completedRaces: fallbackCompletedRaces,
      remainingRaces: remaining,
      remainingSprints: 0,
    };
  }

  const now = new Date();
  let completed = 0;
  let remainingSprints = 0;
  let maxFinishedRound = 0;
  let maxRoundInList = 0;

  for (const r of races) {
    const roundNum = Number(r.round) || 0;
    if (roundNum > maxRoundInList) {
      maxRoundInList = roundNum;
    }

    const statusLower = r.status?.toLowerCase() ?? '';
    const isExplicitlyFinished =
      statusLower === 'finished' ||
      statusLower === 'completed';
    const isExplicitlyOngoing =
      statusLower === 'ongoing' ||
      statusLower === 'live';

    // Compare calendar date against current time (6-hour buffer after start/midnight UTC)
    let isPastDate = false;
    if (r.date) {
      const raceDate = new Date(r.date);
      if (!isNaN(raceDate.getTime())) {
        isPastDate = raceDate.getTime() + 6 * 3600 * 1000 < now.getTime();
      }
    }

    if (isExplicitlyFinished || (isPastDate && !isExplicitlyOngoing)) {
      completed++;
      if (roundNum > maxFinishedRound) {
        maxFinishedRound = roundNum;
      }
    } else {
      if (r.is_sprint) {
        remainingSprints++;
      }
    }
  }

  // Detect whether `races` is a partial sliding window (e.g., Dashboard's 4-race `race_analytics`)
  // rather than the full season calendar.
  const isPartialWindow = maxRoundInList > races.length;
  const total = isPartialWindow
    ? Math.max(fallbackTotalRaces, maxRoundInList)
    : races.length;
  const effectiveCompleted = isPartialWindow
    ? Math.max(completed, maxFinishedRound, fallbackCompletedRaces)
    : completed;
  const remaining = Math.max(0, total - effectiveCompleted);

  return {
    totalRaces: total,
    completedRaces: effectiveCompleted,
    remainingRaces: remaining,
    remainingSprints,
  };
}

/**
 * Calculate maximum remaining points a driver or constructor can theoretically earn.
 */
export function calculateMaxRemainingPoints(
  remainingRaces: number,
  remainingSprints: number = 0,
  isConstructor: boolean = false,
  includeFastestLap: boolean = false
): number {
  if (remainingRaces <= 0) return 0;

  const flPoint = includeFastestLap ? 1 : 0;
  if (isConstructor) {
    const perRace = F1_POINTS.CONSTRUCTOR_GP_MAX + flPoint;
    const perSprint = F1_POINTS.CONSTRUCTOR_SPRINT_MAX;
    return remainingRaces * perRace + remainingSprints * perSprint;
  }

  const perRace = F1_POINTS.DRIVER_GP_WIN + flPoint;
  const perSprint = F1_POINTS.DRIVER_SPRINT_WIN;
  return remainingRaces * perRace + remainingSprints * perSprint;
}

/**
 * Mathematical Title Clinching & Elimination Calculator
 * Evaluates whether P1 has mathematically sealed the championship,
 * or calculates the magic number and marks eliminated contenders.
 */
export function evaluateChampionship<T extends ChampionshipEntry>(
  entries: T[],
  options: {
    races?: ChampionshipRace[];
    remainingRaces?: number;
    remainingSprints?: number;
    totalRaces?: number;
    completedRaces?: number;
    isConstructor?: boolean;
    includeFastestLap?: boolean;
  } = {}
): ChampionshipCalculation<T> {
  const isConstructor = options.isConstructor ?? false;
  const includeFastestLap = options.includeFastestLap ?? false;

  // 1. Determine race counts
  const {
    totalRaces,
    completedRaces,
    remainingRaces: calculatedRemainingRaces,
    remainingSprints: calculatedRemainingSprints,
  } = getSeasonRemainingRaces(
    options.races,
    options.totalRaces ?? 24,
    options.completedRaces ?? 0
  );
  let remainingRaces = calculatedRemainingRaces;
  let remainingSprints = calculatedRemainingSprints;

  // If explicit remaining races passed in options, respect them
  if (typeof options.remainingRaces === 'number') {
    remainingRaces = Math.max(0, options.remainingRaces);
  }
  if (typeof options.remainingSprints === 'number') {
    remainingSprints = Math.max(0, options.remainingSprints);
  }

  const maxPointsPerRace = isConstructor
    ? F1_POINTS.CONSTRUCTOR_GP_MAX + (includeFastestLap ? 1 : 0)
    : F1_POINTS.DRIVER_GP_WIN + (includeFastestLap ? 1 : 0);

  const maxPointsPerSprint = isConstructor
    ? F1_POINTS.CONSTRUCTOR_SPRINT_MAX
    : F1_POINTS.DRIVER_SPRINT_WIN;

  const maxRemainingPoints = calculateMaxRemainingPoints(
    remainingRaces,
    remainingSprints,
    isConstructor,
    includeFastestLap
  );

  // Sort entries by points descending, then wins descending
  const sorted = [...entries].sort((a, b) => {
    const ptA = Number(a.points) || 0;
    const ptB = Number(b.points) || 0;
    if (ptB !== ptA) return ptB - ptA;
    const winA = Number(a.wins) || 0;
    const winB = Number(b.wins) || 0;
    return winB - winA;
  });

  const leader = sorted[0] || null;
  const runnerUp = sorted[1] || null;

  const leaderPoints = leader ? Number(leader.points) || 0 : 0;
  const runnerUpPoints = runnerUp ? Number(runnerUp.points) || 0 : 0;
  const gap = Math.max(0, leaderPoints - runnerUpPoints);

  // 2. Clinch Determination
  // A leader is clinched if their gap to P2 is strictly greater than maxRemainingPoints,
  // OR if gap equals maxRemainingPoints and P1 owns the tie-breaker (cannot be overtaken on wins).
  let isClinched = false;
  if (leader && sorted.length > 0) {
    if (remainingRaces === 0) {
      isClinched = true;
    } else if (gap > maxRemainingPoints) {
      isClinched = true;
    } else if (gap === maxRemainingPoints && runnerUp) {
      // Tie-breaker check: If runner-up wins all remaining races, can they beat leader in wins?
      const leaderWins = Number(leader.wins) || 0;
      const runnerUpWins = Number(runnerUp.wins) || 0;
      const maxRunnerUpWins = runnerUpWins + remainingRaces;
      if (leaderWins > maxRunnerUpWins) {
        isClinched = true;
      }
    }
  }

  // Magic Number: Points leader needs to clinch without depending on other results
  // Formula: (P2 points + maxRemainingPoints) - leader points + 1
  let magicNumber = 0;
  if (leader && runnerUp && !isClinched) {
    magicNumber = Math.max(0, runnerUpPoints + maxRemainingPoints - leaderPoints + 1);
  }

  // 3. Evaluate each entry status
  const evaluatedEntries: EvaluatedEntry<T>[] = sorted.map((entry, idx) => {
    const pos = idx + 1;
    const pts = Number(entry.points) || 0;
    const gapToLeader = Math.max(0, leaderPoints - pts);
    const maxPossiblePoints = pts + maxRemainingPoints;

    let status: TitleStatus = 'IN_CONTENTION';
    let isChampion = false;
    let isEliminated = false;
    let canWinTitle = true;

    if (pos === 1 && isClinched) {
      status = 'CHAMPION';
      isChampion = true;
      canWinTitle = true;
      isEliminated = false;
    } else if (isClinched && pos > 1) {
      status = 'ELIMINATED';
      isChampion = false;
      canWinTitle = false;
      isEliminated = true;
    } else {
      // Not yet clinched overall, check individual elimination
      if (maxPossiblePoints < leaderPoints) {
        status = 'ELIMINATED';
        isEliminated = true;
        canWinTitle = false;
      } else if (maxPossiblePoints === leaderPoints) {
        // Can only tie on points: check wins tiebreaker
        const entryWins = Number(entry.wins) || 0;
        const leaderWins = leader ? Number(leader.wins) || 0 : 0;
        if (entryWins + remainingRaces < leaderWins) {
          status = 'ELIMINATED';
          isEliminated = true;
          canWinTitle = false;
        } else {
          status = 'IN_CONTENTION';
          canWinTitle = true;
          isEliminated = false;
        }
      } else {
        status = 'IN_CONTENTION';
        canWinTitle = true;
        isEliminated = false;
      }
    }

    return {
      entry,
      position: pos,
      points: pts,
      gapToLeader,
      maxPossiblePoints,
      status,
      isChampion,
      isEliminated,
      canWinTitle,
    };
  });

  return {
    leader,
    runnerUp,
    gap,
    totalRaces,
    completedRaces,
    remainingRaces,
    remainingSprints,
    maxPointsPerRace,
    maxPointsPerSprint,
    maxRemainingPoints,
    isClinched,
    champion: isClinched ? leader : null,
    magicNumber,
    entries: evaluatedEntries,
  };
}
