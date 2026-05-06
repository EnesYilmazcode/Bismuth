import { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';

const bridgeBaseUrl = (
  import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:8765'
).replace(/\/+$/, '');

interface BridgeStats {
  ok: boolean;
  startedAt: string;
  promptsReceived: number;
  repliesDelivered: number;
  errors: number;
  lastReplyAt: string | null;
  lastPrompt: null | {
    id: string;
    mode: string;
    model: string;
    text: string;
    at: string;
  };
  queue: { inbox: number; outbox: number; processed: number };
}

// Lives behind ?debug=1 — this is dev plumbing, not an end-user surface.
// Don't render anything (and skip the polling) when the flag isn't set.
export function DebugPanel() {
  const location = useLocation();
  const enabled = new URLSearchParams(location.search).get('debug') === '1';
  const [stats, setStats] = useState<BridgeStats | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const tick = async () => {
      try {
        const res = await fetch(`${bridgeBaseUrl}/stats`);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as BridgeStats;
        if (!cancelled) {
          setStats(data);
          setError(null);
        }
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : String(e));
      }
    };
    tick();
    const id = window.setInterval(tick, 2000);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [enabled]);

  if (!enabled) return null;

  return (
    <div className="pointer-events-auto fixed bottom-3 right-3 z-50 w-72 rounded-lg border border-adam-neutral-700 bg-adam-neutral-950/95 p-3 font-mono text-[10.5px] text-adam-text-primary/90 shadow-lg backdrop-blur-sm">
      <div className="mb-2 flex items-center justify-between text-adam-blue">
        <span className="font-semibold uppercase tracking-wider">
          bridge debug
        </span>
        <span className="text-adam-neutral-400">?debug=1</span>
      </div>
      {error && <div className="text-red-400">error: {error}</div>}
      {stats && (
        <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 text-adam-neutral-300">
          <dt>started</dt>
          <dd className="truncate">{formatRelative(stats.startedAt)}</dd>
          <dt>prompts</dt>
          <dd>{stats.promptsReceived}</dd>
          <dt>replies</dt>
          <dd>{stats.repliesDelivered}</dd>
          <dt>errors</dt>
          <dd>{stats.errors}</dd>
          <dt>queue</dt>
          <dd>
            in {stats.queue.inbox} · out {stats.queue.outbox} · done{' '}
            {stats.queue.processed}
          </dd>
          {stats.lastPrompt && (
            <>
              <dt>last</dt>
              <dd className="truncate" title={stats.lastPrompt.text}>
                {stats.lastPrompt.text || '(no text)'}
              </dd>
            </>
          )}
        </dl>
      )}
      {!stats && !error && (
        <div className="text-adam-neutral-400">connecting…</div>
      )}
    </div>
  );
}

function formatRelative(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime();
  if (ms < 60_000) return `${Math.round(ms / 1000)}s ago`;
  if (ms < 3_600_000) return `${Math.round(ms / 60_000)}m ago`;
  return `${Math.round(ms / 3_600_000)}h ago`;
}
