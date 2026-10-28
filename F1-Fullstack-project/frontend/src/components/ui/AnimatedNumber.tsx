import React, { useEffect, useState } from 'react';
import { useReducedMotion } from 'framer-motion';

export interface AnimatedNumberProps {
  value: number;
  duration?: number; // duration in ms, default 500
  decimals?: number;
  prefix?: string;
  suffix?: string;
  className?: string;
}

/**
 * AnimatedNumber: Smoothly rolls numbers up or down with a motorsport
 * ease-out cubic curve. Respects prefers-reduced-motion and test environments.
 */
export const AnimatedNumber: React.FC<AnimatedNumberProps> = ({
  value,
  duration = 500,
  decimals = 0,
  prefix = '',
  suffix = '',
  className = '',
}) => {
  const shouldReduceMotion = useReducedMotion();
  const [displayValue, setDisplayValue] = useState<number>(value);

  useEffect(() => {
    if (shouldReduceMotion || typeof window === 'undefined') {
      setDisplayValue(value);
      return;
    }

    // In test environment, update synchronously for deterministic assertions
    if (typeof import.meta !== 'undefined' && import.meta.env?.MODE === 'test') {
      setDisplayValue(value);
      return;
    }

    let startTimestamp: number | null = null;
    const startValue = displayValue;
    const diff = value - startValue;

    if (diff === 0) return;

    let frameId: number;

    const step = (timestamp: number) => {
      if (!startTimestamp) startTimestamp = timestamp;
      const elapsed = timestamp - startTimestamp;
      const progress = Math.min(elapsed / duration, 1);
      // Ease out cubic
      const easeOut = 1 - Math.pow(1 - progress, 3);
      const current = startValue + diff * easeOut;

      setDisplayValue(current);

      if (progress < 1) {
        frameId = window.requestAnimationFrame(step);
      } else {
        setDisplayValue(value);
      }
    };

    frameId = window.requestAnimationFrame(step);

    return () => {
      window.cancelAnimationFrame(frameId);
    };
  }, [value, duration, shouldReduceMotion]);

  const formatted = `${prefix}${displayValue.toFixed(decimals)}${suffix}`;

  return <span className={className}>{formatted}</span>;
};

export default AnimatedNumber;
