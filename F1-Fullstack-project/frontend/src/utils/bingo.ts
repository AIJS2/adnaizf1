// Race-Day Bingo card generation and win detection.
//
// A card is deterministic for a given (year, round, variant) triple: the same
// race always produces the same 25 squares, so two people watching together
// can compare cards and a reload never shuffles someone's progress out from
// under them. `variant` lets a user deal a fresh card for the same race.

import {
  BINGO_EVENTS,
  BINGO_FREE_CELL,
  BINGO_SIZE,
  BingoEvent,
  BingoWeight,
} from '../data/bingoEvents';

/** How many squares of each tier a balanced card gets (plus the free centre). */
const TIER_QUOTA: Record<BingoWeight, number> = {
  common: 10,
  likely: 10,
  rare: 4,
};

/** xmur3 string hash → 32-bit seed. */
function hashSeed(input: string): number {
  let h = 1779033703 ^ input.length;
  for (let i = 0; i < input.length; i++) {
    h = Math.imul(h ^ input.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return (h ^= h >>> 16) >>> 0;
}

/** mulberry32 — small, fast, deterministic PRNG in [0, 1). */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Fisher–Yates on a copy, driven by the supplied PRNG. */
function shuffle<T>(items: T[], rand: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(rand() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function cardSeed(year: number | string, round: number, variant = 0, size = BINGO_SIZE): string {
  return size === BINGO_SIZE
    ? `${year}-${round}-${variant}`
    : `${year}-${round}-${variant}-${size}x${size}`;
}

/**
 * Deal one random card from the classic pool: drawn events plus optional free
 * centre square, balanced across likelihood tiers so a card is winnable
 * without being a formality.
 *
 * NOTE: user custom events are deliberately NOT mixed in here — custom cards
 * are built from scratch by the user (see loadCustomCard/saveCustomCard).
 */
export function generateCard(
  year: number,
  round: number,
  variant = 0,
  size = BINGO_SIZE,
): BingoEvent[] {
  const rand = mulberry32(hashSeed(cardSeed(year, round, variant, size)));
  const totalCells = size * size;
  const hasFreeCell = size % 2 === 1;
  const freeIndex = hasFreeCell ? Math.floor(totalCells / 2) : -1;
  const neededDrawn = hasFreeCell ? totalCells - 1 : totalCells;

  const picked: BingoEvent[] = [];
  (Object.keys(TIER_QUOTA) as BingoWeight[]).forEach((tier) => {
    const pool = BINGO_EVENTS.filter((e) => e.weight === tier);
    picked.push(...shuffle(pool, rand).slice(0, TIER_QUOTA[tier]));
  });

  // Top up from whatever is left if a tier pool was smaller than its quota.
  if (picked.length < neededDrawn) {
    const chosen = new Set(picked.map((e) => e.id));
    const rest = shuffle(BINGO_EVENTS.filter((e) => !chosen.has(e.id)), rand);
    picked.push(...rest.slice(0, neededDrawn - picked.length));
  }

  const squares = shuffle(picked.slice(0, neededDrawn), rand);
  if (hasFreeCell && freeIndex >= 0) {
    squares.splice(freeIndex, 0, BINGO_FREE_CELL);
  }
  return squares;
}

/** Every winning index set on a 5x5 card: 5 rows, 5 columns, 2 diagonals. */
export function winningLines(size = BINGO_SIZE): number[][] {
  const lines: number[][] = [];
  for (let r = 0; r < size; r++) {
    lines.push(Array.from({ length: size }, (_, c) => r * size + c));
  }
  for (let c = 0; c < size; c++) {
    lines.push(Array.from({ length: size }, (_, r) => r * size + c));
  }
  lines.push(Array.from({ length: size }, (_, i) => i * size + i));
  lines.push(Array.from({ length: size }, (_, i) => i * size + (size - 1 - i)));
  return lines;
}

export interface BingoProgress {
  /** Indices of every completed line. */
  lines: number[][];
  /** Flat set of indices that belong to at least one completed line. */
  highlighted: Set<number>;
  marked: number;
  /** True once every square is marked. */
  blackout: boolean;
}

export function evaluateCard(marked: Set<number>, size = BINGO_SIZE): BingoProgress {
  const lines = winningLines(size).filter((line) => line.every((i) => marked.has(i)));
  const highlighted = new Set<number>();
  lines.forEach((line) => line.forEach((i) => highlighted.add(i)));
  return {
    lines,
    highlighted,
    marked: marked.size,
    blackout: marked.size >= size * size,
  };
}

const STORAGE_PREFIX = 'f1-bingo';

export function storageKey(year: number | string, round: number, variant = 0, size = BINGO_SIZE): string {
  const seed = cardSeed(year, round, variant, size);
  return `${STORAGE_PREFIX}:${seed}`;
}

/** Persisted custom events pool — survives across all races and variants. */
export function loadCustomEvents(): BingoEvent[] {
  try {
    const raw = window.localStorage.getItem(`${STORAGE_PREFIX}:custom-events`);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (e): e is BingoEvent =>
        typeof e === 'object' &&
        e !== null &&
        typeof (e as Record<string, unknown>).id === 'string' &&
        typeof (e as Record<string, unknown>).label === 'string' &&
        ['common', 'likely', 'rare'].includes((e as Record<string, unknown>).weight as string),
    );
  } catch {
    return [];
  }
}

export function saveCustomEvents(events: BingoEvent[]): void {
  try {
    window.localStorage.setItem(`${STORAGE_PREFIX}:custom-events`, JSON.stringify(events));
  } catch {
    // Private browsing or full quota — ignore.
  }
}

export function addCustomEvent(
  events: BingoEvent[],
  label: string,
  weight: BingoWeight = 'common',
): BingoEvent[] {
  const trimmed = label.trim();
  if (!trimmed) return events;
  const id = `custom-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const newEvent: BingoEvent = { id, label: trimmed, weight };
  const updated = [newEvent, ...events];
  saveCustomEvents(updated);
  return updated;
}

export function removeCustomEvent(events: BingoEvent[], id: string): BingoEvent[] {
  const updated = events.filter((e) => e.id !== id);
  saveCustomEvents(updated);
  return updated;
}

/**
 * Blank custom card, built from scratch by the user (no randomization).
 * Per-size storage key so a user-made 3x3 card stays separate from 5x5.
 */
const CUSTOM_CARD_PREFIX = `${STORAGE_PREFIX}:custom-card`;

export function customCardKey(year: number, round: number, size = BINGO_SIZE): string {
  return `${CUSTOM_CARD_PREFIX}:${year}-${round}-${size}x${size}`;
}

/** Builds an empty-but-sized card placeholder, with custom cells set to null. */
export function emptyCustomCard(size = BINGO_SIZE): (BingoCardCell | null)[] {
  return Array.from({ length: size * size }, () => null);
}

export type BingoCardCell = BingoEvent;

/** Reads the user-built custom card; corrupt or absent reads as all empty. */
export function loadCustomCard(
  year: number,
  round: number,
  size = BINGO_SIZE,
): (BingoCardCell | null)[] {
  try {
    const raw = window.localStorage.getItem(customCardKey(year, round, size));
    if (!raw) return emptyCustomCard(size);
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed) || parsed.length !== size * size) {
      return emptyCustomCard(size);
    }
    return parsed.map((entry) => {
      if (entry === null) return null;
      if (
        typeof entry === 'object' &&
        entry !== null &&
        typeof (entry as Record<string, unknown>).id === 'string' &&
        typeof (entry as Record<string, unknown>).label === 'string'
      ) {
        return entry as BingoEvent;
      }
      return null;
    });
  } catch {
    return emptyCustomCard(size);
  }
}

export function saveCustomCard(
  year: number,
  round: number,
  cells: (BingoCardCell | null)[],
  size = BINGO_SIZE,
): void {
  try {
    window.localStorage.setItem(customCardKey(year, round, size), JSON.stringify(cells));
  } catch {
    // Ignore — card still works in-session.
  }
}

/** Highest variant the user has dealt for this race. */
export function loadVariant(
  year: number | string,
  round: number,
  size = BINGO_SIZE,
): number {
  const sizeKey = size === BINGO_SIZE ? '' : `-${size}x${size}`;
  try {
    const raw = window.localStorage.getItem(
      `${STORAGE_PREFIX}:variant:${year}-${round}${sizeKey}`,
    );
    const n = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(n) && n >= 0 ? n : 0;
  } catch {
    return 0;
  }
}

export function saveVariant(
  year: number | string,
  round: number,
  variant: number,
  size = BINGO_SIZE,
): void {
  const sizeKey = size === BINGO_SIZE ? '' : `-${size}x${size}`;
  try {
    window.localStorage.setItem(
      `${STORAGE_PREFIX}:variant:${year}-${round}${sizeKey}`,
      String(variant),
    );
  } catch {
    // Ignore.
  }
}

/** Marked squares survive a reload; a corrupt or absent entry reads as empty. */
export function loadMarks(
  year: number | string,
  round: number,
  variant = 0,
  size = BINGO_SIZE,
): Set<number> {
  try {
    const raw = window.localStorage.getItem(storageKey(year, round, variant, size));
    if (!raw) return new Set();
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return new Set();
    const maxIndex = size * size - 1;
    return new Set(
      (parsed as number[]).filter(
        (n): n is number => typeof n === 'number' && n >= 0 && n <= maxIndex,
      ),
    );
  } catch {
    return new Set();
  }
}

export function saveMarks(
  year: number | string,
  round: number,
  marked: Set<number>,
  variant = 0,
  size = BINGO_SIZE,
): void {
  try {
    window.localStorage.setItem(
      storageKey(year, round, variant, size),
      JSON.stringify([...marked]),
    );
  } catch {
    // Private-browsing or a full quota must not break the card.
  }
}
