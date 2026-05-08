# Bismuth

**Text-to-CAD that runs in your browser, with Claude Code as the model.**

[![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat)](https://www.gnu.org/licenses/gpl-3.0)
[![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg?style=flat&logo=node.js&logoColor=white)](https://nodejs.org/)
[![React](https://img.shields.io/badge/React-19.1-61DAFB.svg?style=flat&logo=react&logoColor=black)](https://reactjs.org/)
[![Vite](https://img.shields.io/badge/Vite-5-646CFF.svg?style=flat&logo=vite&logoColor=white)](https://vitejs.dev/)
[![OpenSCAD](https://img.shields.io/badge/OpenSCAD-WASM-F9D64F.svg?style=flat)](https://openscad.org/)
[![Local-only](https://img.shields.io/badge/runtime-local%20only-blueviolet?style=flat)](#what-it-is)
[![Stars](https://img.shields.io/github/stars/EnesYilmazcode/Bismuth?style=flat&logo=github)](https://github.com/EnesYilmazcode/Bismuth/stargazers)

![Bismuth — table with rubber duck and a procedurally-generated maze, all live-editable via parameter sliders](./public/bismuth-hero.png)

## what it is

Bismuth is a text-to-CAD web app. You describe a 3D model in plain English, the model returns OpenSCAD source, the browser compiles it with [OpenSCAD WASM](https://github.com/openscad/openscad-wasm), and you get a live 3D preview plus interactive parameter sliders for every dimension. STL / SCAD / DXF export is one click away — everything runs client-side.

It's a fork of [CADAM](https://github.com/Adam-CAD/CADAM) (GPL-3.0) with the entire SaaS backend (Supabase, Stripe, Anthropic API, Replicate, ngrok) ripped out and replaced by a tiny local bridge that hands prompts to **Claude Code itself** as the model. No API keys, no Docker, no cloud account — just Node and your existing Claude Code session.

## architecture

```
                                                           inbox/<id>.json
Browser  ──fetch──▶  Vite dev server  ──▶  Mock Supabase  ──────────────▶  Bridge HTTP server
   ▲                  (:3000)              (in-browser,         (Node, :8765)        │
   │                                       src/lib/supabase.ts)                      │
   │                                                                                 ▼
   │                                                                       bridge/inbox/<id>.json
   │                                                                                 │
   │                                                                                 ▼
   │                                                                            Claude Code
   │                                                                          (your session,
   │                                                                           watching inbox/)
   │                                                                                 │
   │                                                                                 ▼
   └────── streamed JSON ◀────── Bridge ◀────── poll ◀────── bridge/outbox/<id>.json
```

The bridge mocks the Supabase Edge Functions the original CADAM frontend expects (`parametric-chat`, `creative-chat`, `title-generator`, `billing-status`, plus PostHog and Stripe stubs). When a prompt comes in, the chat endpoint writes the full conversation context to `bridge/inbox/<id>.json` and polls `bridge/outbox/<id>.json` for a reply. Claude — running in your Claude Code session pointed at this repo — picks up the inbox file, generates OpenSCAD, and writes the outbox file. The bridge picks it up within ~200ms and streams it back to the browser.

## why this exists

CAD apps that wrap LLMs charge per prompt. If you already pay for a Claude Code subscription, that's a perfectly good model sitting right there. Bismuth lets you point that subscription at a real text-to-CAD frontend with no API keys, no metering, and no cloud round-trips. It's also a useful playground for prompt patterns — the OpenSCAD libraries (BOSL, BOSL2, MCAD) are bundled in `public/libraries/`, and conversation history stays on your machine.

## quick start

```bash
npm install

# terminal 1 — bridge on :8765
npm run bridge

# terminal 2 — vite on :3000 (or :3001 if 3000 is busy)
npm run dev

# open http://localhost:3000/bismuth/
```

That gets the UI running. **Prompts will hang forever until a Claude Code session is watching the inbox** — there's no fallback model. To wire that up:

1. Open this repo in Claude Code (`claude` from the project root, or attach via your editor integration). The working directory is the only thing that matters; the `.claude/` folder already contains the per-area rules Claude needs (architecture, editing rules, frontend conventions, code style).
2. Tell Claude something like: *"Watch `bridge/server.mjs`'s stdout for `PROMPT id=` lines. When one fires, read `bridge/inbox/<id>.json`, generate OpenSCAD, and write `bridge/outbox/<id>.json`."* Claude can use its `Monitor` tool on the bridge log to get push notifications.
3. Type a prompt in the browser. Claude sees it, replies, the artifact renders.

If you need to reset state, conversation history is in `localStorage['cadam-mock-db-v1']`, and `bridge/inbox/`, `bridge/outbox/`, `bridge/processed/` are safe to delete at any time.

## how Claude responds to prompts

The bridge speaks a simple file protocol. For each request, Claude reads `bridge/inbox/<id>.json` (which contains the prompt, conversation history, and current artifact) and writes a reply to `bridge/outbox/<id>.json` shaped like this:

```json
{
  "title": "Coffee Mug",
  "text":  "Here's the mug. Wall thickness is 3mm by default.",
  "code":  "// OpenSCAD\nmug_height = 100;     // [40:1:200]\nmug_radius = 35;      // [10:1:80]\nwall = 3;             // [1:0.5:8]\ndifference() {\n  cylinder(h=mug_height, r=mug_radius, $fn=64);\n  translate([0,0,wall]) cylinder(h=mug_height, r=mug_radius-wall, $fn=64);\n}\n"
}
```

`title` shows in the artifact header, `text` is an optional chat reply, `code` is OpenSCAD. The bridge runs `parseParameters(code)` over the source so any top-level `name = number;` declaration becomes an interactive slider. Trailing comments control the slider range:

```scad
mug_height = 100;     // [40:1:200]   min:step:max
mug_radius = 35;      // [10:80]      min:max  (step defaults to 1)
wall = 3;             // [1:0.5:8]    floats are fine
```

When the user drags a slider, the bridge re-parses without round-tripping through the model.

## what works / what doesn't

**Works**
- Parametric mode end-to-end (text -> OpenSCAD -> 3D viewer with live sliders)
- Multi-turn chat — full conversation context is forwarded each turn
- STL / SCAD / DXF export, all client-side
- Conversation history persisted to `localStorage`
- Uploaded images persisted across reloads via IndexedDB
- Benchmark mode at `/benchmark` — see below.

**Doesn't**
- Creative / mesh-generation mode (the original CADAM Replicate path) — bridge stub returns 501
- Image-input prompts — files stay in browser memory but aren't forwarded to Claude
- Anything needing real Supabase auth: sharing-by-URL, multi-user features, the Stripe billing flow

## benchmark mode

`/benchmark` runs one prompt against several AI models in parallel via
[OpenRouter](https://openrouter.ai) and renders each model's OpenSCAD result
in its own auto-rotating 3D pane. Useful for "which model writes the cleanest
parametric mug?" comparisons without juggling multiple API keys yourself.

This path doesn't go through Claude Code — the bridge calls OpenRouter
directly, so it works whether or not your Claude session is watching the
inbox. The curated catalog covers Claude (Sonnet 4.5, Opus 4.1), GPT-5,
GPT-4o, o3, Gemini 2.5 Pro / 2.0 Flash, DeepSeek V3, Qwen 2.5 Coder, Llama
3.3 70B, Mistral Large, and Grok 3. Up to 6 models fit on one screen.

**Setup** — copy `.env.local.template` to `.env.local`, drop in your key, and
restart the bridge:

```bash
cp .env.local.template .env.local
# edit .env.local and set OPENROUTER_API_KEY="sk-or-..."
npm run bridge
```

Without the key, the page shows a setup card with the exact line to paste.
Get a key from [openrouter.ai/keys](https://openrouter.ai/keys); the curated
list above costs ~$0.01–0.10 per side-by-side run depending on which models
you pick.

**The UI**

- **Example prompts** — eight CAD starters appear under the input on first
  load (mug, hex bolt, gridfinity bin, lampshade, planter, phone stand,
  faceted vase, gear pair). Click one to fill the textarea.
- **Model browser** — search-as-you-type palette with vendor-grouped rows
  and one-line descriptions. Filters across name, vendor, and capability
  ("claude", "anthropic", "fast" all work). ↑↓ navigates, Enter toggles,
  Esc closes.
- **Per-pane swap** — click any pane's model name to open the palette in
  replace mode and pick a substitute in place. Grid order is preserved.
- **Tail-peek** — while a model is writing, the last few lines of streamed
  SCAD show in the bottom of its pane so you can spot stalls early.
- **Fullscreen** — hover any pane and click the corner button (or click the
  pane) to expand it; Esc dismisses.
- **Stop** — cancels every in-flight model in one click.

The wire format between the frontend and the bridge is one ND-JSON event
per line: `{model, type: 'start' | 'delta' | 'done' | 'error', ...}`.
`bridge/openrouter.mjs` owns the curated list and the system prompt that
biases each model toward valid OpenSCAD with slider-friendly parameters.

## project structure

```
.
├── bridge/             # Node bridge server + inbox/outbox/processed dirs
│   ├── server.mjs      # mocks Supabase Edge Functions, file-based prompt protocol
│   ├── parseParameter.mjs
│   └── e2e*.mjs        # Playwright-style smoke tests
├── src/                # React 19 + TypeScript + Vite frontend
│   ├── lib/supabase.ts # drop-in mock for @supabase/supabase-js
│   └── ...
├── public/             # static assets, OpenSCAD WASM, BOSL/BOSL2/MCAD libraries
├── shared/             # types/utilities shared between bridge and frontend
└── .claude/            # per-area instructions for Claude Code
```

## troubleshooting

**Port 3000 already in use.** Vite is pinned with `strictPort: true` so it
refuses to bounce to 3001/3002 (those silent shifts caused real confusion
during development). Find the offender with `netstat -ano | grep 3000` on
Windows or `lsof -i :3000` on macOS/Linux and stop it, or set
`server.port` in `vite.config.ts` to a different value.

**Page hangs or won't load after pulling new changes.** Hard refresh
(Ctrl+Shift+R / Cmd+Shift+R). The most common cause is a stale tab still
pointed at the old URL — Bismuth used to serve at `/cadam/`; it now serves
at `/bismuth/`.

**Prompt sits on "Thinking…" forever.** The bridge is waiting for a reply
file. Make sure your Claude Code session is actually watching the bridge
log for `PROMPT id=` lines and writing to `bridge/outbox/<id>.json`. The
bridge times out after 10 minutes and surfaces a `Bridge error: reply
timeout` message.

**OpenSCAD WASM stuck on "Compiling…".** Some OpenSCAD constructs are
expensive in WASM, in particular `hull()` of cylinders at large
dimensions (table-scale or bigger). Prefer `linear_extrude(offset(square))`
for rounded boxes; see `.claude/openscad-prompting.md` for the full
playbook.

**Conversation history vanished.** Open devtools → Application →
Local Storage and look for the key `cadam-mock-db-v1`. (The key still uses
the old name on purpose so existing sessions survived the rebrand. If
you cleared it, history is gone — there's no server backup.)

## credits

- Forked from [CADAM](https://github.com/Adam-CAD/CADAM) by Zach Dive, Aaron Li, Dylan Anderson — most of the frontend, the OpenSCAD viewer pipeline, and the parameter system are theirs.
- [OpenSCAD](https://github.com/openscad/openscad) and [openscad-wasm](https://github.com/openscad/openscad-wasm) for the CAD engine.
- [BOSL](https://github.com/revarbat/BOSL), [BOSL2](https://github.com/BelfrySCAD/BOSL2), and MCAD for the bundled OpenSCAD libraries.
- [openscad-web-gui](https://github.com/seasick/openscad-web-gui) — portions of the viewer derive from it.

## license

GPL-3.0. The upstream CADAM project is GPL-3.0 so any redistribution stays GPL-compatible. The bundled OpenSCAD WASM binaries are GPL v2-or-later, redistributed here as part of the combined work; see `src/vendor/openscad-wasm/SOURCE-OFFER.txt`. Full text in `LICENSE`.
