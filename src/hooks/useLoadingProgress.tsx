import { CreativeModel } from '@shared/types';
import { useEffect, useMemo, useState } from 'react';

// Timing configuration
export const TIMING_CONFIG = {
  image: {
    fast: { expected: 35000, min: 15000, max: 45000 }, // ~35s for textureless image
    quality: { expected: 120000, min: 60000, max: 150000 }, // ~2 min for standard image
    ultra: { expected: 150000, min: 90000, max: 200000 }, // ~2.5 min for ultra image (multiview)
  },
  mesh: {
    fast: { expected: 75000, min: 60000, max: 90000 }, // Total: 60-90s matches UI
    quality: { expected: 45000, min: 30000, max: 60000 }, // Total: ~45s for SAM 3D
    ultra: { expected: 270000, min: 240000, max: 300000 }, // Total: 4-5 min matches UI
  },
};

type Stage = 1 | 2 | 3;

// Custom hook for loading progress
export function useLoadingProgress(
  modelType: 'image' | 'mesh',
  startTime?: number,
  model?: CreativeModel,
) {
  const [progress, setProgress] = useState(0);
  const [stage, setStage] = useState<Stage>(1);

  const actualStartTime = useMemo(() => startTime || Date.now(), [startTime]);

  const modelName = model || 'quality';

  const timing = TIMING_CONFIG[modelType][modelName];

  useEffect(() => {
    const updateProgress = () => {
      const { progress, stage } = getProgress(
        actualStartTime,
        timing.expected,
        Date.now(),
      );

      setStage(stage);
      setProgress(progress); // Removed Math.min(90, progress) since getProgress now handles capping
    };

    updateProgress(); // Initial update
    const interval = setInterval(updateProgress, 150);
    return () => clearInterval(interval);
  }, [actualStartTime, timing]);

  return {
    progress,
    stage,
    timing,
    remainingTime: actualStartTime + timing.max - Date.now(),
  };
}

export function getProgress(
  actualStartTime: number,
  expectedTime: number,
  currentTime: number,
) {
  const elapsedTime = currentTime - actualStartTime;

  let currentStage: Stage = 1;

  if (elapsedTime < expectedTime * 0.15) {
    currentStage = 1;
  } else if (elapsedTime < expectedTime * 0.575) {
    currentStage = 2;
  } else {
    currentStage = 3;
  }

  // Adaptive progress calculation
  // If generation is taking longer than expected, slow down progress to avoid completing at 100%
  let progress: number;

  if (elapsedTime <= expectedTime) {
    // Normal case: use linear progression
    progress = (elapsedTime / expectedTime) * 100;
  } else {
    // Fallback case: slow down exponentially to avoid hitting 100%
    const overtime = elapsedTime - expectedTime;
    const overtimeRatio = overtime / expectedTime;

    // Use logarithmic function to slow down progress when over time
    // This keeps it under 95% even if generation takes much longer
    progress = 85 + (10 * Math.log(1 + overtimeRatio)) / Math.log(6);
  }

  return {
    progress: Math.min(95, progress), // Cap at 95% to never show "complete" while pending
    stage: currentStage,
  };
}
