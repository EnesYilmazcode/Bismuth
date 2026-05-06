import { useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';

interface Shortcut {
  keys: string[];
  description: string;
}

const SHORTCUTS: Shortcut[] = [
  { keys: ['⌘', 'K'], description: 'Focus the history search box' },
  { keys: ['?'], description: 'Open this shortcut help' },
  { keys: ['Esc'], description: 'Close dialogs and overlays' },
];

// Global '?' opens this dialog. Listen at the window level but bail out when
// the user is typing in an input — we don't want '?' to swallow the literal
// question mark in their prompt.
function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName;
  return (
    tag === 'INPUT' ||
    tag === 'TEXTAREA' ||
    tag === 'SELECT' ||
    target.isContentEditable
  );
}

export function KeyboardShortcutsDialog() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== '?' || e.metaKey || e.ctrlKey || e.altKey) return;
      if (isTypingTarget(e.target)) return;
      e.preventDefault();
      setOpen(true);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="border border-adam-neutral-700 bg-adam-bg-secondary-dark">
        <DialogHeader>
          <DialogTitle className="text-adam-text-primary">
            Keyboard shortcuts
          </DialogTitle>
          <DialogDescription className="text-adam-neutral-400">
            On macOS use ⌘ in place of Ctrl.
          </DialogDescription>
        </DialogHeader>
        <ul className="mt-2 flex flex-col divide-y divide-adam-neutral-700/60">
          {SHORTCUTS.map((s) => (
            <li
              key={s.description}
              className="flex items-center justify-between gap-4 py-2 text-sm text-adam-text-primary"
            >
              <span>{s.description}</span>
              <span className="flex items-center gap-1">
                {s.keys.map((k, i) => (
                  <kbd
                    key={`${k}-${i}`}
                    className="rounded border border-adam-neutral-700 bg-adam-neutral-950 px-1.5 py-0.5 font-mono text-[11px] text-adam-text-primary"
                  >
                    {k}
                  </kbd>
                ))}
              </span>
            </li>
          ))}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
