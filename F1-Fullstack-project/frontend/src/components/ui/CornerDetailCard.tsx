import React, { useEffect, useCallback } from 'react';
import { X, Sparkles, Gauge, ChevronLeft, ChevronRight, Zap } from 'lucide-react';
import type { CornerDetail } from '../../data/cornerDetails';

export interface CornerDetailCardProps {
  detail: CornerDetail;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  circuitName?: string;
  className?: string;
  /** Render the "Lore & History" fun fact callout. Defaults to true. */
  showFunFact?: boolean;
}

const SPEED_STYLES: Record<CornerDetail['speedCategory'], { badge: string; dot: string }> = {
  'Flat Out': {
    badge: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30',
    dot: 'bg-emerald-400',
  },
  'High Speed': {
    badge: 'bg-cyan-500/15 text-cyan-400 border-cyan-500/30',
    dot: 'bg-cyan-400',
  },
  Medium: {
    badge: 'bg-amber-500/15 text-amber-400 border-amber-500/30',
    dot: 'bg-amber-400',
  },
  Slow: {
    badge: 'bg-rose-500/15 text-rose-400 border-rose-500/30',
    dot: 'bg-rose-400',
  },
};

/**
 * Floating spotlight card displaying technical specs, iconic lore, and historical anecdotes
 * for an F1 circuit corner on click.
 */
export const CornerDetailCard: React.FC<CornerDetailCardProps> = ({
  detail,
  onClose,
  onPrev,
  onNext,
  circuitName,
  className = '',
  showFunFact = true,
}) => {
  const speedStyle = SPEED_STYLES[detail.speedCategory] || SPEED_STYLES.Medium;

  const handleKeyDown = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowLeft' && onPrev) {
        onPrev();
      } else if (e.key === 'ArrowRight' && onNext) {
        onNext();
      }
    },
    [onClose, onPrev, onNext],
  );

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handleKeyDown]);

  return (
    <div
      data-testid="corner-detail-card"
      role="region"
      aria-label={`Corner details for Turn ${detail.number}${detail.letter ?? ''}`}
      className={`bg-neutral-950/95 backdrop-blur-xl border border-neutral-800 rounded-xl p-3.5 sm:p-4 shadow-2xl transition-all duration-200 max-h-[88vh] overflow-y-auto ${className}`}
      style={{
        boxShadow: detail.isIconic
          ? '0 10px 30px -10px rgba(245, 158, 11, 0.2), 0 0 1px 1px rgba(245, 158, 11, 0.3)'
          : '0 10px 30px -10px rgba(0, 0, 0, 0.8), 0 0 1px 1px rgba(255, 255, 255, 0.1)',
      }}
    >
      {/* Top Header */}
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex flex-wrap items-center gap-2">
          {/* Turn Identifier Pill */}
          <span className="inline-flex items-center justify-center px-2 py-0.5 rounded-md font-mono font-black text-xs bg-red-600/20 text-red-400 border border-red-500/40">
            T{detail.number}
            {detail.letter}
          </span>

          {/* Iconic Badge if applicable */}
          {detail.isIconic && (
            <span
              data-testid="iconic-badge"
              className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-amber-500/15 text-amber-300 border border-amber-500/40 shadow-xs"
            >
              <Sparkles size={11} className="text-amber-400" />
              Iconic Corner
            </span>
          )}

          {circuitName && (
            <span className="text-[11px] text-neutral-400 font-medium hidden sm:inline">
              · {circuitName}
            </span>
          )}
        </div>

        {/* Close Button */}
        <button
          type="button"
          data-testid="corner-detail-close"
          onClick={onClose}
          aria-label="Close corner details"
          className="p-1 rounded-full text-neutral-400 hover:text-white hover:bg-neutral-800/80 transition-colors cursor-pointer shrink-0"
        >
          <X size={16} />
        </button>
      </div>

      {/* Corner Official / Iconic Name */}
      <h3
        data-testid="corner-detail-name"
        className="text-base sm:text-lg font-black text-white tracking-tight leading-snug mb-2"
      >
        {detail.name}
      </h3>

      {/* Technical Spec Tags */}
      <div className="flex flex-wrap items-center gap-2 mb-3">
        {/* Speed Category */}
        <span
          className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-bold border ${speedStyle.badge}`}
        >
          <span className={`w-1.5 h-1.5 rounded-full ${speedStyle.dot}`} />
          {detail.speedCategory}
        </span>

        {/* Corner Type */}
        <span className="px-2 py-0.5 rounded-full text-[11px] font-medium bg-neutral-900 text-neutral-300 border border-neutral-800">
          {detail.type}
        </span>

        {/* Apex Speed */}
        {detail.speedKmh && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-neutral-900 text-cyan-300 border border-neutral-800">
            <Gauge size={11} className="text-cyan-400" />
            {detail.speedKmh}
          </span>
        )}

        {/* Gear */}
        {detail.gear && (
          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-bold bg-neutral-900 text-amber-300 border border-neutral-800">
            <Zap size={11} className="text-amber-400" />
            Gear {detail.gear}
          </span>
        )}
      </div>

      {/* Description / Lore */}
      <p
        data-testid="corner-detail-desc"
        className="text-xs sm:text-sm text-neutral-300 leading-relaxed font-sans mb-3"
      >
        {detail.description}
      </p>

      {/* Fun Fact / Historical Lore Callout */}
      {showFunFact && detail.funFact && (
        <div
          data-testid="corner-detail-funfact"
          className="p-2.5 rounded-lg bg-amber-950/20 border border-amber-800/30 text-xs text-amber-200/90 flex items-start gap-2 mb-3"
        >
          <Sparkles size={13} className="text-amber-400 shrink-0 mt-0.5" />
          <div className="leading-snug">
            <strong className="text-amber-300 font-semibold block mb-0.5">Lore & History</strong>
            {detail.funFact}
          </div>
        </div>
      )}

      {/* Bottom Navigation */}
      {(onPrev || onNext) && (
        <div className="flex items-center justify-between pt-2 border-t border-neutral-800/60 text-xs">
          {onPrev ? (
            <button
              type="button"
              data-testid="corner-prev-btn"
              onClick={onPrev}
              className="inline-flex items-center gap-1 font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer py-1 px-1.5 rounded hover:bg-neutral-800/50"
            >
              <ChevronLeft size={14} />
              <span>Prev Corner</span>
            </button>
          ) : (
            <div />
          )}

          <span className="text-[10px] font-mono font-medium text-neutral-400 uppercase tracking-wider">
            Turn {detail.number}
            {detail.letter}
          </span>

          {onNext ? (
            <button
              type="button"
              data-testid="corner-next-btn"
              onClick={onNext}
              className="inline-flex items-center gap-1 font-semibold text-neutral-400 hover:text-white transition-colors cursor-pointer py-1 px-1.5 rounded hover:bg-neutral-800/50"
            >
              <span>Next Corner</span>
              <ChevronRight size={14} />
            </button>
          ) : (
            <div />
          )}
        </div>
      )}
    </div>
  );
};

export default CornerDetailCard;
