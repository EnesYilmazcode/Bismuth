import { useEffect, useRef, useState } from 'react';
import {
  ExternalLink,
  KeyRound,
  Loader2,
  Send,
  Square,
  X,
} from 'lucide-react';
import { Textarea } from '@/components/ui/textarea';
import { useBenchmarkConfig } from '@/hooks/useBenchmarkConfig';
import { useBenchmarkSelection } from '@/hooks/useBenchmarkSelection';
import { BenchmarkAddTile } from '@/components/benchmark/BenchmarkAddTile';
import { BenchmarkExamples } from '@/components/benchmark/BenchmarkExamples';
import { BenchmarkModelBrowser } from '@/components/benchmark/BenchmarkModelBrowser';
import { BenchmarkGrid } from '@/components/benchmark/BenchmarkGrid';
import {
  BenchmarkPane,
  type BenchmarkStatus,
} from '@/components/benchmark/BenchmarkPane';
import { runBenchmark } from '@/services/benchmarkService';

interface PaneState {
  status: BenchmarkStatus;
  /** Raw streamed text — accumulates 'delta' events. */
  streaming: string;
  /** Bridge-stripped final code (post fence removal). Falls back to streaming. */
  code: string;
  durationMs: number | null;
  error: string | null;
}

const INITIAL_PANE: PaneState = {
  status: 'idle',
  streaming: '',
  code: '',
  durationMs: null,
  error: null,
};

// Hard cap so the grid layout stays sane (it tops out at 2 columns past 4).
const MAX_MODELS = 6;

// Benchmark mode — runs one prompt against several AI models in parallel
// and renders each model's OpenSCAD result in its own auto-rotating viewer
// pane. Lives entirely outside the parametric/creative chat history; nothing
// here writes to the conversations table.

export function BenchmarkView() {
  const [prompt, setPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const [paneStates, setPaneStates] = useState<Record<string, PaneState>>({});
  const [fullscreenId, setFullscreenId] = useState<string | null>(null);
  const [swapTargetId, setSwapTargetId] = useState<string | null>(null);
  const [browserOpen, setBrowserOpen] = useState(false);
  const config = useBenchmarkConfig();
  const { selected, setSelected } = useBenchmarkSelection(config.models);
  const abortRef = useRef<AbortController | null>(null);

  // Esc closes the fullscreen overlay. The shortcuts dialog also listens at
  // window-level, but it bails out when typing in inputs so the two coexist.
  useEffect(() => {
    if (!fullscreenId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        setFullscreenId(null);
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [fullscreenId]);

  // Reset stale pane state when a model is added or removed mid-run so the
  // grid never shows results for a model that's no longer in the lineup.
  useEffect(() => {
    setPaneStates((prev) => {
      const next: Record<string, PaneState> = {};
      for (const id of selected) next[id] = prev[id] ?? INITIAL_PANE;
      return next;
    });
  }, [selected]);

  // Cancel any in-flight benchmark when the view unmounts.
  useEffect(() => () => abortRef.current?.abort(), []);

  const canSubmit =
    prompt.trim().length > 0 &&
    !isRunning &&
    config.configured &&
    selected.length > 0;

  const updatePane = (modelId: string, patch: Partial<PaneState>) =>
    setPaneStates((prev) => ({
      ...prev,
      [modelId]: { ...(prev[modelId] ?? INITIAL_PANE), ...patch },
    }));

  const handleSubmit = async () => {
    if (!canSubmit) return;
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setIsRunning(true);
    setPaneStates((prev) => {
      const next: Record<string, PaneState> = { ...prev };
      for (const id of selected) {
        next[id] = {
          status: 'streaming',
          streaming: '',
          code: '',
          durationMs: null,
          error: null,
        };
      }
      return next;
    });

    try {
      for await (const event of runBenchmark({
        prompt: prompt.trim(),
        models: selected,
        signal: controller.signal,
      })) {
        if (event.type === 'start') {
          updatePane(event.model, { status: 'streaming' });
        } else if (event.type === 'delta') {
          setPaneStates((prev) => {
            const cur = prev[event.model] ?? INITIAL_PANE;
            return {
              ...prev,
              [event.model]: {
                ...cur,
                streaming: cur.streaming + event.text,
              },
            };
          });
        } else if (event.type === 'done') {
          updatePane(event.model, {
            status: 'done',
            code: event.code,
            durationMs: event.durationMs,
          });
        } else if (event.type === 'error') {
          updatePane(event.model, {
            status: 'error',
            error: event.message,
            durationMs: event.durationMs,
          });
        }
      }
    } catch (e) {
      if (controller.signal.aborted) return;
      // The fetch itself failed (network, 503 from bridge, etc). Mark every
      // still-streaming pane as errored so the UI tells the user something.
      const message = e instanceof Error ? e.message : String(e);
      setPaneStates((prev) => {
        const next: Record<string, PaneState> = { ...prev };
        for (const id of selected) {
          if (next[id]?.status === 'streaming') {
            next[id] = { ...next[id], status: 'error', error: message };
          }
        }
        return next;
      });
    } finally {
      if (abortRef.current === controller) abortRef.current = null;
      setIsRunning(false);
    }
  };

  const handleAbort = () => {
    abortRef.current?.abort();
    setPaneStates((prev) => {
      const next: Record<string, PaneState> = { ...prev };
      for (const id of Object.keys(next)) {
        if (next[id].status === 'streaming') {
          next[id] = { ...next[id], status: 'error', error: 'Cancelled' };
        }
      }
      return next;
    });
    setIsRunning(false);
  };

  // Replace one pane's model in place. Preserves grid order and drops the
  // old pane's state so the swapped-in model starts fresh. If the new id
  // was already in the lineup elsewhere, that other pane is removed (a
  // model can only occupy one pane at a time).
  const handleSwap = (oldId: string, newId: string) => {
    if (oldId === newId) return;
    const next = selected
      .filter((id) => id !== newId)
      .map((id) => (id === oldId ? newId : id));
    setSelected(next);
    if (fullscreenId === oldId) setFullscreenId(null);
  };

  // Toggle a model in/out of the lineup from the browser's multi mode.
  // Removing a model that owned a pane drops that pane (and its state via
  // the existing reconciliation effect).
  const handleToggle = (id: string) => {
    if (selected.includes(id)) {
      setSelected(selected.filter((x) => x !== id));
      if (fullscreenId === id) setFullscreenId(null);
      return;
    }
    if (selected.length >= MAX_MODELS) return;
    setSelected([...selected, id]);
  };

  const showAddTile =
    config.configured && selected.length < MAX_MODELS && !isRunning;

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-adam-background-1">
      {/* Top + left padding clears the fixed sidebar-toggle button (Layout.tsx)
          so the first pane's header doesn't run under it. */}
      <div className="flex flex-1 flex-col overflow-auto pl-10 pt-10">
        {config.isLoading ? (
          <div className="flex flex-1 items-center justify-center">
            <Loader2 className="h-5 w-5 animate-spin text-adam-neutral-400" />
          </div>
        ) : !config.configured ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <SetupCard error={config.error} />
          </div>
        ) : selected.length === 0 ? (
          <div className="flex flex-1 items-center justify-center px-6">
            <div className="h-[280px] w-full max-w-md">
              <BenchmarkAddTile
                selectedCount={0}
                maxSelected={MAX_MODELS}
                onClick={() => setBrowserOpen(true)}
              />
            </div>
          </div>
        ) : (
          <BenchmarkGrid count={selected.length}>
            {selected.map((id, i) => {
              const model = config.models.find((m) => m.id === id);
              if (!model) return null;
              const pane = paneStates[id] ?? INITIAL_PANE;
              const isLast = i === selected.length - 1;
              return (
                <BenchmarkPane
                  key={id}
                  model={model}
                  status={pane.status}
                  code={pane.code}
                  streaming={pane.streaming}
                  durationMs={pane.durationMs}
                  error={pane.error}
                  onFullscreen={() => setFullscreenId(id)}
                  onSwapClick={
                    isRunning ? undefined : () => setSwapTargetId(id)
                  }
                  onAddClick={
                    isLast && showAddTile
                      ? () => setBrowserOpen(true)
                      : undefined
                  }
                />
              );
            })}
          </BenchmarkGrid>
        )}
      </div>

      <BenchmarkModelBrowser
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        available={config.models}
        selectedIds={selected}
        maxSelected={MAX_MODELS}
        mode="multi"
        onSelect={handleToggle}
      />

      <BenchmarkModelBrowser
        open={swapTargetId !== null}
        onOpenChange={(open) => {
          if (!open) setSwapTargetId(null);
        }}
        available={config.models}
        selectedIds={selected}
        maxSelected={MAX_MODELS}
        mode="replace"
        replaceTargetId={swapTargetId}
        onSelect={(newId) => {
          if (swapTargetId) handleSwap(swapTargetId, newId);
          setSwapTargetId(null);
        }}
      />

      {fullscreenId &&
        (() => {
          const model = config.models.find((m) => m.id === fullscreenId);
          const pane = paneStates[fullscreenId] ?? INITIAL_PANE;
          if (!model) return null;
          return (
            <div className="fixed inset-0 z-40 flex flex-col bg-adam-background-1/95 p-6 backdrop-blur-sm">
              <div className="mb-3 flex items-center justify-between">
                <span className="text-sm font-medium text-adam-text-primary">
                  {model.name}{' '}
                  <span className="text-adam-neutral-500">· {model.vendor}</span>
                </span>
                <button
                  type="button"
                  onClick={() => setFullscreenId(null)}
                  aria-label="Close fullscreen"
                  className="rounded-md border border-adam-neutral-700 bg-adam-bg-secondary-dark p-2 text-adam-text-primary hover:bg-adam-neutral-800"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="min-h-0 flex-1">
                <BenchmarkPane
                  model={model}
                  status={pane.status}
                  code={pane.code}
                  streaming={pane.streaming}
                  durationMs={pane.durationMs}
                  error={pane.error}
                />
              </div>
              <p className="mt-2 text-[11px] text-adam-neutral-500">Esc to close</p>
            </div>
          );
        })()}

      <div className="border-t border-adam-neutral-800/60 bg-adam-bg-secondary-dark/40 px-6 py-4 md:px-20">
        <div className="mx-auto w-full max-w-6xl">
          {config.configured && prompt.trim().length === 0 && (
            <BenchmarkExamples
              disabled={isRunning}
              onSelect={(p) => setPrompt(p)}
            />
          )}
        </div>
        <div className="mx-auto w-full max-w-6xl">
          <div className="overflow-hidden rounded-xl border border-adam-neutral-700 bg-adam-background-2 focus-within:border-adam-neutral-500">
            <Textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              onKeyDown={(e) => {
                if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
                  e.preventDefault();
                  handleSubmit();
                }
              }}
              placeholder="e.g. a coffee mug with a generous handle and a wall thickness slider"
              rows={2}
              className="block w-full resize-none border-0 bg-transparent px-3 py-2.5 text-sm text-adam-text-primary placeholder:text-adam-neutral-500 focus-visible:ring-0 focus-visible:ring-offset-0"
            />
            <div className="flex items-center justify-between gap-3 border-t border-adam-neutral-700 px-3 py-2">
              <span className="truncate text-[11px] text-adam-neutral-500">
                {!config.configured
                  ? 'Add OPENROUTER_API_KEY to .env.local to enable Run.'
                  : selected.length === 0
                    ? 'Pick at least one model before running.'
                    : `${selected.length} model${selected.length === 1 ? '' : 's'} ready · ⌘/Ctrl + Enter`}
              </span>
              {isRunning ? (
                <button
                  type="button"
                  onClick={handleAbort}
                  aria-label="Stop benchmark"
                  title="Stop benchmark"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-adam-neutral-600 bg-adam-bg-secondary-dark text-adam-text-primary hover:bg-adam-neutral-800"
                >
                  <Square className="h-3.5 w-3.5 fill-current" />
                </button>
              ) : (
                <button
                  type="button"
                  onClick={handleSubmit}
                  disabled={!canSubmit}
                  aria-label="Run benchmark"
                  title="Run benchmark"
                  className="flex h-8 w-8 items-center justify-center rounded-md bg-adam-blue text-adam-neutral-50 transition-colors hover:bg-adam-blue/80 disabled:cursor-not-allowed disabled:bg-adam-neutral-700 disabled:text-adam-neutral-400"
                >
                  <Send className="h-4 w-4" />
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function SetupCard({ error }: { error: string | null }) {
  return (
    <div className="mx-auto flex max-w-md flex-col gap-4 rounded-xl border border-adam-neutral-700 bg-adam-bg-secondary-dark/60 p-6 text-left">
      <div className="flex items-center gap-2 text-adam-text-primary">
        <KeyRound className="h-5 w-5 text-adam-blue" />
        <span className="text-base font-semibold">Benchmark needs an API key</span>
      </div>
      <p className="text-sm text-adam-neutral-300">
        Bismuth uses{' '}
        <a
          href="https://openrouter.ai"
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-0.5 text-adam-blue hover:underline"
        >
          OpenRouter
          <ExternalLink className="h-3 w-3" />
        </a>{' '}
        to reach many models with one key. Add this line to{' '}
        <code className="rounded bg-adam-neutral-950 px-1 py-0.5 text-[11px]">
          .env.local
        </code>{' '}
        and restart the bridge:
      </p>
      <pre className="rounded-md border border-adam-neutral-800 bg-adam-neutral-950 px-3 py-2 font-mono text-[11.5px] text-adam-text-primary">
        OPENROUTER_API_KEY=&quot;sk-or-…&quot;
      </pre>
      {error && (
        <p className="text-[11px] text-red-400">
          Bridge error reaching{' '}
          <code className="rounded bg-adam-neutral-950 px-1">/benchmark-models</code>
          : {error}
        </p>
      )}
    </div>
  );
}
