import type { Parameter } from '@shared/types';

export type BenchmarkEvent =
  | { model: string; type: 'start'; startedAt: string }
  | { model: string; type: 'delta'; text: string }
  | {
      model: string;
      type: 'done';
      durationMs: number;
      code: string;
      parameters?: Parameter[];
    }
  | { model: string; type: 'error'; durationMs: number; message: string };

const bridgeBaseUrl = (
  import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:8765'
).replace(/\/+$/, '');

interface RunBenchmarkArgs {
  prompt: string;
  models: string[];
  signal?: AbortSignal;
}

// Fan-out streaming wrapper around the bridge's /benchmark endpoint. Yields
// one BenchmarkEvent per ND-JSON line so the caller can route them to the
// matching pane. Throws on non-2xx for the parent fetch (e.g. 503 when the
// API key is missing) — per-model upstream failures arrive as 'error' events
// inside the body, not as HTTP errors.
export async function* runBenchmark({
  prompt,
  models,
  signal,
}: RunBenchmarkArgs): AsyncGenerator<BenchmarkEvent> {
  const res = await fetch(`${bridgeBaseUrl}/functions/v1/benchmark`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ prompt, models }),
    signal,
  });
  if (!res.ok) {
    let body = '';
    try {
      body = await res.text();
    } catch {}
    throw new Error(`Benchmark request failed: ${res.status} ${body.slice(0, 200)}`);
  }
  const reader = res.body?.getReader();
  if (!reader) throw new Error('Benchmark response had no body stream.');

  const decoder = new TextDecoder();
  let buf = '';
  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let idx;
    while ((idx = buf.indexOf('\n')) >= 0) {
      const line = buf.slice(0, idx);
      buf = buf.slice(idx + 1);
      const trimmed = line.trim();
      if (!trimmed) continue;
      try {
        yield JSON.parse(trimmed) as BenchmarkEvent;
      } catch {
        // Ignore malformed lines — partial chunks that didn't end in \n are
        // already handled by leaving them in `buf`.
      }
    }
  }
}
