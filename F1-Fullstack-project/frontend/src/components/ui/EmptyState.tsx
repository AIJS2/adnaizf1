import React from 'react';
import { LucideIcon } from 'lucide-react';

// ============================================================================
// Shared empty / unavailable states
//
// With mock data gone, every endpoint can legitimately return an empty
// payload: a pre-season, a race that has not run yet, or a session whose
// telemetry has not been mirrored yet. These components give each of those
// cases one consistent, premium-looking presentation instead of a bare table
// header or a blank chart frame.
// ============================================================================

interface EmptyStateProps {
  icon?: LucideIcon;
  title: string;
  description?: string;
  className?: string;
  /** Compact renders a single line, for inline table cells. */
  compact?: boolean;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  icon: Icon,
  title,
  description,
  className = '',
  compact = false,
}) => {
  if (compact) {
    return (
      <div
        className={`flex items-center gap-3 px-4 py-3 text-sm text-neutral-500 italic ${className}`}
        role="status"
      >
        {Icon && <Icon className="w-4 h-4 flex-shrink-0 text-neutral-600" aria-hidden="true" />}
        <span>{title}</span>
      </div>
    );
  }

  return (
    <div
      className={`flex flex-col items-center justify-center w-full px-6 py-14 text-center ${className}`}
      role="status"
    >
      {Icon && (
        <div className="mb-4 flex items-center justify-center w-14 h-14 rounded-2xl bg-neutral-900/80 border border-neutral-800">
          <Icon className="w-7 h-7 text-neutral-600" aria-hidden="true" />
        </div>
      )}
      <h3 className="text-base font-bold text-neutral-300">{title}</h3>
      {description && (
        <p className="mt-2 max-w-md text-sm text-neutral-500 leading-relaxed">{description}</p>
      )}
    </div>
  );
};

export default EmptyState;

/** The copy used when a table has no rows to show. */
export const EMPTY_TABLE_MESSAGES = {
  raceResults: {
    title: 'No results available for this session',
    description:
      'This session has not been classified yet, or its data has not been published. Check back after the session completes.',
  },
  telemetry: {
    title: 'No telemetry data available for this session',
    description:
      'Telemetry is published after a session finishes. If the session only recently ended, it may take a few minutes to appear.',
  },
  charts: {
    title: 'Not enough data to plot yet',
    description:
      'This chart needs lap-by-lap data, which becomes available once the session has run.',
  },
} as const;
