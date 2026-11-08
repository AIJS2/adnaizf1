import React from 'react';

/**
 * F1AmbientBackground provides a subtle, atmospheric "Pit Wall Command Center"
 * aesthetic across the entire application:
 * 1. Layer 1: Deep Tarmac base (#08090b)
 * 2. Layer 2: CAD Telemetry 24px dot matrix grid
 * 3. Layer 3: Two slow-drifting F1 Red & Track Cyan ambient glowing orbs
 *
 * 100% GPU-composited via CSS translate3d, 0% main-thread JS / CPU overhead.
 */
export const F1AmbientBackground: React.FC = () => {
  return (
    <div
      className="fixed inset-0 pointer-events-none overflow-hidden z-0"
      aria-hidden="true"
    >
      {/* Pit Wall Red Ambient Glow (left-side, sits behind & bleeds through sidebar) */}
      <div
        className="ambient-glow-red absolute -top-20 -left-28 w-[580px] h-[580px] rounded-full blur-[110px]"
        style={{
          background: 'radial-gradient(circle, rgba(225, 6, 0, 0.15) 0%, rgba(225, 6, 0, 0.03) 55%, transparent 75%)',
        }}
      />

      {/* F1 Racing Red Ambient Orb (top-right) */}
      <div
        className="ambient-glow-red absolute -top-32 -right-20 w-[560px] h-[560px] rounded-full blur-[90px]"
        style={{
          background: 'radial-gradient(circle, rgba(225, 6, 0, 0.16) 0%, rgba(225, 6, 0, 0.03) 50%, transparent 70%)',
        }}
      />

      {/* Cold Track Cyan Ambient Orb (bottom-left) */}
      <div
        className="ambient-glow-cyan absolute -bottom-40 left-[10%] w-[580px] h-[580px] rounded-full blur-[100px]"
        style={{
          background: 'radial-gradient(circle, rgba(14, 165, 233, 0.10) 0%, rgba(14, 165, 233, 0.02) 50%, transparent 70%)',
        }}
      />

      {/* Technical CAD Telemetry Dot Grid */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'radial-gradient(rgba(255, 255, 255, 0.065) 1px, transparent 1px)',
          backgroundSize: '24px 24px',
          maskImage: 'radial-gradient(ellipse 90% 70% at 50% 40%, black 40%, transparent 100%)',
          WebkitMaskImage: 'radial-gradient(ellipse 90% 70% at 50% 40%, black 40%, transparent 100%)',
        }}
      />
    </div>
  );
};

export default F1AmbientBackground;
