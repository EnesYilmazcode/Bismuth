import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Search } from 'lucide-react';
import { Command as CommandPrimitive } from 'cmdk';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from '@/components/ui/dialog';
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from '@/components/ui/command';
import { cn } from '@/lib/utils';
import type { BenchmarkModel } from '@/hooks/useBenchmarkConfig';

export type BenchmarkBrowserMode = 'multi' | 'replace';

type SortMode = 'vendor' | 'cheap' | 'pricey' | 'name';

const SORT_OPTIONS: { id: SortMode; label: string }[] = [
  { id: 'vendor', label: 'Vendor' },
  { id: 'cheap', label: 'Cheap → Pricey' },
  { id: 'pricey', label: 'Pricey → Cheap' },
  { id: 'name', label: 'A → Z' },
];

function formatPrice(usd: number): string {
  if (usd === 0) return 'free';
  if (usd >= 0.01) return `~$${usd.toFixed(2)}/run`;
  if (usd >= 0.001) return `~$${usd.toFixed(3)}/run`;
  return `~$${usd.toFixed(4)}/run`;
}

interface BenchmarkModelBrowserProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  available: BenchmarkModel[];
  selectedIds: string[];
  maxSelected: number;
  mode: BenchmarkBrowserMode;
  /** When mode==='replace', the pane id being swapped (it shows a "current" badge). */
  replaceTargetId?: string | null;
  /** Toggle in multi mode; replace in replace mode. */
  onSelect: (id: string) => void;
}

// Search-as-you-type model browser. cmdk handles fuzzy matching across the
// rendered text content, so each row's `value` includes the model name,
// vendor, and description — typing "claude" or "anthropic" or "fast" all
// surface the right rows.
export function BenchmarkModelBrowser({
  open,
  onOpenChange,
  available,
  selectedIds,
  maxSelected,
  mode,
  replaceTargetId,
  onSelect,
}: BenchmarkModelBrowserProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [sort, setSort] = useState<SortMode>('vendor');

  // Radix focuses the dialog content first; defer focus to the input so the
  // user can immediately start typing to filter.
  useEffect(() => {
    if (!open) return;
    const t = setTimeout(() => {
      const el = inputRef.current;
      if (!el) return;
      el.focus();
      // Clear any stale query from the previous opening.
      el.value = '';
      el.dispatchEvent(new Event('input', { bubbles: true }));
    }, 30);
    return () => clearTimeout(t);
  }, [open]);

  const byVendor = useMemo(() => {
    const acc: Record<string, BenchmarkModel[]> = {};
    for (const m of available) {
      const v = m.vendor || 'Other';
      (acc[v] ||= []).push(m);
    }
    return acc;
  }, [available]);
  const vendors = useMemo(() => Object.keys(byVendor).sort(), [byVendor]);

  // Flat list used by every sort mode except 'vendor'. Models without
  // pricing sort to the bottom of the price modes — silence is calmer
  // than pretending we know they're free.
  const flat = useMemo(() => {
    const arr = [...available];
    if (sort === 'name') {
      arr.sort((a, b) => a.name.localeCompare(b.name));
    } else if (sort === 'cheap' || sort === 'pricey') {
      arr.sort((a, b) => {
        const ap = a.pricing?.estPerRunUsd;
        const bp = b.pricing?.estPerRunUsd;
        if (ap == null && bp == null) return 0;
        if (ap == null) return 1;
        if (bp == null) return -1;
        return sort === 'cheap' ? ap - bp : bp - ap;
      });
    }
    return arr;
  }, [available, sort]);

  const isSelected = (id: string) => selectedIds.includes(id);
  const atCap = mode === 'multi' && selectedIds.length >= maxSelected;

  const handleItemSelect = (id: string) => {
    if (mode === 'replace') {
      onSelect(id);
      onOpenChange(false);
      return;
    }
    if (!isSelected(id) && atCap) return;
    onSelect(id);
    // Stay open in multi mode so the user can pick several without reopening.
  };

  const renderRow = (m: BenchmarkModel) => {
    const checked = isSelected(m.id);
    const isCurrentTarget =
      mode === 'replace' && m.id === replaceTargetId;
    const disabled = mode === 'multi' && !checked && atCap;
    // cmdk indexes this string; embedding the description and vendor
    // lets the search hit "fast" or "anthropic" too.
    const searchValue = `${m.name} ${m.vendor} ${m.description ?? ''}`;
    return (
      <CommandItem
        key={m.id}
        value={searchValue}
        disabled={disabled}
        onSelect={() => handleItemSelect(m.id)}
        className={cn(
          'mx-1 my-0.5 flex cursor-pointer items-start gap-3 rounded-md px-3 py-2.5 text-adam-text-primary aria-selected:bg-adam-neutral-800 data-[selected=true]:bg-adam-neutral-800 data-[selected=true]:text-adam-text-primary',
          disabled && 'cursor-not-allowed opacity-50',
        )}
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-medium">{m.name}</span>
            {sort !== 'vendor' && (
              <span className="shrink-0 text-[10px] text-adam-neutral-500">
                {m.vendor}
              </span>
            )}
            {isCurrentTarget && (
              <span className="shrink-0 rounded-full border border-adam-neutral-600 bg-adam-neutral-900 px-1.5 py-px text-[9.5px] uppercase tracking-wider text-adam-neutral-300">
                current
              </span>
            )}
            {checked && !isCurrentTarget && mode === 'multi' && (
              <span className="shrink-0 rounded-full border border-adam-blue/50 bg-adam-blue/10 px-1.5 py-px text-[9.5px] uppercase tracking-wider text-adam-blue">
                in lineup
              </span>
            )}
          </div>
          {m.description && (
            <p className="mt-0.5 truncate text-[11.5px] text-adam-neutral-400">
              {m.description}
            </p>
          )}
        </div>
        {m.pricing && (
          <span
            className="mt-0.5 shrink-0 rounded-md border border-adam-neutral-700 bg-adam-neutral-900 px-1.5 py-0.5 font-mono text-[10px] text-adam-neutral-300"
            title={`${m.pricing.promptUsdPerMTok.toFixed(2)} in / ${m.pricing.completionUsdPerMTok.toFixed(2)} out per 1M tokens · est ~350 in / ~2000 out`}
          >
            {formatPrice(m.pricing.estPerRunUsd)}
          </span>
        )}
        {mode === 'multi' && (
          <Check
            className={cn(
              'mt-0.5 h-4 w-4 shrink-0 text-adam-blue transition-opacity',
              checked ? 'opacity-100' : 'opacity-0',
            )}
          />
        )}
      </CommandItem>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl gap-0 overflow-hidden border-adam-neutral-700 bg-adam-bg-secondary-dark p-0 dark:bg-adam-bg-secondary-dark">
        <div className="border-b border-adam-neutral-700 px-4 py-3">
          <DialogTitle className="text-sm font-semibold text-adam-text-primary">
            {mode === 'replace' ? 'Swap model' : 'Browse models'}
          </DialogTitle>
          <DialogDescription className="text-[11px] text-adam-neutral-400">
            {mode === 'replace'
              ? 'Pick a model to take this pane.'
              : `Choose up to ${maxSelected} models to compare side by side.`}
          </DialogDescription>
        </div>
        <Command
          className="bg-transparent text-adam-text-primary"
          // Custom filter: keep cmdk's default substring scoring, but also
          // match when the query hits the vendor or description (cmdk only
          // indexes `value`, which we pre-compose below).
          shouldFilter={true}
        >
          <div className="flex items-center gap-2 border-b border-adam-neutral-700 px-3" cmdk-input-wrapper="">
            <Search className="h-4 w-4 shrink-0 text-adam-neutral-400" />
            <CommandPrimitive.Input
              ref={inputRef}
              placeholder="Search by name, vendor, or capability…"
              className="flex h-11 w-full bg-transparent py-3 text-sm text-adam-text-primary outline-none placeholder:text-adam-neutral-500"
            />
          </div>
          <div className="flex items-center gap-1 border-b border-adam-neutral-700 px-3 py-2">
            <span className="mr-1 text-[10.5px] uppercase tracking-wider text-adam-neutral-500">
              Sort
            </span>
            {SORT_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                type="button"
                onClick={() => setSort(opt.id)}
                className={cn(
                  'rounded-md px-2 py-0.5 text-[11px] transition-colors',
                  sort === opt.id
                    ? 'bg-adam-neutral-700 text-adam-text-primary'
                    : 'text-adam-neutral-400 hover:bg-adam-neutral-800 hover:text-adam-text-primary',
                )}
              >
                {opt.label}
              </button>
            ))}
          </div>
          <CommandList className="max-h-[420px]">
            <CommandEmpty className="px-4 py-6 text-center text-sm text-adam-neutral-400">
              No models match your search.
            </CommandEmpty>
            {sort === 'vendor' ? (
              vendors.map((vendor) => (
                <CommandGroup
                  key={vendor}
                  heading={vendor}
                  className="[&_[cmdk-group-heading]]:px-3 [&_[cmdk-group-heading]]:pb-1 [&_[cmdk-group-heading]]:pt-2 [&_[cmdk-group-heading]]:text-[10.5px] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wider [&_[cmdk-group-heading]]:text-adam-neutral-400"
                >
                  {byVendor[vendor].map(renderRow)}
                </CommandGroup>
              ))
            ) : (
              <CommandGroup>{flat.map(renderRow)}</CommandGroup>
            )}
          </CommandList>
        </Command>
        <div className="flex items-center justify-between border-t border-adam-neutral-700 px-4 py-2.5 text-[11px] text-adam-neutral-400">
          {mode === 'multi' ? (
            <>
              <span>
                {selectedIds.length}/{maxSelected} in lineup
              </span>
              <span className="text-adam-neutral-500">
                ↑↓ navigate · Enter toggle · Esc close
              </span>
            </>
          ) : (
            <span className="text-adam-neutral-500">
              ↑↓ navigate · Enter swap · Esc close
            </span>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
