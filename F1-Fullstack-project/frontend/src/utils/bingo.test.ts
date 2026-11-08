// Unit tests for Race-Day Bingo card generation and win detection.
import { describe, expect, it, beforeEach } from 'vitest';
import {
  BINGO_CELLS,
  BINGO_EVENTS,
  BINGO_FREE_CELL,
  BINGO_FREE_INDEX,
} from '../data/bingoEvents';
import {
  generateCard,
  evaluateCard,
  winningLines,
  storageKey,
  loadMarks,
  saveMarks,
  loadVariant,
  saveVariant,
  loadCustomEvents,
  addCustomEvent,
  removeCustomEvent,
  emptyCustomCard,
  loadCustomCard,
  saveCustomCard,
  customCardKey,
} from './bingo';

describe('generateCard', () => {
  it('always produces 25 squares with the free centre at index 12', () => {
    const card = generateCard(2026, 19);
    expect(card).toHaveLength(BINGO_CELLS);
    expect(card[BINGO_FREE_INDEX]).toEqual(BINGO_FREE_CELL);
  });

  it('is deterministic for the same (year, round, variant)', () => {
    const a = generateCard(2026, 19, 0);
    const b = generateCard(2026, 19, 0);
    expect(a).toEqual(b);
  });

  it('deals a different card for a different round or variant', () => {
    const base = generateCard(2026, 19, 0).map((e) => e.id);
    const otherRound = generateCard(2026, 20, 0).map((e) => e.id);
    const otherVariant = generateCard(2026, 19, 1).map((e) => e.id);
    expect(base).not.toEqual(otherRound);
    expect(base).not.toEqual(otherVariant);
  });

  it('never repeats an event on one card', () => {
    const card = generateCard(2026, 19, 3);
    const ids = card
      .filter((e) => e !== BINGO_FREE_CELL)
      .map((e) => e.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('only draws events from the BINGO_EVENTS pool', () => {
    const pool = new Set(BINGO_EVENTS.map((e) => e.id));
    const card = generateCard(2026, 19, 7);
    card.forEach((event) => {
      if (event !== BINGO_FREE_CELL) expect(pool.has(event.id)).toBe(true);
    });
  });
});

describe('winningLines', () => {
  it('returns 12 lines: 5 rows, 5 columns, 2 diagonals', () => {
    expect(winningLines()).toHaveLength(12);
  });
});

describe('evaluateCard', () => {
  it('reports no bingo on an empty card', () => {
    const result = evaluateCard(new Set());
    expect(result.lines).toHaveLength(0);
    expect(result.blackout).toBe(false);
  });

  it('reports no bingo on a partial card', () => {
    const result = evaluateCard(new Set([0, 1, 2]));
    expect(result.lines).toHaveLength(0);
    expect(result.marked).toBe(3);
  });

  it('detects a completed top row', () => {
    const marked = new Set([0, 1, 2, 3, 4]);
    const result = evaluateCard(marked);
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toEqual([0, 1, 2, 3, 4]);
    expect(result.highlighted).toEqual(new Set([0, 1, 2, 3, 4]));
  });

  it('detects a diagonal including the free centre', () => {
    const diagonal = [0, 6, 12, 18, 24];
    const result = evaluateCard(new Set(diagonal));
    expect(result.lines).toHaveLength(1);
    expect(result.lines[0]).toEqual(diagonal);
  });

  it('counts multiple lines at once and flags blackout at 25 marks', () => {
    const all = new Set(Array.from({ length: BINGO_CELLS }, (_, i) => i));
    const result = evaluateCard(all);
    expect(result.lines).toHaveLength(12);
    expect(result.blackout).toBe(true);
  });
});

describe('storage round-trips', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('persists and restores marked squares', () => {
    saveMarks(2026, 19, new Set([2, 12, 24]), 0);
    expect(loadMarks(2026, 19, 0)).toEqual(new Set([2, 12, 24]));
    expect(storageKey(2026, 19, 0)).toBe('f1-bingo:2026-19-0');
  });

  it('reads a fresh card as empty and ignores corrupt data', () => {
    expect(loadMarks(2026, 5, 0).size).toBe(0);
    window.localStorage.setItem('f1-bingo:2026-5-0', 'not json');
    expect(loadMarks(2026, 5, 0).size).toBe(0);
    window.localStorage.setItem('f1-bingo:2026-5-0', JSON.stringify([-1, 99, 'x']));
    expect(loadMarks(2026, 5, 0).size).toBe(0);
  });

  it('persists and restores the variant counter', () => {
    expect(loadVariant(2026, 19)).toBe(0);
    saveVariant(2026, 19, 2);
    expect(loadVariant(2026, 19)).toBe(2);
  });
});

describe('custom bingo events', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('adds and removes custom events', () => {
    const initial = loadCustomEvents();
    expect(initial).toEqual([]);

    const afterOne = addCustomEvent([], 'Ferrari 10s pit stop', 'rare');
    expect(afterOne).toHaveLength(1);
    expect(afterOne[0].label).toBe('Ferrari 10s pit stop');
    expect(afterOne[0].weight).toBe('rare');
    expect(afterOne[0].id).toMatch(/^custom-/);

    // Persisted to localStorage
    expect(loadCustomEvents()).toEqual(afterOne);

    const afterTwo = addCustomEvent(afterOne, 'Tsunoda radio rage', 'common');
    expect(afterTwo).toHaveLength(2);

    const afterRemove = removeCustomEvent(afterTwo, afterOne[0].id);
    expect(afterRemove).toHaveLength(1);
    expect(afterRemove[0].label).toBe('Tsunoda radio rage');
    expect(loadCustomEvents()).toEqual(afterRemove);
  });

  it('ignores empty labels when adding', () => {
    const list = addCustomEvent([], '   ');
    expect(list).toHaveLength(0);
  });

  it('never mixes custom events into the randomized card', () => {
    const custom = [
      { id: 'c1', label: 'Custom prediction 1', weight: 'common' as const },
      { id: 'c2', label: 'Custom prediction 2', weight: 'likely' as const },
      { id: 'c3', label: 'Custom prediction 3', weight: 'rare' as const },
    ];
    const card = generateCard(2026, 19, 0);
    expect(card).toHaveLength(25);
    card.forEach((event) => {
      if (event !== BINGO_FREE_CELL) {
        expect(BINGO_EVENTS.some((e) => e.id === event.id)).toBe(true);
      }
    });
    // Silence unused-var lint while asserting the pool contract above.
    expect(custom).toHaveLength(3);
  });

  it('supports alternative grid sizes like 3x3 and 4x4', () => {
    const card3 = generateCard(2026, 19, 0, 3);
    expect(card3).toHaveLength(9);
    // 3x3 has free center at index 4
    expect(card3[4].id).toBe('free-lights-out');

    const card4 = generateCard(2026, 19, 0, 4);
    expect(card4).toHaveLength(16);
    // Even grid 4x4 has no free center
    expect(card4.every((e) => e.id !== 'free-lights-out')).toBe(true);
  });
});

describe('blank custom card (built from scratch)', () => {
  beforeEach(() => {
    window.localStorage.clear();
  });

  it('starts empty and lets the user fill every square themselves', () => {
    const blank = emptyCustomCard(5);
    expect(blank).toHaveLength(25);
    expect(blank.every((c) => c === null)).toBe(true);

    const filled = [...blank];
    filled[0] = { id: 'my-1', label: 'Max wins', weight: 'likely' };
    filled[1] = { id: 'my-2', label: 'Haas points', weight: 'rare' };
    saveCustomCard(2026, 19, filled);

    expect(loadCustomCard(2026, 19)).toEqual(filled);
    expect(customCardKey(2026, 19)).toBe('f1-bingo:custom-card:2026-19-5x5');
  });

  it('keeps custom cards separate per grid size', () => {
    const filled5 = emptyCustomCard(5);
    filled5[0] = { id: 'a', label: 'Five by five', weight: 'common' };
    saveCustomCard(2026, 19, filled5, 5);

    const filled3 = emptyCustomCard(3);
    filled3[2] = { id: 'b', label: 'Three by three', weight: 'rare' };
    saveCustomCard(2026, 19, filled3, 3);

    expect(loadCustomCard(2026, 19, 5)[0]?.label).toBe('Five by five');
    expect(loadCustomCard(2026, 19, 3)[2]?.label).toBe('Three by three');
  });

  it('reads a corrupt or wrong-length card as blank', () => {
    window.localStorage.setItem(customCardKey(2026, 19), 'not json');
    expect(loadCustomCard(2026, 19).every((c) => c === null)).toBe(true);

    window.localStorage.setItem(customCardKey(2026, 19), JSON.stringify([1, 2]));
    expect(loadCustomCard(2026, 19).every((c) => c === null)).toBe(true);
  });
});
