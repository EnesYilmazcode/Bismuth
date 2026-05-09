import {
  AlertTriangle,
  ChevronDown,
  Hourglass,
  Loader2,
  Maximize2,
} from 'lucide-react';
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
  /** Raw streamed text — shown as a tail-peek footer while the model writes. */
  streaming?: string;
  durationMs: number | null;
  error?: string | null;
  onFullscreen?: () => void;
  /** When set, the model name in the header becomes a clickable swap target. */
  onSwapClick?: () => void;
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
  streaming = '',
  durationMs,
  error,
  onFullscreen,
  onSwapClick,
}: BenchmarkPaneProps) {
  const showStreamPeek = status === 'streaming' && streaming.length > 0;
  // Tooltip carries vendor + status; visible row stays one line. The dot
  // color is the only persistent status signal — the user can read state
  // at a glance without reading "IDLE" five times.
  const tooltip = `${model.vendor} · ${STATUS_LABELS[status]}`;
  const identity = (
    <>
      <span
        aria-hidden
        className={cn(
          'h-1.5 w-1.5 shrink-0 rounded-full',
          STATUS_DOT_COLOR[status],
        )}
      />
      <span className="flex min-w-0 items-center gap-1 text-xs font-semibold text-adam-text-primary">
        <span className="truncate">{model.name}</span>
        {onSwapClick && (
          <ChevronDown className="h-3 w-3 shrink-0 text-adam-neutral-400" />
        )}
      </span>
    </>
  );
  return (
    <div className="group relative flex h-full flex-col overflow-hidden rounded-lg border border-adam-neutral-700 bg-adam-bg-secondary-dark">
      <header className="flex items-center justify-between gap-3 border-b border-adam-neutral-700 bg-adam-bg-secondary-dark/60 px-3 py-1.5">
        {onSwapClick ? (
          <button
            type="button"
            onClick={onSwapClick}
            aria-label={`Swap ${model.name} for another model`}
            title={tooltip}
            className="-mx-1 flex min-w-0 items-center gap-2 rounded-md px-1 py-0.5 hover:bg-adam-neutral-800 focus:bg-adam-neutral-800 focus:outline-none"
          >
            {identity}
          </button>
        ) : (
          <div
            className="flex min-w-0 items-center gap-2"
            title={tooltip}
          >
            {identity}
          </div>
        )}
        <div className="flex shrink-0 items-center gap-1">
          {durationMs !== null && status !== 'streaming' && (
            <span className="rounded-md border border-adam-neutral-700 bg-adam-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-adam-neutral-300">
              {formatDuration(durationMs)}
            </span>
          )}
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
        </div>
      </header>
      <div className="relative flex-1 bg-adam-neutral-700/40">
        {code && status !== 'error' ? (
          <BenchmarkViewer code={code} />
        ) : (
          <PaneOverlay status={status} error={error} />
        )}
        {showStreamPeek && <StreamPeek text={streaming} />}
      </div>
    </div>
  );
}

function formatDuration(ms: number): string {
  if (ms < 1000) return `${ms} ms`;
  return `${(ms / 1000).toFixed(ms < 10000 ? 2 : 1)} s`;
}

function StreamPeek({ text }: { text: string }) {
  // Tail-peek: just the last ~3 lines so the pane header/viewer aren't
  // crowded out. Trimmed to the most recent characters before splitting so
  // very long outputs don't spend the whole budget on string slicing.
  const tail = text.length > 600 ? text.slice(-600) : text;
  const lines = tail.split('\n').slice(-3);
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-0 max-h-[44%] overflow-hidden bg-gradient-to-t from-adam-neutral-950/95 via-adam-neutral-950/80 to-transparent px-2 pb-1.5 pt-6 font-mono text-[10px] leading-[1.35] text-adam-neutral-300/85">
      <pre className="m-0 whitespace-pre-wrap break-all">
        {lines.join('\n')}
        <span
          aria-hidden
          className="ml-[1px] inline-block h-[0.95em] w-[0.5ch] translate-y-[2px] animate-pulse rounded-[1px] bg-adam-blue/90 align-middle"
        />
      </pre>
    </div>
  );
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
