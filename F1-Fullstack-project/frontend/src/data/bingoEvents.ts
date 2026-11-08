// Race-Day Bingo event pool.
//
// Each entry is one thing a viewer can plausibly spot during a Grand Prix
// weekend. `weight` is the rough likelihood tier, used only to balance a card
// so it is neither trivially completable nor impossible:
//   'common'   — happens most races
//   'likely'   — happens often
//   'rare'     — a genuine talking point when it lands
//
// The pool is deliberately larger than a card (25 cells) so two cards for
// different rounds do not look identical.

export type BingoWeight = 'common' | 'likely' | 'rare';

export interface BingoEvent {
  id: string;
  label: string;
  weight: BingoWeight;
}

export const BINGO_EVENTS: BingoEvent[] = [
  // --- Common: most race weekends deliver these -------------------------
  { id: 'drs-overtake', label: 'A DRS overtake on the main straight', weight: 'common' },
  { id: 'team-radio-angry', label: 'Angry team radio', weight: 'common' },
  { id: 'lock-up', label: 'Visible lock-up into a braking zone', weight: 'common' },
  { id: 'track-limits', label: 'A track-limits warning', weight: 'common' },
  { id: 'undercut', label: 'Someone tries an undercut', weight: 'common' },
  { id: 'pit-window-talk', label: 'Commentators say "pit window"', weight: 'common' },
  { id: 'tyre-deg-talk', label: 'Commentators mention tyre degradation', weight: 'common' },
  { id: 'blue-flags', label: 'Blue flags for a lapped car', weight: 'common' },
  { id: 'fastest-lap-late', label: 'Fastest lap set in the final 5 laps', weight: 'common' },
  { id: 'hard-racing', label: 'Wheel-to-wheel fight for more than one lap', weight: 'common' },
  { id: 'sector-purple', label: 'A purple sector from outside the top 3', weight: 'common' },
  { id: 'box-box', label: 'You hear "Box, box"', weight: 'common' },

  // --- Likely: not guaranteed, but no surprise -------------------------
  { id: 'safety-car', label: 'Safety Car deployed', weight: 'likely' },
  { id: 'vsc', label: 'Virtual Safety Car', weight: 'likely' },
  { id: 'yellow-flag', label: 'Yellow flag in any sector', weight: 'likely' },
  { id: 'dnf', label: 'At least one DNF', weight: 'likely' },
  { id: 'slow-pitstop', label: 'A pit stop over 4.0 seconds', weight: 'likely' },
  { id: 'penalty-5s', label: 'A 5-second time penalty handed out', weight: 'likely' },
  { id: 'investigation', label: '"Under investigation" on screen', weight: 'likely' },
  { id: 'off-track-excursion', label: 'A car runs through the gravel or run-off', weight: 'likely' },
  { id: 'pole-wins', label: 'Pole sitter wins the race', weight: 'likely' },
  { id: 'teammate-clash', label: 'Teammates fight each other on track', weight: 'likely' },
  { id: 'fastest-not-winner', label: 'Fastest lap not set by the winner', weight: 'likely' },
  { id: 'driver-of-day-midfield', label: 'Driver of the Day from the midfield', weight: 'likely' },
  { id: 'strategy-split', label: 'A team splits strategy between its drivers', weight: 'likely' },
  { id: 'rain-mentioned', label: 'Rain radar shown on the broadcast', weight: 'likely' },
  { id: 'overtake-outside', label: 'An overtake completed on the outside line', weight: 'likely' },
  { id: 'podium-newcomer', label: 'A podium for someone not in the top 3 of the standings', weight: 'likely' },

  // --- Rare: the moments that make the group chat explode ---------------
  { id: 'red-flag', label: 'Red flag', weight: 'rare' },
  { id: 'lap-1-contact', label: 'Contact on lap 1', weight: 'rare' },
  { id: 'pit-lane-drama', label: 'Unsafe release or pit-lane incident', weight: 'rare' },
  { id: 'last-lap-pass', label: 'A position change on the last lap', weight: 'rare' },
  { id: 'both-cars-out', label: 'Both cars of one team retire', weight: 'rare' },
  { id: 'wet-tyres', label: 'Someone fits intermediates or full wets', weight: 'rare' },
  { id: 'drive-through', label: 'A drive-through or stop-go penalty', weight: 'rare' },
  { id: 'grid-penalty-recovery', label: 'A grid-penalty starter finishes in the points', weight: 'rare' },
  { id: 'photo-finish', label: 'Winning margin under 1 second', weight: 'rare' },
  { id: 'mechanical-fire', label: 'Smoke or flames from a car', weight: 'rare' },
];

/** Card geometry. 5x5 with a free centre square, like classic bingo. */
export const BINGO_SIZE = 5;
export const BINGO_CELLS = BINGO_SIZE * BINGO_SIZE;
export const BINGO_FREE_INDEX = Math.floor(BINGO_CELLS / 2);

export const BINGO_FREE_CELL: BingoEvent = {
  id: 'free-lights-out',
  label: 'Lights out — race started',
  weight: 'common',
};
