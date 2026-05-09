import { Plus } from 'lucide-react';
import { cn } from '@/lib/utils';

interface BenchmarkAddTileProps {
  selectedCount: number;
  maxSelected: number;
  onClick: () => void;
}

// In-grid card that opens the model browser to add another pane to the
// lineup. Shaped like a BenchmarkPane (same rounded container) so the
// grid stays uniform; centered dashed-border drop zone signals it's an
// empty slot rather than a model that crashed.
export function BenchmarkAddTile({
  selectedCount,
  maxSelected,
  onClick,
}: BenchmarkAddTileProps) {
  const atCap = selectedCount >= maxSelected;
  return (
    <button
      type="button"
      onClick={atCap ? undefined : onClick}
      disabled={atCap}
      aria-label={
        atCap ? 'Model lineup at capacity' : 'Add another model to the lineup'
      }
      className={cn(
        'group relative flex h-full w-full flex-col items-center justify-center gap-3',
        'rounded-lg border border-dashed border-adam-neutral-700 bg-adam-bg-secondary-dark/30',
        'transition-colors',
        atCap
          ? 'cursor-not-allowed opacity-60'
          : 'hover:border-adam-blue/60 hover:bg-adam-bg-secondary-dark/50',
      )}
    >
      <div
        className={cn(
          'flex h-10 w-10 items-center justify-center rounded-full border border-adam-neutral-700 bg-adam-neutral-900 text-adam-neutral-300',
          !atCap && 'group-hover:border-adam-blue/60 group-hover:text-adam-blue',
        )}
      >
        <Plus className="h-4 w-4" />
      </div>
      <div className="flex flex-col items-center gap-0.5">
        <span className="text-sm font-medium text-adam-text-primary">
          {atCap ? 'Lineup full' : 'Add model'}
        </span>
        <span className="text-[11px] text-adam-neutral-500">
          {selectedCount} / {maxSelected} models
        </span>
      </div>
    </button>
  );
}
