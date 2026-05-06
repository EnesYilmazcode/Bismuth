// OpenRouter integration for the Benchmark mode. Owns:
//   - the curated model list shown in the picker
//   - the system prompt that biases each model toward valid OpenSCAD
//   - a streaming chat-completions wrapper that yields ND-JSON-shaped events
//
// Exact model slugs occasionally change on OpenRouter's side (vendors retire
// snapshots, rename, etc.). When that happens, update BENCHMARK_MODELS here
// — nothing else in the bridge or frontend hardcodes them.

export const BENCHMARK_MODELS = [
  {
    id: 'anthropic/claude-sonnet-4.5',
    name: 'Claude Sonnet 4.5',
    vendor: 'Anthropic',
    description: 'Strong CAD reasoning, fast.',
  },
  {
    id: 'anthropic/claude-opus-4.1',
    name: 'Claude Opus 4.1',
    vendor: 'Anthropic',
    description: 'Slowest of the Claudes, deepest geometry reasoning.',
  },
  {
    id: 'openai/gpt-5',
    name: 'GPT-5',
    vendor: 'OpenAI',
    description: 'OpenAI flagship reasoning model.',
  },
  {
    id: 'openai/gpt-4o',
    name: 'GPT-4o',
    vendor: 'OpenAI',
    description: 'Faster, cheaper baseline from OpenAI.',
  },
  {
    id: 'openai/o3',
    name: 'o3',
    vendor: 'OpenAI',
    description: 'Reasoning-tuned; tends to write tidier OpenSCAD.',
  },
  {
    id: 'google/gemini-2.5-pro',
    name: 'Gemini 2.5 Pro',
    vendor: 'Google',
    description: 'Long context, decent at parametric design.',
  },
  {
    id: 'google/gemini-2.0-flash-001',
    name: 'Gemini 2.0 Flash',
    vendor: 'Google',
    description: 'Fast and cheap baseline from Google.',
  },
  {
    id: 'deepseek/deepseek-chat',
    name: 'DeepSeek V3',
    vendor: 'DeepSeek',
    description: 'Open-weights, strong at code generation.',
  },
  {
    id: 'qwen/qwen-2.5-coder-32b-instruct',
    name: 'Qwen 2.5 Coder 32B',
    vendor: 'Alibaba',
    description: 'Code-tuned open model.',
  },
  {
    id: 'meta-llama/llama-3.3-70b-instruct',
    name: 'Llama 3.3 70B',
    vendor: 'Meta',
    description: 'Open-weights generalist.',
  },
  {
    id: 'mistralai/mistral-large-2411',
    name: 'Mistral Large',
    vendor: 'Mistral',
    description: 'European flagship.',
  },
  {
    id: 'x-ai/grok-3',
    name: 'Grok 3',
    vendor: 'xAI',
    description: 'X.ai flagship reasoning model.',
  },
];

export function hasOpenRouterKey() {
  return !!(process.env.OPENROUTER_API_KEY && process.env.OPENROUTER_API_KEY.trim());
}

export function listBenchmarkModels() {
  return BENCHMARK_MODELS.map((m) => ({ ...m }));
}
