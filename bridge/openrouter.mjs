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

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Bias each model toward terse, slider-friendly OpenSCAD. Matches the
// conventions documented in .claude/openscad-prompting.md so all models
// produce comparable artifacts.
export const BENCHMARK_SYSTEM_PROMPT = `You are an OpenSCAD code generator for a parametric CAD viewer.

Respond with a SINGLE OpenSCAD source file and absolutely nothing else — no prose, no markdown fences, no explanations. The file must compile in OpenSCAD WASM (Manifold backend).

Conventions:
- Put every tunable parameter declaration ("name = number;") at the TOP of the file, BEFORE the first module or function definition. Use full descriptive snake_case names (e.g. mug_height, not h).
- Annotate sliders with trailing comments: "// [min:step:max]" or "// [min:max]" (step defaults to 1). Use realistic mm units.
- Group related params with /* [Group Name] */ on its own line.
- Keep $fn at 24–40 at the file level.
- Prefer linear_extrude(offset(square(...))) for rounded boxes. Avoid hull() of more than 4 primitives at large coordinates and avoid minkowski().
- Center the geometry near the origin so the auto-rotating preview shows it well.

If the user asks for something that's not a 3D object, still respond with a valid OpenSCAD file (e.g. a placeholder cube).`;

function stripCodeFences(text) {
  return text
    .replace(/^```(?:openscad|scad)?\s*\n/, '')
    .replace(/\n?```\s*$/, '')
    .trim();
}

export async function streamCompletion({ model, prompt, signal, onEvent }) {
  const startedAt = Date.now();
  onEvent({
    model,
    type: 'start',
    startedAt: new Date(startedAt).toISOString(),
  });

  if (!hasOpenRouterKey()) {
    onEvent({
      model,
      type: 'error',
      message: 'OPENROUTER_API_KEY not set',
      durationMs: 0,
    });
    return;
  }

  let accumulated = '';
  try {
    const res = await fetch(OPENROUTER_URL, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        // OpenRouter uses these for ranking + analytics — they're optional but
        // recommended. The Referer needn't be reachable.
        'HTTP-Referer': 'http://127.0.0.1:3000/bismuth/',
        'X-Title': 'Bismuth Benchmark',
      },
      body: JSON.stringify({
        model,
        stream: true,
        messages: [
          { role: 'system', content: BENCHMARK_SYSTEM_PROMPT },
          { role: 'user', content: prompt },
        ],
      }),
      signal,
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => '');
      throw new Error(
        `OpenRouter ${res.status} ${res.statusText}: ${errText.slice(0, 200)}`,
      );
    }
    const decoder = new TextDecoder();
    let buf = '';
    for await (const chunk of res.body) {
      buf += decoder.decode(chunk, { stream: true });
      // SSE events are separated by blank lines.
      let idx;
      while ((idx = buf.indexOf('\n\n')) >= 0) {
        const event = buf.slice(0, idx);
        buf = buf.slice(idx + 2);
        for (const line of event.split('\n')) {
          const data = line.startsWith('data:') ? line.slice(5).trim() : '';
          if (!data || data === '[DONE]') continue;
          let json;
          try {
            json = JSON.parse(data);
          } catch {
            continue;
          }
          const delta = json?.choices?.[0]?.delta?.content;
          if (typeof delta === 'string' && delta.length > 0) {
            accumulated += delta;
            onEvent({ model, type: 'delta', text: delta });
          }
        }
      }
    }
    onEvent({
      model,
      type: 'done',
      durationMs: Date.now() - startedAt,
      code: stripCodeFences(accumulated),
    });
  } catch (e) {
    onEvent({
      model,
      type: 'error',
      message: e instanceof Error ? e.message : String(e),
      durationMs: Date.now() - startedAt,
    });
  }
}
