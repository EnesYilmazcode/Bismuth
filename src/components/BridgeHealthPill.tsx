import { useBridgeHealth } from '@/hooks/useBridgeHealth';
import { cn } from '@/lib/utils';

interface BridgeHealthPillProps {
  collapsed?: boolean;
}

const COPY = {
  ok: { label: 'bridge ok', dot: 'bg-emerald-500', tip: 'Local bridge is reachable.' },
  down: {
    label: 'bridge down',
    dot: 'bg-red-500',
    tip: 'Bridge unreachable — run `npm run bridge` in another terminal.',
  },
  unknown: { label: 'connecting…', dot: 'bg-amber-400', tip: 'Probing /health' },
} as const;

export function BridgeHealthPill({ collapsed = false }: BridgeHealthPillProps) {
  const status = useBridgeHealth();
  const { label, dot, tip } = COPY[status];

  if (collapsed) {
    return (
      <div
        title={tip}
        className="mx-auto my-2 flex h-6 w-6 items-center justify-center rounded-full"
        aria-label={label}
      >
        <span className={cn('h-2 w-2 rounded-full', dot)} />
      </div>
    );
  }
  return (
    <div
      title={tip}
      className="mx-3 my-2 flex items-center gap-2 rounded-md border border-adam-neutral-700/60 bg-adam-bg-secondary-dark/50 px-2 py-1 text-[10.5px] text-adam-neutral-400"
    >
      <span className={cn('h-1.5 w-1.5 shrink-0 rounded-full', dot)} />
      <span className="truncate font-mono uppercase tracking-wider">{label}</span>
    </div>
  );
}
