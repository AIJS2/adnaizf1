import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, useReducedMotion } from 'framer-motion';
import {
  Grid3X3,
  RefreshCw,
  Trophy,
  Eraser,
  Share2,
  Check,
  ChevronDown,
  Flag,
  Plus,
  Trash2,
  X,
  Sparkles,
  Dices,
  PenLine,
  Radio,
  AlertTriangle,
  Trophy as TrophyIcon,
  Zap,
  Lightbulb,
  ListPlus,
} from 'lucide-react';
import { API_URL } from '../config';
import { Race } from '../types/f1';
import { resolveNextRace } from '../utils/nextRace';
import { BingoWeight, BingoEvent } from '../data/bingoEvents';
import {
  evaluateCard,
  generateCard,
  loadMarks,
  loadVariant,
  saveMarks,
  saveVariant,
  emptyCustomCard,
  loadCustomCard,
  saveCustomCard,
  BingoCardCell,
} from '../utils/bingo';
import { BingoCircuitBadge } from '../components/ui/BingoCircuitBadge';
import { CircuitLookup } from '../data/circuitPaths';

const CURRENT_YEAR = new Date().getFullYear();

type BingoSize = 3 | 4 | 5;
type CardMode = 'classic' | 'custom';
const BINGO_SIZES: BingoSize[] = [3, 4, 5];

const TIER_STYLES: Record<BingoWeight, { dot: string; label: string }> = {
  common: { dot: 'bg-sky-400', label: 'Common' },
  likely: { dot: 'bg-amber-400', label: 'Likely' },
  rare: { dot: 'bg-red-500', label: 'Rare' },
};

/** Tailwind grid classes — must be static strings, one per supported size. */
const GRID_COLS: Record<BingoSize, string> = {
  3: 'grid-cols-3',
  4: 'grid-cols-4',
  5: 'grid-cols-5',
};

// Free square index for odd-sized grids is computed inline via freeIndex below.

/** Small thematic icon shown in each cell, derived from the label text. */
function eventIcon(label: string, isFree: boolean, isCustom: boolean) {
  if (isFree) return Flag;
  const l = label.toLowerCase();
  if (/radio|box|team|engineer|crofty/.test(l)) return Radio;
  if (/crash|dnf|penalt|red flag|incident|smoke|fire|lock/.test(l)) return AlertTriangle;
  if (/podium|win|trophy|points|driver of the day/.test(l)) return TrophyIcon;
  if (/overtake|drs|fastest|purple|fight|undercut|pit/.test(l)) return Zap;
  if (isCustom) return Sparkles;
  return Lightbulb;
}

const BingoPage = () => {
  const shouldReduceMotion = useReducedMotion();

  const { data: races = [] } = useQuery<Race[]>({
    queryKey: ['races', CURRENT_YEAR],
    queryFn: async () => {
      const res = await fetch(`${API_URL}/api/races/${CURRENT_YEAR}`);
      if (!res.ok) throw new Error(`Failed to fetch races: ${res.status}`);
      const data = await res.json();
      if (data?.error) throw new Error(data.error);
      return Array.isArray(data) ? data : [];
    },
  });

  // Default to the next race; the card still works offline with round 0, so a
  // failed calendar fetch degrades to a generic card rather than a blank page.
  const nextRace = useMemo(() => resolveNextRace(races), [races]);
  const [round, setRound] = useState<number | null>(null);
  const activeRound = Number(round ?? nextRace?.round ?? 0);

  const activeRace = useMemo(
    () => races.find((r) => Number(r.round) === Number(activeRound)) ?? null,
    [races, activeRound],
  );

  // Circuit lookup for badge (use name/location/country of the selected round)
  const circuitLookup = useMemo<CircuitLookup | null>(() => {
    if (!activeRace) return null;
    return {
      round: activeRace.round,
      name: activeRace.name,
      location: activeRace.location,
      country: activeRace.country,
    };
  }, [activeRace]);

  const [mode, setMode] = useState<CardMode>('classic');
  const [variant, setVariant] = useState(0);
  const [marked, setMarked] = useState<Set<number>>(new Set());
  const [copied, setCopied] = useState(false);
  const [size, setSize] = useState<BingoSize>(5);
  const [customCard, setCustomCard] = useState<(BingoCardCell | null)[]>(() => emptyCustomCard(5));
  const [showBuilder, setShowBuilder] = useState(false);
  const [cellInput, setCellInput] = useState('');
  const [cellWeight, setCellWeight] = useState<BingoWeight>('common');
  const [activeCell, setActiveCell] = useState<number | null>(null);
  const cellInputRef = useRef<HTMLInputElement>(null);

  // Restore the stored card + marks whenever the selected race/size/mode changes.
  useEffect(() => {
    if (mode === 'custom') {
      setCustomCard(loadCustomCard(CURRENT_YEAR, activeRound, size));
      setMarked(loadMarks(`custom-${CURRENT_YEAR}`, activeRound, 0, size));
      setVariant(0);
    } else {
      const storedVariant = loadVariant(CURRENT_YEAR, activeRound, size);
      setVariant(storedVariant);
      setMarked(loadMarks(CURRENT_YEAR, activeRound, storedVariant, size));
    }
  }, [activeRound, size, mode]);

  const totalCells = size * size;
  const hasFreeCell = size % 2 === 1;
  const freeIndex = hasFreeCell ? Math.floor(totalCells / 2) : -1;

  const card = useMemo<(BingoEvent | null)[]>(() => {
    if (mode === 'custom') return customCard;
    return generateCard(CURRENT_YEAR, activeRound, variant, size);
  }, [mode, customCard, activeRound, variant, size]);

  const filledCount = card.filter((c) => c !== null).length;
  const progress = useMemo(() => evaluateCard(marked, size), [marked, size]);
  const hasBingo = progress.lines.length > 0;

  const marksKey = mode === 'custom' ? `custom-${CURRENT_YEAR}` : CURRENT_YEAR;

  const toggleCell = useCallback(
    (index: number) => {
      if (mode === 'custom' && card[index] === null) {
        // Empty square in a custom card opens the builder instead of marking.
        setActiveCell(index);
        setCellInput('');
        setShowBuilder(true);
        cellInputRef.current?.focus();
        return;
      }
      setMarked((prev) => {
        const next = new Set(prev);
        if (next.has(index)) next.delete(index);
        else next.add(index);
        saveMarks(marksKey, activeRound, next, variant, size);
        return next;
      });
    },
    [activeRound, variant, size, mode, card, marksKey],
  );

  const dealNewCard = useCallback(() => {
    if (mode === 'custom') {
      // Wipe the hand-built card back to empty squares.
      const blank = emptyCustomCard(size);
      setCustomCard(blank);
      saveCustomCard(CURRENT_YEAR, activeRound, blank, size);
      setMarked(new Set());
      saveMarks(marksKey, activeRound, new Set(), 0, size);
      return;
    }
    const nextVariant = variant + 1;
    setVariant(nextVariant);
    setMarked(new Set());
    saveVariant(CURRENT_YEAR, activeRound, nextVariant, size);
    saveMarks(CURRENT_YEAR, activeRound, new Set(), nextVariant, size);
  }, [activeRound, variant, size, mode, marksKey]);

  const clearMarks = useCallback(() => {
    setMarked(new Set());
    saveMarks(marksKey, activeRound, new Set(), variant, size);
  }, [activeRound, variant, size, marksKey]);

  const setCell = useCallback(
    (index: number, label: string, weight: BingoWeight) => {
      const trimmed = label.trim();
      const next = [...customCard];
      if (!trimmed) {
        next[index] = null;
      } else {
        next[index] = {
          id: index === freeIndex ? 'free-lights-out' : `custom-${index}-${trimmed.slice(0, 12)}`,
          label: trimmed,
          weight,
        };
      }
      setCustomCard(next);
      saveCustomCard(CURRENT_YEAR, activeRound, next, size);
    },
    [customCard, activeRound, size, freeIndex],
  );

  const clearCell = useCallback(
    (index: number) => {
      const next = [...customCard];
      next[index] = null;
      setCustomCard(next);
      saveCustomCard(CURRENT_YEAR, activeRound, next, size);
    },
    [customCard, activeRound, size],
  );

  const commitActiveCell = useCallback(() => {
    if (activeCell === null) return;
    setCell(activeCell, cellInput, cellWeight);
    setCellInput('');
    setActiveCell(null);
  }, [activeCell, cellInput, cellWeight, setCell]);

  const handleSetSize = useCallback(
    (next: BingoSize) => {
      if (next === size) return;
      setSize(next);
      setVariant(0);
      setMarked(new Set());
      if (mode === 'custom') {
        const blank = emptyCustomCard(next);
        setCustomCard(blank);
        saveCustomCard(CURRENT_YEAR, activeRound, blank, next);
        saveMarks(marksKey, activeRound, new Set(), 0, next);
      } else {
        saveVariant(CURRENT_YEAR, activeRound, 0, next);
        saveMarks(CURRENT_YEAR, activeRound, new Set(), 0, next);
      }
    },
    [activeRound, size, mode, marksKey],
  );

  const handleSetMode = useCallback(
    (next: CardMode) => {
      if (next === mode) return;
      setMode(next);
      setMarked(new Set());
      setShowBuilder(false);
    },
    [mode],
  );

  const shareCard = useCallback(async () => {
    const title = activeRace?.name ?? `Round ${activeRound}`;
    const lines = [
      `🏁 Race-Day Bingo — ${title}`,
      `${progress.marked}/${totalCells} squares · ${progress.lines.length} line${progress.lines.length === 1 ? '' : 's'}`,
      '',
      ...Array.from({ length: size }, (_, r) =>
        Array.from({ length: size }, (_, c) =>
          marked.has(r * size + c) ? '🟥' : '⬛',
        ).join(''),
      ),
    ].join('\n');

    try {
      await navigator.clipboard.writeText(lines);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      // Clipboard can be blocked by permissions; silently keep the card usable.
    }
  }, [activeRace, activeRound, marked, progress, size, totalCells]);

  const completion = Math.round((progress.marked / totalCells) * 100);
  const builderFor = activeCell !== null ? activeCell : null;

  return (
    <div className="relative min-h-screen">
      <div className="fixed inset-0 bg-linear-to-b from-red-900/10 via-neutral-950/80 to-neutral-950 pointer-events-none" />

      <div className="relative max-w-6xl mx-auto px-4 sm:px-6 py-10">
        {/* --- Header ---------------------------------------------------- */}
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-8">
          <div>
            <div className="inline-flex items-center gap-2 bg-red-600/10 border border-red-500/20 text-red-500 text-xs font-bold uppercase tracking-wider px-3 py-1 rounded-full mb-3">
              <Grid3X3 size={14} /> Watch Party
            </div>
            <h1 className="text-3xl md:text-5xl font-black tracking-tight text-white uppercase italic">
              Race-Day <span className="text-red-500">Bingo</span>
            </h1>
            <p className="text-neutral-400 mt-2 text-sm max-w-xl">
              {mode === 'classic'
                ? 'Mark a square the moment it happens on the broadcast. Five in a row — any direction — is a bingo. Your card and marks are saved per race.'
                : 'Build your own card from scratch: type a prediction into each empty square, then mark them live during the race.'}
            </p>
          </div>

          {/* Race picker */}
          <div className="shrink-0">
            <label
              htmlFor="bingo-race"
              className="block text-[11px] font-black text-neutral-500 uppercase tracking-[0.18em] mb-2"
            >
              Card for
            </label>
            <div className="relative">
              <select
                id="bingo-race"
                value={activeRound}
                onChange={(e) => setRound(Number(e.target.value))}
                className="appearance-none w-full lg:w-72 bg-neutral-900/80 border border-neutral-800 hover:border-neutral-700 rounded-lg pl-4 pr-10 py-2.5 text-sm font-bold text-white cursor-pointer transition-colors focus:outline-none focus:border-red-500/60"
              >
                {races.length === 0 && <option value={0}>Generic card</option>}
                {races.map((r) => (
                  <option key={r.round} value={r.round}>
                    R{String(r.round).padStart(2, '0')} · {r.name}
                  </option>
                ))}
              </select>
              <ChevronDown
                size={16}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-500 pointer-events-none"
              />
            </div>
            {activeRace && (
              <Link
                to={`/race/${CURRENT_YEAR}/${activeRace.round}`}
                className="inline-flex items-center gap-1.5 mt-2 text-[11px] font-bold text-neutral-500 hover:text-red-400 transition-colors"
              >
                <Flag size={11} /> Open race details
              </Link>
            )}
            {/* Grid size picker */}
            <div className="mt-3">
              <span className="block text-[11px] font-black text-neutral-500 uppercase tracking-[0.18em] mb-2">
                Grid
              </span>
              <div className="inline-flex rounded-lg border border-neutral-800 bg-neutral-900/80 p-0.5" role="group" aria-label="Bingo grid size">
                {BINGO_SIZES.map((s) => (
                  <button
                    key={s}
                    type="button"
                    onClick={() => handleSetSize(s)}
                    aria-pressed={s === size}
                    className={`px-3 py-1.5 rounded-md text-xs font-bold transition-colors cursor-pointer ${
                      s === size
                        ? 'bg-red-600/20 text-red-300 border border-red-500/40'
                        : 'text-neutral-500 hover:text-white border border-transparent'
                    }`}
                  >
                    {s}×{s}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* --- Mode switch ----------------------------------------------- */}
        <div className="inline-flex rounded-xl border border-neutral-800 bg-neutral-900/60 p-1 mb-6" role="group" aria-label="Card mode">
          <button
            type="button"
            onClick={() => handleSetMode('classic')}
            aria-pressed={mode === 'classic'}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
              mode === 'classic'
                ? 'bg-red-600/20 text-red-300 border border-red-500/40'
                : 'text-neutral-500 hover:text-white border border-transparent'
            }`}
          >
            <Dices size={14} /> Classic card
          </button>
          <button
            type="button"
            onClick={() => handleSetMode('custom')}
            aria-pressed={mode === 'custom'}
            className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-black uppercase tracking-wider transition-colors cursor-pointer ${
              mode === 'custom'
                ? 'bg-violet-600/20 text-violet-300 border border-violet-500/40'
                : 'text-neutral-500 hover:text-white border border-transparent'
            }`}
          >
            <PenLine size={14} /> Build my own
          </button>
        </div>

        {/* --- Status bar ------------------------------------------------ */}
        <div className="flex flex-wrap items-center gap-3 mb-6">
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center justify-between text-[11px] font-bold uppercase tracking-wider mb-1.5">
              <span className="text-neutral-500">Progress</span>
              <span className="text-neutral-300 font-mono">
                {progress.marked}/{totalCells}
                {hasFreeCell && <span className="text-neutral-600"> · free centre</span>}
              </span>
            </div>
            <div className="h-1.5 rounded-full bg-neutral-900 overflow-hidden">
              <motion.div
                className="h-full rounded-full bg-linear-to-r from-red-600 to-orange-500"
                initial={false}
                animate={{ width: `${completion}%` }}
                transition={shouldReduceMotion ? { duration: 0 } : { type: 'spring', stiffness: 120, damping: 20 }}
              />
            </div>
          </div>

          {mode === 'custom' && (
            <button
              type="button"
              onClick={() => {
                setShowBuilder(!showBuilder);
                setActiveCell(null);
                cellInputRef.current?.focus();
              }}
              className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer ${
                showBuilder
                  ? 'bg-violet-600/15 border-violet-500/40 text-violet-300'
                  : 'bg-neutral-900/80 border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700'
              }`}
            >
              <ListPlus size={14} /> Fill squares
              <span className="font-mono text-violet-400">{filledCount}/{totalCells}</span>
            </button>
          )}
          <button
            type="button"
            onClick={shareCard}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-neutral-900/80 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors cursor-pointer"
          >
            {copied ? <Check size={14} className="text-emerald-400" /> : <Share2 size={14} />}
            {copied ? 'Copied' : 'Share'}
          </button>
          <button
            type="button"
            onClick={clearMarks}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-neutral-900/80 border border-neutral-800 text-neutral-300 hover:text-white hover:border-neutral-700 transition-colors cursor-pointer"
          >
            <Eraser size={14} /> Clear
          </button>
          <button
            type="button"
            onClick={dealNewCard}
            className="inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-bold bg-red-600/15 border border-red-500/40 text-red-300 hover:bg-red-600/25 transition-colors cursor-pointer"
          >
            {mode === 'custom' ? <Trash2 size={14} /> : <RefreshCw size={14} />}
            {mode === 'custom' ? 'Reset card' : 'New card'}
          </button>
        </div>

        {/* --- Builder (custom mode only) --------------------------------- */}
        {mode === 'custom' && showBuilder && (
          <div
            className="mb-6 rounded-2xl border border-violet-500/25 bg-violet-950/20 p-4 sm:p-5"
            data-testid="custom-bingo-panel"
          >
            <div className="flex items-center justify-between gap-4 mb-3">
              <div className="flex items-center gap-2">
                <PenLine size={16} className="text-violet-400" />
                <h2 className="text-sm font-black text-white uppercase tracking-wider">
                  {builderFor !== null ? `Square #${builderFor + 1}` : 'Write your squares'}
                </h2>
                <span className="text-[11px] font-mono text-violet-300/80">
                  {filledCount}/{totalCells} filled
                </span>
              </div>
              <button
                type="button"
                onClick={() => {
                  setShowBuilder(false);
                  setActiveCell(null);
                }}
                className="text-neutral-500 hover:text-white transition-colors cursor-pointer"
                aria-label="Close builder"
              >
                <X size={16} />
              </button>
            </div>
            <p className="text-xs text-neutral-400 mb-4">
              Nothing is randomized here — every square is yours. Type a prediction,
              pick how likely it is, and it lands exactly where you put it. Click any
              empty square on the card to jump straight to it.
            </p>

            <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
              <div className="relative flex-1">
                <input
                  ref={cellInputRef}
                  type="text"
                  value={cellInput}
                  onChange={(e) => setCellInput(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      commitActiveCell();
                    }
                  }}
                  placeholder={
                    builderFor !== null
                      ? `Prediction for square #${builderFor + 1}…`
                      : 'e.g. "Crofty says THIS IS MUST-SEE TV"'
                  }
                  className="w-full bg-neutral-950/70 border border-neutral-800 focus:border-violet-500/60 rounded-lg pl-3 pr-10 py-2.5 text-sm text-white placeholder-neutral-600 focus:outline-none"
                  aria-label="Custom bingo square text"
                />
                <Plus
                  size={16}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-neutral-600 pointer-events-none"
                />
              </div>
              <div className="flex gap-2">
                <select
                  value={cellWeight}
                  onChange={(e) => setCellWeight(e.target.value as BingoWeight)}
                  className="bg-neutral-950/70 border border-neutral-800 hover:border-neutral-700 rounded-lg px-3 py-2.5 text-xs font-bold text-neutral-300 cursor-pointer focus:outline-none focus:border-violet-500/60"
                  aria-label="Square likelihood"
                >
                  {(Object.keys(TIER_STYLES) as BingoWeight[]).map((t) => (
                    <option key={t} value={t} className="bg-neutral-900">
                      {TIER_STYLES[t].label}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={commitActiveCell}
                  className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-lg text-sm font-bold bg-violet-600 hover:bg-violet-500 text-white transition-colors cursor-pointer"
                >
                  <Check size={15} strokeWidth={3} />
                  {builderFor !== null ? 'Save square' : 'Next square'}
                </button>
              </div>
            </div>

            {/* Filled squares list with remove */}
            {filledCount > 0 && (
              <ul className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                {customCard.map((cell, index) =>
                  cell === null ? null : (
                    <li
                      key={cell.id + index}
                      className="flex items-center gap-3 rounded-lg bg-neutral-950/50 border border-neutral-800/80 px-3 py-2"
                    >
                      <span className="font-mono text-[10px] text-neutral-600 w-6 shrink-0">
                        #{index + 1}
                      </span>
                      <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${TIER_STYLES[cell.weight].dot}`} />
                      <span className="flex-1 text-xs text-neutral-200 leading-snug">{cell.label}</span>
                      <button
                        type="button"
                        onClick={() => {
                          setActiveCell(index);
                          setCellInput(cell.label);
                          cellInputRef.current?.focus();
                        }}
                        className="text-neutral-600 hover:text-violet-400 transition-colors cursor-pointer"
                        aria-label={`Edit square ${index + 1}`}
                      >
                        <PenLine size={14} />
                      </button>
                      <button
                        type="button"
                        onClick={() => clearCell(index)}
                        className="text-neutral-600 hover:text-red-400 transition-colors cursor-pointer"
                        aria-label={`Clear square ${index + 1}`}
                      >
                        <Trash2 size={14} />
                      </button>
                    </li>
                  ),
                )}
              </ul>
            )}
          </div>
        )}

        {/* --- Bingo banner ---------------------------------------------- */}
        {hasBingo && (
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/40 bg-red-600/10 px-4 py-3"
            data-testid="bingo-banner"
          >
            <Trophy size={18} className="text-red-400 shrink-0" />
            <p className="text-sm font-bold text-white">
              {progress.blackout
                ? 'Blackout! Every square marked.'
                : `BINGO · ${progress.lines.length} line${progress.lines.length === 1 ? '' : 's'} complete`}
            </p>
          </motion.div>
        )}

        {/* --- Card ------------------------------------------------------ */}
        <div
          className={`relative grid ${GRID_COLS[size]} gap-1.5 sm:gap-2.5 rounded-2xl sm:rounded-3xl border border-neutral-800/80 bg-neutral-900/40 backdrop-blur-md p-2.5 sm:p-4 shadow-[0_20px_60px_-20px_rgba(0,0,0,0.8)]`}
          role="grid"
          aria-label="Race-day bingo card"
          data-testid="bingo-card"
        >
          {/* Card top edge glow */}
          <span className="pointer-events-none absolute -top-px left-1/2 -translate-x-1/2 h-px w-2/3 bg-linear-to-r from-transparent via-red-500/60 to-transparent" />

          {card.map((event, index) => {
            const isMarked = marked.has(index);
            const isFree = index === freeIndex && event !== null && event.id === 'free-lights-out';
            const isCustom = event !== null && event.id.startsWith('custom-');
            const isEmpty = event === null;
            const inWinningLine = progress.highlighted.has(index);
            const weight: BingoWeight = isEmpty ? 'common' : event.weight;
            const tier = TIER_STYLES[weight];
            const Icon = isEmpty ? Plus : eventIcon(event.label, isFree, isCustom);
            const isEditing = builderFor === index;

            return (
              <button
                key={`${event?.id ?? 'empty'}-${index}`}
                type="button"
                role="gridcell"
                aria-pressed={isMarked}
                data-testid={`bingo-cell-${index}`}
                onClick={() => toggleCell(index)}
                className={`group relative aspect-square rounded-lg sm:rounded-xl border p-1.5 sm:p-3 flex flex-col justify-between text-left transition-all duration-200 cursor-pointer overflow-hidden ${
                  isEmpty
                    ? 'border-dashed border-neutral-800 bg-neutral-950/40 hover:border-violet-500/50 hover:bg-violet-950/20'
                    : inWinningLine
                      ? 'border-red-500/70 bg-red-600/20 shadow-[0_0_24px_rgba(225,6,0,0.3)]'
                      : isMarked
                        ? 'border-red-500/40 bg-red-600/10'
                        : isFree
                          ? 'border-neutral-700 bg-neutral-900/70'
                          : 'border-neutral-800 bg-linear-to-br from-neutral-900/80 to-neutral-950/80 hover:border-neutral-600 hover:from-neutral-900 hover:to-neutral-900/60'
                } ${isEditing ? 'ring-2 ring-violet-500/70' : ''}`}
              >
                {/* Circuit outline watermark */}
                {circuitLookup && !isEmpty && (
                  <span className="absolute inset-0 flex items-center justify-center pointer-events-none text-neutral-400">
                    <BingoCircuitBadge
                      circuitLookup={circuitLookup}
                      opacity={isMarked ? 0.35 : 0.16}
                    />
                  </span>
                )}

                {/* Tier / status row */}
                <span
                  className={`relative hidden sm:flex items-center gap-1.5 text-[9px] font-black uppercase tracking-wider ${
                    isMarked
                      ? 'text-red-300/80'
                      : isCustom
                        ? 'text-violet-300/90'
                        : isFree
                          ? 'text-neutral-400'
                          : isEmpty
                            ? 'text-neutral-700'
                            : 'text-neutral-600'
                  }`}
                >
                  {!isEmpty && !isFree && (
                    <span className={`w-1 h-1 rounded-full ${tier.dot}`} />
                  )}
                  {isEmpty ? 'Empty' : isFree ? 'Free' : isCustom ? 'You' : tier.label}
                </span>

                {/* Thematic icon */}
                <span
                  className={`relative self-end sm:self-start -mt-1 sm:mt-0 ${
                    isMarked ? 'text-red-400/70' : isEmpty ? 'text-neutral-700' : 'text-neutral-500 group-hover:text-neutral-300'
                  } transition-colors`}
                >
                  <Icon size={14} strokeWidth={2.4} />
                </span>

                <span
                  className={`relative text-[9px] leading-tight sm:text-xs sm:leading-snug font-bold ${
                    isMarked
                      ? 'text-white'
                      : isEmpty
                        ? 'text-neutral-700'
                        : 'text-neutral-200 group-hover:text-white'
                  }`}
                >
                  {isEmpty ? 'Tap to write…' : event.label}
                </span>

                {isMarked && (
                  <motion.span
                    initial={shouldReduceMotion ? false : { scale: 0.4, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 22 }}
                    className="absolute top-1 right-1 sm:top-2 sm:right-2 w-4 h-4 sm:w-5 sm:h-5 rounded-full bg-red-600 flex items-center justify-center"
                  >
                    <Check size={10} className="text-white" strokeWidth={3.5} />
                  </motion.span>
                )}
              </button>
            );
          })}
        </div>

        {/* --- Legend ---------------------------------------------------- */}
        <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 text-[11px] text-neutral-500 font-medium">
          {mode === 'classic' ? (
            <>
              {(Object.keys(TIER_STYLES) as BingoWeight[]).map((tier) => (
                <span key={tier} className="inline-flex items-center gap-1.5">
                  <span className={`w-1.5 h-1.5 rounded-full ${TIER_STYLES[tier].dot}`} />
                  {TIER_STYLES[tier].label}
                </span>
              ))}
              <span className="text-neutral-600">
                Cards are deterministic per race — the same round always deals the same
                squares, so everyone watching can play the same card.
              </span>
            </>
          ) : (
            <span className="text-neutral-600">
              Your own card — no randomness. Squares are saved on this device per race
              and grid size.
            </span>
          )}
        </div>
      </div>
    </div>
  );
};

export default BingoPage;
