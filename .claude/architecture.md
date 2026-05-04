# Architecture: local "Claude is the model" fork

This is a fork of CADAM. The original Supabase + Anthropic + Replicate backend
is **gone at runtime**. In this repo, Claude Code itself is the model behind
the chat. See `CLAUDE.md` at the repo root for the full picture.

## Runtime topology

```
Browser (Vite :3000)
   └─ src/lib/supabase.ts   ← in-browser fake Supabase client
        ├─ auth/from/storage/channel  → localStorage + memory, no network
        └─ functions.invoke(name, body) → POST http://127.0.0.1:8765/functions/v1/<name>

Bridge (Node :8765, bridge/server.mjs)
   ├─ /functions/v1/parametric-chat, /creative-chat   → write inbox/<id>.json,
   │                                                     wait for outbox/<id>.json
   ├─ /functions/v1/title-generator, /mesh, /billing-status, etc.  → stubs
   └─ logs `PROMPT id=<id> ...` to stdout (Monitor target)

Claude Code (you)
   └─ reads bridge/inbox/<id>.json, writes bridge/outbox/<id>.json
```

## Key files

- `bridge/server.mjs` — HTTP server, inbox/outbox file dance, all stub endpoints.
- `bridge/parseParameter.mjs` — port of `supabase/functions/_shared/parseParameter.ts`.
- `src/lib/supabase.ts` — fake `@supabase/supabase-js`. localStorage table
  store under key `cadam-mock-db-v1`. `functions.invoke()` forwards to the
  bridge.
- `src/services/messageService.ts` — patched so the chat fetch sends the full
  prompt + history in the body (the bridge has no DB).

## Reply file shape (you write this)

```json
{
  "title": "Coffee Mug",
  "text":  "Optional chat reply.",
  "code":  "// OpenSCAD\nh=80;\ncylinder(h=h, r=30);\n"
}
```

`parseParameters(code)` runs in the bridge. Top-level `name = number;` lines
become parameter sliders; annotate with `// [min:step:max]` or `// [min:max]`
comments to constrain ranges.

## What works / doesn't

Works: parametric mode end-to-end, multi-turn chat (localStorage),
client-side STL/SCAD/DXF export.

Doesn't: creative mode (mesh/Replicate — bridge returns 501), image-input
prompts, anything needing real Supabase auth (URL-shared conversations).

## State reset

- Conversation history: clear `localStorage['cadam-mock-db-v1']` in devtools.
- File queues: `bridge/inbox/`, `bridge/outbox/`, `bridge/processed/` are all
  safe to delete.
