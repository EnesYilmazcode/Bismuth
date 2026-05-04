# CADAM — local "Claude is the model" fork

This is a fork of [CADAM](https://github.com/Adam-CAD/CADAM) (text-to-CAD web app) with the entire backend stripped out and replaced by a tiny local bridge that hands prompts to **Claude Code itself** as the model.

There is no real Anthropic API key, no real Supabase project, no Docker. The user types a prompt in the browser; the bridge writes the prompt to a file; Claude (in the running Claude Code session) reads it and writes OpenSCAD back; the bridge streams the response to the frontend; the OpenSCAD WASM viewer renders it.

## Architecture

```
Browser  ──fetch──▶  Bridge (Node.js, :8765)  ──file──▶  bridge/inbox/<id>.json
   ▲                                                              │
   │                                                              ▼
   │                                                         Claude Code
   │                                                              │
   │                                                              ▼
   └────stream JSON────  Bridge  ◀──file──  bridge/outbox/<id>.json
```

## Pieces

- `bridge/server.mjs` — Mocks the Supabase Edge Functions CADAM expects:
  `parametric-chat`, `creative-chat`, `mesh`, `title-generator`, `billing-status`,
  PostHog, Stripe stubs. The two chat endpoints are the interesting ones — they
  log `PROMPT id=<id> ...` to stdout (so Claude's `Monitor` sees them), write
  `bridge/inbox/<id>.json` with the full conversation context, and poll
  `bridge/outbox/<id>.json` for the reply.
- `bridge/parseParameter.mjs` — Port of the original `_shared/parseParameter.ts`
  so artifacts get parameter sliders.
- `src/lib/supabase.ts` — Drop-in replacement for `@supabase/supabase-js`.
  Auth always returns a fake user, tables are in localStorage, realtime is a
  no-op, storage keeps blobs in memory, `functions.invoke()` forwards to the
  bridge.
- `src/services/messageService.ts` — Lightly patched so the chat fetch sends
  the prompt + history in the body (the bridge has no shared DB to read from).

## Run it

```bash
npm install
npm run bridge   # terminal 1: bridge on :8765
npm run dev      # terminal 2: vite on :3000 (or :3001)
# open http://localhost:3000/cadam/  (or 3001)
```

In Claude Code:

1. Set up a `Monitor` watching the bridge log for `PROMPT id=` lines.
2. When a notification fires, read `bridge/inbox/<id>.json` for context.
3. Generate OpenSCAD code.
4. Write `bridge/outbox/<id>.json` with `{"title": "...", "text": "...", "code": "..."}`.

The bridge will pick it up within ~200ms and stream the artifact back.

### Reply file shape

```json
{
  "title": "Coffee Mug",          // shown in the artifact header
  "text":  "Here's the mug.",     // optional chat reply
  "code":  "// OpenSCAD\nh=80;\ncylinder(h=h, r=30);\n"
}
```

The bridge runs `parseParameters(code)` over the OpenSCAD so any `name = number;` declaration at the top of the file becomes an interactive slider. Add comments for ranges:

```scad
// Mug height
mug_height = 80;       // [40:1:200]   min:step:max
mug_radius = 30;       // [10:50]      min:max
wall_thickness = 2.5;
```

## What works / what doesn't

**Works:**
- Parametric mode end-to-end (text → OpenSCAD → 3D viewer with parameter sliders)
- Conversation history / multi-turn chat (in-browser localStorage)
- The export / file download pipeline (STL, SCAD, DXF) — runs entirely client-side

**Doesn't:**
- Creative mode (mesh generation via Replicate / image diffusion) — bridge stub returns 501
- Image-input prompts — files are kept in browser memory but not forwarded to Claude
- Anything that needs real Supabase auth (sharing a conversation by URL, etc.)

## Resetting state

Conversation history lives in `localStorage['cadam-mock-db-v1']`. Clear it from devtools to start fresh. `bridge/inbox/` and `bridge/processed/` accumulate request files — safe to delete at any time.

## Project-specific instructions

See `.claude/` for per-area rules (architecture, editing rules, frontend conventions, code style).
