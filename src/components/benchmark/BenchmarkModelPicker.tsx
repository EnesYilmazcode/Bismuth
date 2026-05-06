import { Check, ChevronDown, X } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
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
  const isSelected = (id: string) => selected.includes(id);

  const toggle = (id: string) => {
    if (isSelected(id)) {
      onChange(selected.filter((m) => m !== id));
      return;
    }
    if (selected.length >= maxSelected) return;
    onChange([...selected, id]);
  };

  const remove = (id: string) => onChange(selected.filter((m) => m !== id));

  // Group by vendor so the picker stays tidy as the curated list grows.
  const byVendor = available.reduce<Record<string, BenchmarkModel[]>>(
    (acc, m) => {
      const v = m.vendor || 'Other';
      (acc[v] ||= []).push(m);
      return acc;
    },
    {},
  );
  const vendors = Object.keys(byVendor).sort();

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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="outline"
            className="h-8 gap-1 rounded-full border-adam-neutral-700 bg-adam-bg-secondary-dark px-3 text-xs text-adam-text-primary hover:bg-adam-neutral-800"
          >
            {selected.length === 0 ? 'Pick models' : 'Add model'}
            <ChevronDown className="h-3 w-3" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent
          align="start"
          className="max-h-[400px] w-72 overflow-auto border border-adam-neutral-700 bg-adam-neutral-800"
        >
          {vendors.map((vendor, i) => (
            <div key={vendor}>
              {i > 0 && <DropdownMenuSeparator className="bg-adam-neutral-700" />}
              <DropdownMenuLabel className="text-[10.5px] uppercase tracking-wider text-adam-neutral-400">
                {vendor}
              </DropdownMenuLabel>
              {byVendor[vendor].map((m) => {
                const checked = isSelected(m.id);
                const atCap = !checked && selected.length >= maxSelected;
                return (
                  <DropdownMenuItem
                    key={m.id}
                    onSelect={(e) => {
                      e.preventDefault();
                      if (!atCap) toggle(m.id);
                    }}
                    disabled={atCap}
                    className={cn(
                      'flex cursor-pointer items-center justify-between gap-2 text-adam-text-primary',
                      atCap && 'opacity-50',
                    )}
                  >
                    <div className="flex min-w-0 flex-col">
                      <span className="truncate text-sm">{m.name}</span>
                      {m.description && (
                        <span className="truncate text-[10.5px] text-adam-neutral-400">
                          {m.description}
                        </span>
                      )}
                    </div>
                    <Check
                      className={cn(
                        'h-3.5 w-3.5 shrink-0 text-adam-blue',
                        checked ? 'opacity-100' : 'opacity-0',
                      )}
                    />
                  </DropdownMenuItem>
                );
              })}
            </div>
          ))}
          <DropdownMenuSeparator className="bg-adam-neutral-700" />
          <div className="px-2 py-1 text-[10.5px] text-adam-neutral-500">
            {selected.length}/{maxSelected} selected · max {maxSelected} for
            readable layout
          </div>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
