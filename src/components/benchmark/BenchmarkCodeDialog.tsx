import { useEffect, useState } from 'react';
import { Check, Copy } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { cn } from '@/lib/utils';
import type { BenchmarkModel } from '@/hooks/useBenchmarkConfig';

interface BenchmarkCodeDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  model: BenchmarkModel | null;
  /** The OpenSCAD source the model produced, post fence-stripping. */
  code: string;
}

// Read-only view of a model's SCAD output. Useful for diagnosing why one
// model interpreted a prompt very differently from another (e.g. "create
// a bookshelf" → angled-shelf vs cabinet-style) without changing the
// system prompt and breaking the fairness of the benchmark.
export function BenchmarkCodeDialog({
  open,
  onOpenChange,
  model,
  code,
}: BenchmarkCodeDialogProps) {
  const [copied, setCopied] = useState(false);

  // Reset the "Copied!" pip whenever the dialog reopens for a new pane.
  useEffect(() => {
    if (!open) setCopied(false);
  }, [open]);

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      // clipboard unavailable — silently no-op; the user can still
      // select-all and copy manually.
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-3xl gap-0 overflow-hidden border-adam-neutral-700 bg-adam-bg-secondary-dark p-0 dark:bg-adam-bg-secondary-dark">
        <div className="flex items-start justify-between gap-3 border-b border-adam-neutral-700 px-4 py-3">
          <div className="min-w-0">
            <DialogTitle className="truncate text-sm font-semibold text-adam-text-primary">
              {model?.name ?? 'Model'} — SCAD source
            </DialogTitle>
            <DialogDescription className="text-[11px] text-adam-neutral-400">
              {code.split('\n').length} lines · {code.length} chars
              {model?.vendor ? ` · ${model.vendor}` : ''}
            </DialogDescription>
          </div>
          <button
            type="button"
            onClick={handleCopy}
            disabled={!code}
            className={cn(
              'flex h-8 shrink-0 items-center gap-1.5 rounded-md border border-adam-neutral-700 bg-adam-neutral-900 px-2.5 text-[11px] text-adam-text-primary transition-colors hover:bg-adam-neutral-800',
              'disabled:cursor-not-allowed disabled:opacity-50',
            )}
          >
            {copied ? (
              <>
                <Check className="h-3.5 w-3.5 text-emerald-400" />
                Copied
              </>
            ) : (
              <>
                <Copy className="h-3.5 w-3.5" />
                Copy
              </>
            )}
          </button>
        </div>
        <pre className="m-0 max-h-[60vh] overflow-auto bg-adam-neutral-950 px-4 py-3 font-mono text-[12px] leading-relaxed text-adam-neutral-200">
          {code || '// (no output)'}
        </pre>
      </DialogContent>
    </Dialog>
  );
}
