import React from 'react';

type TrackTone = 'red' | 'cyan' | 'amber';

interface Track3DProps {
  children: React.ReactNode;
  className?: string;
  /** Glow colour used by the floor reflection and the artwork halo. */
  tone?: TrackTone;
  /** Backwards tilt in degrees. Lower values keep telemetry labels readable. */
  tilt?: number;
  /** When false the map does not react to hover (used by interactive maps). */
  interactive?: boolean;
}

const TONE_GLOW: Record<TrackTone, string> = {
  red: 'rgba(230, 57, 70, 0.45)',
  cyan: 'rgba(56, 189, 248, 0.4)',
  amber: 'rgba(251, 191, 36, 0.42)',
};

/**
 * Track3D gives every circuit map the same "wind-tunnel" presentation without
 * WebGL: a small perspective tilt, layered CSS drop-shadows that read as an
 * extruded kerb, a glowing floor reflection and a scanline sheen. The artwork
 * itself is never duplicated, so SVG ids and internal refs stay unique.
 */
export function Track3D({
  children,
  className = '',
  tone = 'red',
  tilt = 14,
  interactive = true,
}: Track3DProps) {
  const style = {
    '--track3d-glow': TONE_GLOW[tone],
    '--track3d-tilt': `${tilt}deg`,
  } as React.CSSProperties;

  return (
    <div
      className={`track3d ${interactive ? 'track3d--interactive' : ''} ${className}`.trim()}
      style={style}
    >
      <span className="track3d__halo" aria-hidden="true" />
      <span className="track3d__floor" aria-hidden="true" />
      <div className="track3d__pivot">
        <div className="track3d__art">{children}</div>
      </div>
      <span className="track3d__scan" aria-hidden="true" />
    </div>
  );
}

export default Track3D;
