import { useEffect, useState } from 'react';

export interface BenchmarkModelPricing {
  /** OpenRouter list price for input tokens, in USD per 1M tokens. */
  promptUsdPerMTok: number;
  /** OpenRouter list price for output tokens, in USD per 1M tokens. */
  completionUsdPerMTok: number;
  /**
   * Estimated cost of one benchmark run, in USD. Computed by the bridge
   * using a fixed token budget (EST_INPUT_TOKENS + EST_OUTPUT_TOKENS in
   * `bridge/openrouter.mjs`) — meant as a guide, not a billing quote.
   */
  estPerRunUsd: number;
}

export interface BenchmarkModel {
  id: string;
  name: string;
  vendor: string;
  description?: string;
  /** Absent when the bridge couldn't reach the pricing endpoint. */
  pricing?: BenchmarkModelPricing;
}

interface BenchmarkConfig {
  configured: boolean;
  models: BenchmarkModel[];
  isLoading: boolean;
  error: string | null;
}

const bridgeBaseUrl = (
  import.meta.env.VITE_SUPABASE_URL || 'http://127.0.0.1:8765'
).replace(/\/+$/, '');

// Tiny one-shot loader for the benchmark mode metadata. We don't need React
// Query's machinery for this — the response only changes when the bridge is
// restarted, and the route already gates rendering on `configured`.
export function useBenchmarkConfig(): BenchmarkConfig {
  const [state, setState] = useState<BenchmarkConfig>({
    configured: false,
    models: [],
    isLoading: true,
    error: null,
  });

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(
          `${bridgeBaseUrl}/functions/v1/benchmark-models`,
        );
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = (await res.json()) as {
          configured: boolean;
          models: BenchmarkModel[];
        };
        if (cancelled) return;
        setState({
          configured: !!data.configured,
          models: Array.isArray(data.models) ? data.models : [],
          isLoading: false,
          error: null,
        });
      } catch (e) {
        if (cancelled) return;
        setState({
          configured: false,
          models: [],
          isLoading: false,
          error: e instanceof Error ? e.message : String(e),
        });
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  return state;
}
