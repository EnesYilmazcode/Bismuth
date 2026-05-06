import { useState } from 'react';
import { Loader2, Send } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';

// Benchmark mode — runs one prompt against several AI models in parallel
// and renders each model's OpenSCAD result in its own auto-rotating viewer
// pane. Lives entirely outside the parametric/creative chat history; nothing
// here writes to the conversations table.

export function BenchmarkView() {
  const [prompt, setPrompt] = useState('');
  const [isRunning, setIsRunning] = useState(false);

  const canSubmit = prompt.trim().length > 0 && !isRunning;

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
        <div className="mx-auto flex w-full max-w-6xl flex-col gap-1">
          <h1 className="text-2xl font-medium text-adam-neutral-10">
            Benchmark
          </h1>
          <p className="text-sm text-adam-neutral-400">
            Compare how different AI models tackle the same CAD prompt, side by
            side. Each pane is an independent OpenSCAD viewer.
          </p>
        </div>
      </header>

      <div className="flex flex-1 items-center justify-center px-6 text-sm text-adam-neutral-500">
        Pick models and run a prompt to see results here.
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
          ⌘/Ctrl + Enter to submit.
        </p>
      </div>
    </div>
  );
}
