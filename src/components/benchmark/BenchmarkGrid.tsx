import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';

interface BenchmarkGridProps {
  count: number;
  children: ReactNode;
}

// Layout breakpoints picked to keep each pane large enough to read while
// degrading gracefully past four. Above six panes the grid stays at 2 cols
// and the page scrolls.
//
//   1 → 1×1   (full)
//   2 → 2×1   (side-by-side, the default)
//   3 → 3×1
//   4 → 2×2
//   5–6 → 2×3
//   7+ → 2 columns, scrollable
function gridClassFor(n: number): string {
  if (n <= 1) return 'grid-cols-1';
  if (n === 2) return 'grid-cols-1 md:grid-cols-2';
  if (n === 3) return 'grid-cols-1 md:grid-cols-3';
  if (n === 4) return 'grid-cols-1 md:grid-cols-2';
  return 'grid-cols-1 md:grid-cols-2';
}

export function BenchmarkGrid({ count, children }: BenchmarkGridProps) {
  return (
    <div
      className={cn(
        'grid h-full min-h-[420px] w-full gap-3 p-3',
        gridClassFor(count),
      )}
    >
      {children}
    </div>
  );
}
