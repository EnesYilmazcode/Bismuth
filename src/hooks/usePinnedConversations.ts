import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'bismuth-pinned-conversations-v1';

function readPinned(): Set<string> {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? new Set(parsed.filter((x) => typeof x === 'string')) : new Set();
  } catch {
    return new Set();
  }
}

function writePinned(set: Set<string>) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify([...set]));
  } catch {
    // localStorage can be unavailable (private mode, quota) — degrade silently.
  }
}

// Local-only conversation pinning. The mock backend has no per-user settings
// table, so pin state lives in localStorage on this machine. Cross-tab sync
// rides on the storage event so a second tab notices a flip immediately.
export function usePinnedConversations() {
  const [pinned, setPinned] = useState<Set<string>>(() => readPinned());

  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) setPinned(readPinned());
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const togglePin = useCallback((id: string) => {
    setPinned((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      writePinned(next);
      return next;
    });
  }, []);

  const isPinned = useCallback((id: string) => pinned.has(id), [pinned]);

  return { pinned, isPinned, togglePin };
}
