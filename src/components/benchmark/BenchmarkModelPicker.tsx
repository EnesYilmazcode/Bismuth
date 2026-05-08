import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { BenchmarkModelBrowser } from '@/components/benchmark/BenchmarkModelBrowser';
import type { BenchmarkModel } from '@/hooks/useBenchmarkConfig';

interface BenchmarkModelPickerProps {
  available: BenchmarkModel[];
  selected: string[];
  onChange: (next: string[]) => void;
  /** Hard cap so the grid layout stays sane. */
  maxSelected?: number;
}

export function BenchmarkModelPicker({
  available,
  selected,
  onChange,
  maxSelected = 6,
}: BenchmarkModelPickerProps) {
  const [browserOpen, setBrowserOpen] = useState(false);

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((m) => m !== id));
      return;
    }
    if (selected.length >= maxSelected) return;
    onChange([...selected, id]);
  };

  const remove = (id: string) => onChange(selected.filter((m) => m !== id));

  const selectedModels = selected
    .map((id) => available.find((m) => m.id === id))
    .filter((m): m is BenchmarkModel => !!m);

  return (
    <div className="flex flex-wrap items-center gap-2">
      {selectedModels.map((m) => (
        <span
          key={m.id}
          className="inline-flex items-center gap-1 rounded-full border border-adam-neutral-700 bg-adam-bg-secondary-dark px-2.5 py-1 text-xs text-adam-text-primary"
        >
          <span className="font-medium">{m.name}</span>
          <span className="text-[10px] text-adam-neutral-500">{m.vendor}</span>
          <button
            type="button"
            onClick={() => remove(m.id)}
            aria-label={`Remove ${m.name}`}
            className="ml-1 rounded-full p-0.5 text-adam-neutral-400 hover:bg-adam-neutral-700 hover:text-adam-text-primary"
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <Button
        variant="outline"
        onClick={() => setBrowserOpen(true)}
        className="h-8 gap-1.5 rounded-full border-adam-neutral-700 bg-adam-bg-secondary-dark px-3 text-xs text-adam-text-primary hover:bg-adam-neutral-800"
      >
        <Plus className="h-3 w-3" />
        {selected.length === 0 ? 'Pick models' : 'Browse models'}
      </Button>
      <BenchmarkModelBrowser
        open={browserOpen}
        onOpenChange={setBrowserOpen}
        available={available}
        selectedIds={selected}
        maxSelected={maxSelected}
        mode="multi"
        onSelect={toggle}
      />
    </div>
  );
}
