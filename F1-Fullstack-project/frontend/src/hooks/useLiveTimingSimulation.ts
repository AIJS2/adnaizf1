import { useState, useEffect, useRef, useCallback } from 'react';
import type { LiveTimingCircuit, LiveTimingData } from '../types/f1';
import {
  createInitialSimulation,
  tickSimulation,
} from '../utils/liveTimingSimulation';

export interface UseLiveTimingSimulationOptions {
  enabled: boolean;
  circuit?: LiveTimingCircuit | null;
}

export interface UseLiveTimingSimulationResult {
  simulationData: LiveTimingData;
  isRunning: boolean;
  isSafetyCar: boolean;
  isRain: boolean;
  speed: 1 | 2 | 4;
  togglePlayPause: () => void;
  toggleSafetyCar: () => void;
  toggleRain: () => void;
  setSpeed: (speed: 1 | 2 | 4) => void;
  reset: () => void;
}

export function useLiveTimingSimulation({
  enabled,
  circuit,
}: UseLiveTimingSimulationOptions): UseLiveTimingSimulationResult {
  const [simulationData, setSimulationData] = useState<LiveTimingData>(() =>
    createInitialSimulation({ circuit })
  );
  const [isRunning, setIsRunning] = useState<boolean>(true);
  const [isSafetyCar, setIsSafetyCar] = useState<boolean>(false);
  const [isRain, setIsRain] = useState<boolean>(false);
  const [speed, setSpeed] = useState<1 | 2 | 4>(1);

  // Sync circuit if it becomes available or changes
  useEffect(() => {
    if (circuit) {
      setSimulationData((prev) => ({
        ...prev,
        circuit: circuit ?? prev.circuit,
      }));
    }
  }, [circuit]);

  // Keep references to active flags for the interval loop
  const flagsRef = useRef({ isRunning, isSafetyCar, isRain, speed });
  useEffect(() => {
    flagsRef.current = { isRunning, isSafetyCar, isRain, speed };
  }, [isRunning, isSafetyCar, isRain, speed]);

  useEffect(() => {
    if (!enabled || !isRunning) return;

    const TICK_INTERVAL_MS = 150;
    const deltaSeconds = TICK_INTERVAL_MS / 1000;

    const timer = setInterval(() => {
      const { isSafetyCar: sc, isRain: rn, speed: spd, isRunning: run } = flagsRef.current;
      if (!run) return;

      setSimulationData((prev) =>
        tickSimulation(prev, deltaSeconds, {
          safetyCar: sc,
          rain: rn,
          speedMultiplier: spd,
        })
      );
    }, TICK_INTERVAL_MS);

    return () => clearInterval(timer);
  }, [enabled, isRunning]);

  const togglePlayPause = useCallback(() => {
    setIsRunning((prev) => !prev);
  }, []);

  const toggleSafetyCar = useCallback(() => {
    setIsSafetyCar((prev) => !prev);
  }, []);

  const toggleRain = useCallback(() => {
    setIsRain((prev) => !prev);
  }, []);

  const reset = useCallback(() => {
    setSimulationData(createInitialSimulation({ circuit }));
    setIsSafetyCar(false);
    setIsRain(false);
    setIsRunning(true);
  }, [circuit]);

  return {
    simulationData,
    isRunning,
    isSafetyCar,
    isRain,
    speed,
    togglePlayPause,
    toggleSafetyCar,
    toggleRain,
    setSpeed,
    reset,
  };
}
