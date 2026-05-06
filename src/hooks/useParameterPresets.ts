import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'bismuth-parameter-presets-v1';

export interface ParameterPreset {
  name: string;
  values: Record<string, unknown>;
  updatedAt: string;
}

function readPresets(): ParameterPreset[] {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (p): p is ParameterPreset =>
        !!p && typeof p === 'object' && typeof p.name === 'string',
    );
  } catch {
    return [];
  }
}

function writePresets(list: ParameterPreset[]) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // Quota / private mode — just drop it.
  }
}

// Presets are keyed by user-supplied name and stored globally (not per
// conversation), so a tuning saved on one model can be applied to another —
// the load path takes the intersection of names. Same machine only.
export function useParameterPresets() {
  const [presets, setPresets] = useState<ParameterPreset[]>(() => readPresets());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPresets(readPresets());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const savePreset = useCallback(
    (name: string, values: Record<string, unknown>) => {
      const trimmed = name.trim();
      if (!trimmed) return;
      setPresets((prev) => {
        const without = prev.filter((p) => p.name !== trimmed);
        const next = [
          ...without,
          { name: trimmed, values, updatedAt: new Date().toISOString() },
        ].sort((a, b) => a.name.localeCompare(b.name));
        writePresets(next);
        return next;
      });
    },
    [],
  );

  const deletePreset = useCallback((name: string) => {
    setPresets((prev) => {
      const next = prev.filter((p) => p.name !== name);
      writePresets(next);
      return next;
    });
  }, []);

  return { presets, savePreset, deletePreset };
}
