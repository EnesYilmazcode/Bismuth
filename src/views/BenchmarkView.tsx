import { useState } from 'react';
import { ExternalLink, KeyRound, Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { useBenchmarkConfig } from '@/hooks/useBenchmarkConfig';
import { useBenchmarkSelection } from '@/hooks/useBenchmarkSelection';
import { BenchmarkModelPicker } from '@/components/benchmark/BenchmarkModelPicker';

// Benchmark mode — runs one prompt against several AI models in parallel
// and renders each model's OpenSCAD result in its own auto-rotating viewer
// pane. Lives entirely outside the parametric/creative chat history; nothing
// here writes to the conversations table.

export function BenchmarkView() {
  const [prompt, setPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);
  const config = useBenchmarkConfig();
  const { selected, setSelected } = useBenchmarkSelection(config.models);

  const canSubmit =
    prompt.trim().length > 0 &&
    !isRunning &&
    config.configured &&
    selected.length > 0;

  const handleSubmit = () => {
    if (!canSubmit) return;
    setIsRunning(true);
    // Streaming wire-up lands in Phase E. For now the button is a no-op so
    // the layout can be reviewed in isolation.
    setTimeout(() => setIsRunning(false), 600);
  };

  return (
    <div className="flex h-full min-w-0 flex-1 flex-col bg-adam-background-1">
      <header className="border-b border-adam-neutral-800/60 px-6 pb-4 pt-10 md:px-20 md:py-6">
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-3">
          <div className="flex flex-col gap-1">
            <h1 className="text-2xl font-medium text-adam-neutral-10">
              Benchmark
            </h1>
            <p className="text-sm text-adam-neutral-400">
              Compare how different AI models tackle the same CAD prompt, side
              by side. Each pane is an independent OpenSCAD viewer.
            </p>
          </div>
          {config.configured && config.models.length > 0 && (
            <BenchmarkModelPicker
              available={config.models}
              selected={selected}
              onChange={setSelected}
            />
          )}
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 text-sm text-adam-neutral-500">
        {config.isLoading ? (
          <Loader2 className="h-5 w-5 animate-spin text-adam-neutral-400" />
        ) : !config.configured ? (
          <SetupCard error={config.error} />
        ) : (
          'Pick models and run a prompt to see results here.'
        )}
      </div>

      <div className="border-t border-adam-neutral-800/60 bg-adam-bg-secondary-dark/40 px-6 py-4 md:px-20">
        <div className="mx-auto flex w-full max-w-6xl items-end gap-3">
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
            className="flex-1 resize-none border border-adam-neutral-700 bg-adam-background-2 text-sm text-adam-text-primary"
          />
          <Button
            onClick={handleSubmit}
            disabled={!canSubmit}
            className="h-12 gap-2 rounded-lg bg-adam-blue px-4 text-adam-neutral-50 hover:bg-adam-blue/80"
          >
            {isRunning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Send className="h-4 w-4" />
            )}
            Run
          </Button>
        </div>
        <p className="mx-auto mt-2 max-w-6xl text-[11px] text-adam-neutral-500">
          {!config.configured
            ? 'Add OPENROUTER_API_KEY to .env.local to enable Run.'
            : selected.length === 0
              ? 'Pick at least one model above before running.'
              : `${selected.length} model${selected.length === 1 ? '' : 's'} ready · ⌘/Ctrl + Enter to submit.`}
        </p>
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
