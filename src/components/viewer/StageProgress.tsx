export function StageProgress({
  stage,
  currentStage,
  progress,
  modelType,
  title,
}: {
  stage: number;
  currentStage: number;
  progress: number;
  modelType: 'image' | 'mesh';
  title: string;
}) {
  function getStageProgress(
    stage: number,
    currentStage: number,
    progress: number,
    modelType: 'image' | 'mesh',
  ) {
    if (stage === 1) {
      if (currentStage === 1) {
        return progress * 6.66;
      }
      return 100;
    }
    if (stage === 2) {
      if (currentStage === 2) {
        if (modelType === 'mesh') {
          return (progress - 15) * 2.35;
        }
        return (progress - 15) * 1.18;
      }
      return currentStage > 2 ? 100 : 0;
    }
    if (stage === 3) {
      if (currentStage === 3) {
        return (progress - 57.5) * 2.35;
      }
      return 0;
    }
    return 0;
  }
  return (
    <>
      <div className="h-4 text-xs text-white/60">{title}</div>
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-adam-neutral-500">
        <div
          className="h-full rounded-full bg-adam-neutral-100 transition-all duration-300 ease-out"
          style={{
            width: `${getStageProgress(stage, currentStage, progress, modelType)}%`,
          }}
        />
      </div>
    </>
  );
}
