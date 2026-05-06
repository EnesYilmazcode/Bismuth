import { useEffect, useState } from 'react';

type BridgeStatus = 'ok' | 'down' | 'unknown';

const HEALTH_POLL_INTERVAL_MS = 5000;

const bridgeBaseUrl = (
  import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:8765'
).replace(/\/+$/, '');

// Polls the local bridge's /health endpoint so the UI can surface "bridge
// down" when the user has forgotten `npm run bridge`. Kept dead simple — no
// query client, no exponential backoff. Five seconds is fast enough to feel
// live without flooding the bridge log.
export function useBridgeHealth(): BridgeStatus {
  const [status, setStatus] = useState<BridgeStatus>('unknown');

  useEffect(() => {
    let cancelled = false;
    const ping = async () => {
      try {
        const res = await fetch(`${bridgeBaseUrl}/health`, { method: 'GET' });
        if (cancelled) return;
        setStatus(res.ok ? 'ok' : 'down');
      } catch {
        if (!cancelled) setStatus('down');
      }
    };
    ping();
    const id = window.setInterval(ping, HEALTH_POLL_INTERVAL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, []);

  return status;
}
