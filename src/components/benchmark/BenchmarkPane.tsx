import { AlertTriangle, Hourglass, Loader2, Maximize2 } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { BenchmarkModel } from '@/hooks/useBenchmarkConfig';
import { BenchmarkViewer } from '@/components/benchmark/BenchmarkViewer';

export type BenchmarkStatus =
  | 'idle'
  | 'streaming'
  | 'compiling'
  | 'done'
  | 'error';

interface BenchmarkPaneProps {
  model: BenchmarkModel;
  status: BenchmarkStatus;
  code: string;
  durationMs: number | null;
  error?: string | null;
  onFullscreen?: () => void;
}

const STATUS_LABELS: Record<BenchmarkStatus, string> = {
  idle: 'idle',
  streaming: 'streaming',
  compiling: 'compiling',
  done: 'done',
  error: 'error',
};

const STATUS_DOT_COLOR: Record<BenchmarkStatus, string> = {
  idle: 'bg-adam-neutral-500',
  streaming: 'bg-adam-blue animate-pulse',
  compiling: 'bg-amber-400 animate-pulse',
  done: 'bg-emerald-500',
  error: 'bg-red-500',
};

export function BenchmarkPane({
  model,
  status,
  code,
  durationMs,
  error,
  onFullscreen,
}: BenchmarkPaneProps) {
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-adam-neutral-700 bg-adam-bg-secondary-dark">
      <header className="flex items-center justify-between gap-3 border-b border-adam-neutral-700 bg-adam-bg-secondary-dark/60 px-3 py-2">
        <div className="flex min-w-0 items-center gap-2">
          <span
            aria-hidden
            className={cn(
              'h-1.5 w-1.5 shrink-0 rounded-full',
              STATUS_DOT_COLOR[status],
            )}
          />
          <div className="flex min-w-0 flex-col">
            <span className="truncate text-xs font-semibold text-adam-text-primary">
              {model.name}
            </span>
            <span className="truncate text-[10px] uppercase tracking-wider text-adam-neutral-500">
              {model.vendor} · {STATUS_LABELS[status]}
              {durationMs !== null && status !== 'streaming' && (
                <span className="ml-1 text-adam-neutral-400">
                  · {formatDuration(durationMs)}
                </span>
              )}
            </span>
          </div>
        </div>
        {onFullscreen && (
          <button
            type="button"
            onClick={onFullscreen}
            aria-label={`Fullscreen ${model.name} preview`}
            className="rounded p-1 text-adam-neutral-400 opacity-0 transition-opacity hover:bg-adam-neutral-800 hover:text-adam-text-primary group-hover:opacity-100 focus:opacity-100"
          >
            <Maximize2 className="h-3.5 w-3.5" />
          </button>
        )}
      </header>
      <div className="relative flex-1 bg-adam-neutral-700/40">
        {code && status !== 'error' ? (
          <BenchmarkViewer code={code} />
        ) : (
          <PaneOverlay status={status} error={error} />
        )}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
}

function PaneOverlay({
  status,
  error,
}: {
  status: BenchmarkStatus;
  error?: string | null;
}) {
  if (status === 'error') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 px-4 text-center">
        <AlertTriangle className="h-5 w-5 text-red-400" />
        <span className="text-[11px] font-medium uppercase tracking-wider text-red-400">
          error
        </span>
        {error && (
          <p className="line-clamp-3 max-w-[260px] text-[11px] leading-relaxed text-adam-neutral-300">
            {error}
          </p>
        )}
      </div>
    );
  }
  if (status === 'streaming' || status === 'compiling') {
    return (
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <Loader2 className="h-5 w-5 animate-spin text-adam-blue" />
        <span className="text-[11px] uppercase tracking-wider text-adam-neutral-400">
          {status === 'streaming' ? 'awaiting model output' : 'compiling'}
        </span>
      </div>
    );
  }
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
      <Hourglass className="h-5 w-5 text-adam-neutral-500" />
      <span className="text-[11px] uppercase tracking-wider text-adam-neutral-500">
        {status === 'idle' ? 'idle' : 'queued'}
      </span>
    </div>
  );
}
