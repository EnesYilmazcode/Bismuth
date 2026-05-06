import { useCallback, useEffect, useState } from 'react';
import type { BenchmarkModel } from '@/hooks/useBenchmarkConfig';

const STORAGE_KEY = 'bismuth-benchmark-selection-v1';
const DEFAULT_COUNT = 2;

function readSelection(): string[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((x) => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeSelection(ids: string[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(ids));
  } catch {
    // localStorage unavailable — fall through silently.
  }
}

// Persists the user's chosen benchmark models per machine. When the catalog
// changes (e.g. a vendor retires a slug), we drop unknown IDs and back-fill
// from the default count so the picker always boots in a usable state.
export function useBenchmarkSelection(available: BenchmarkModel[]) {
  const [selected, setSelected] = useState<string[]>(() => readSelection());

  // Reconcile against the live catalog whenever it changes.
  useEffect(() => {
    if (available.length === 0) return;
    const validIds = new Set(available.map((m) => m.id));
    const stored = readSelection().filter((id) => validIds.has(id));
    if (stored.length === 0) {
      setSelected(available.slice(0, DEFAULT_COUNT).map((m) => m.id));
      return;
    }
    setSelected(stored);
  }, [available]);

  const update = useCallback((next: string[]) => {
    setSelected(next);
    writeSelection(next);
  }, []);

  return { selected, setSelected: update };
}
