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
    id: 'qwen/qwen3-coder-30b-a3b-instruct',
    name: 'Qwen3 Coder 30B',
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

// Token budget used to convert OpenRouter's per-token list price into a
// human-readable "estimated cost per run" chip. These are rough averages
// from the system prompt + a typical OpenSCAD response — meant as a
// guide, not a guarantee, hence the "~" prefix on the chip.
const EST_INPUT_TOKENS = 350;
const EST_OUTPUT_TOKENS = 2000;

// Populated once at bridge startup by loadPricing(). Maps OpenRouter
// model id → per-token prices (USD). Empty map is the "pricing
// unavailable" sentinel — listBenchmarkModels() omits the field.
let _priceMap = new Map();

export async function fetchOpenRouterPricing() {
  if (!hasOpenRouterKey()) return new Map();
  try {
    const res = await fetch('https://openrouter.ai/api/v1/models', {
      headers: {
        Authorization: `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'HTTP-Referer': 'http://127.0.0.1:3000/bismuth/',
        'X-Title': 'Bismuth Benchmark',
      },
    });
    if (!res.ok) return new Map();
    const json = await res.json();
    const out = new Map();
    for (const m of json?.data ?? []) {
      const p = m?.pricing;
      const prompt = p?.prompt ? Number(p.prompt) : NaN;
      const completion = p?.completion ? Number(p.completion) : NaN;
      if (!m?.id || !Number.isFinite(prompt) || !Number.isFinite(completion))
        continue;
      out.set(m.id, { promptUsdPerTok: prompt, completionUsdPerTok: completion });
    }
    return out;
  } catch {
    return new Map();
  }
}

// Idempotent: safe to call repeatedly. Designed to be awaited once at
// bridge startup so /benchmark-models can serve pricing immediately.
export async function loadPricing() {
  const map = await fetchOpenRouterPricing();
  if (map.size > 0) _priceMap = map;
  // Report how many of OUR curated models matched, not the size of the
  // upstream catalog (which has hundreds).
  let matched = 0;
  for (const m of BENCHMARK_MODELS) if (map.has(m.id)) matched++;
  return { matched, total: BENCHMARK_MODELS.length };
}

function priceFor(id) {
  const p = _priceMap.get(id);
  if (!p) return null;
  // Convert per-token prices to per-million-token (the unit OpenRouter and
  // others quote in) for the price chip; pre-compute the est-per-run so
  // the frontend doesn't have to.
  const promptUsdPerMTok = p.promptUsdPerTok * 1_000_000;
  const completionUsdPerMTok = p.completionUsdPerTok * 1_000_000;
  const estPerRunUsd =
    p.promptUsdPerTok * EST_INPUT_TOKENS +
    p.completionUsdPerTok * EST_OUTPUT_TOKENS;
  return { promptUsdPerMTok, completionUsdPerMTok, estPerRunUsd };
}

export function listBenchmarkModels() {
  return BENCHMARK_MODELS.map((m) => {
    const pricing = priceFor(m.id);
    return pricing ? { ...m, pricing } : { ...m };
  });
}

const OPENROUTER_URL = 'https://openrouter.ai/api/v1/chat/completions';

// Bias each model toward terse, slider-friendly OpenSCAD. Matches the
// conventions documented in .claude/openscad-prompting.md so all models
// produce comparable artifacts.
export const BENCHMARK_SYSTEM_PROMPT = `You are an OpenSCAD code generator for a parametric CAD viewer.

Respond with a SINGLE OpenSCAD source file and absolutely nothing else — no prose, no markdown fences, no explanations. The file must compile in OpenSCAD WASM (Manifold backend).

Plan before you code. Open the file with a short comment block (using //) that lists the major parts of the object and where each part sits relative to the origin. Comments are part of valid OpenSCAD so this does not violate the "no prose" rule. Treat this header as your scratchpad: thinking through the geometry first dramatically reduces the chance of writing nonsense.

Example header:
  // Parts:
  //   base   short cylinder, z = 0 to 6
  //   stem   cone narrowing upward, z = 6 to 30
  //   head   sphere, z = 35
  // Build standing upright from the ground up.

Conventions:
- Put every tunable parameter declaration ("name = number;") at the TOP of the file, BEFORE the first module or function definition. Use full descriptive snake_case names (e.g. mug_height, not h).
- Annotate sliders with trailing comments: "// [min:step:max]" or "// [min:max]" (step defaults to 1). Use realistic mm units.
- Group related params with /* [Group Name] */ on its own line.
- Keep $fn at 24–40 at the file level.
- Prefer linear_extrude(offset(square(...))) for rounded boxes. Avoid hull() of more than 4 primitives at large coordinates and avoid minkowski().
- Build with +Z as up. The preview auto-rotates around the Z axis, so the object should stand upright; tilted geometry looks broken in stills.
- Center the geometry horizontally on the origin and sit it on z = 0 (do not center it vertically through the origin). The auto-rotating camera frames better when the object rests on the implicit floor.

Choosing primitives for the geometry:
- For axially symmetric shapes (vases, bottles, lamps, the body of a chess piece): use rotate_extrude() of a 2D polygon profile. This is the single most useful pattern for organic shapes and almost always beats hand-built CSG.
- For figural shapes (snowmen, mushrooms, full chess pieces): build the body as a stack of sphere / cylinder / cone primitives inside a union { }, then add asymmetric features on top of that body.
- Avoid linear_extrude of a 2D silhouette for organic shapes. It produces a flat cookie-cutter, which is almost never what the user wants.
- Avoid hand-authored polyhedron(points, faces). Easy to flip a face normal and end up with non-manifold geometry. Stick to CSG (union / difference / intersection) of primitives and extrusions.

Worked examples (study the structure, do not copy these objects literally):

Vase via rotate_extrude of a profile:
  // Parts:
  //   profile  2D polygon in the XZ plane
  //   body     full revolution of profile around the Z axis
  vase_height = 120;   // [60:1:200]
  vase_radius = 30;    // [10:1:80]
  $fn = 36;
  rotate_extrude()
    polygon([
      [0, 0],
      [vase_radius, 0],
      [vase_radius * 0.6, vase_height * 0.4],
      [vase_radius * 0.9, vase_height * 0.7],
      [vase_radius * 0.5, vase_height],
      [0, vase_height],
    ]);

Snowman via stacked spheres plus a cone for the nose:
  // Parts:
  //   bottom_ball  sphere at z = bottom_radius
  //   middle_ball  sphere stacked on top
  //   head_ball    sphere stacked on top
  //   nose_cone    cone pointing +Y from the head
  bottom_radius = 30;  // [10:1:60]
  middle_radius = 22;  // [8:1:50]
  head_radius   = 16;  // [6:1:40]
  $fn = 32;
  middle_z = bottom_radius * 2 + middle_radius;
  head_z   = bottom_radius * 2 + middle_radius * 2 + head_radius;
  union() {
    translate([0, 0, bottom_radius]) sphere(bottom_radius);
    translate([0, 0, middle_z])      sphere(middle_radius);
    translate([0, 0, head_z])        sphere(head_radius);
    translate([0, 0, head_z]) rotate([-90, 0, 0])
      cylinder(h = head_radius * 1.5, r1 = 3, r2 = 0);
  }

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
          // OpenRouter can deliver a per-provider 5xx as a regular SSE
          // chunk with `choices: []` and an `error:` field, then keep
          // trickling empty deltas. Without this check the stream ends
          // "cleanly" with a few-token fragment, and OpenSCAD blames the
          // model for invalid source.
          if (json?.error) {
            const provider = json?.provider ? ` (${json.provider})` : '';
            const code = json.error.code ?? '?';
            const msg = json.error.message ?? 'unknown error';
            throw new Error(`Upstream error${provider}: ${code} ${msg}`);
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
