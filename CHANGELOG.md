# Changelog

All notable changes to Bismuth are recorded here. Format roughly follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and dates use
ISO-8601 (UTC).

## [Unreleased]

### Added
- Copy-to-clipboard button on the assistant streaming code block.
- "Modified from default" indicator dot next to changed parameters; clicking
  the dot resets that single parameter without disturbing the rest.
- Compile-duration indicator in the lower-left of the 3D viewer (shows ms / s
  for the most recent OpenSCAD WASM run).
- 3D viewer toolbar: Iso/Front/Top/Right camera presets, toggleable grid +
  axes overlay, dark/studio/light background cycle, snapshot-to-PNG button.
- Conversation pinning: list-view "Pinned" section, visual-grid float-to-front,
  star indicator, persisted in localStorage.
- Conversation duplication that clones the source row + all its messages with
  fresh IDs and a remapped message tree.
- `Cmd/Ctrl+K` focuses the history search box; `?` opens a global keyboard
  shortcuts dialog.
- Bridge-status pill in the sidebar that polls `/health` every 5 s.
- Bridge `GET /stats` endpoint reporting prompt counts, queue depth, and the
  last prompt seen; surfaced in a `?debug=1` overlay panel.
- Parameter system: save/load named presets backed by localStorage, "Copy
  values as JSON" action, and rendering of `/* [Group Name] */` SCAD comment
  groups as nested collapsibles.
- `npm run e2e` aggregate script that chains the three bridge smoke tests.

### Changed
- Chat error messages: failures from a missing/unreachable bridge now name
  the fix (`npm run bridge`) and tell the user where it should be running,
  rather than the generic "an error occurred" string.

## [0.1.0] — 2026-05-04

First public release. Forked from [CADAM](https://github.com/Adam-CAD/CADAM)
(GPL-3.0) and rewired so the model is whatever Claude Code session is
running with the project as its working directory — no Anthropic API key,
no Supabase project, no Docker.

### Added
- Local bridge HTTP server (`bridge/server.mjs`) that mocks the original
  Supabase Edge Functions. Chat requests get written to
  `bridge/inbox/<id>.json`; replies are read from `bridge/outbox/<id>.json`.
- In-browser drop-in replacement for `@supabase/supabase-js`
  (`src/lib/supabase.ts`): fake auth, in-memory tables backed by
  localStorage, IndexedDB-backed storage, no-op realtime.
- `.claude/` directory with per-area rules for the editing agent
  (architecture, editing rules, frontend conventions, code style).
- Puppeteer-driven smoke tests in `bridge/e2e*.mjs`.
- Persistent slider state — drag a parameter, hit refresh, the value sticks.
- Image-upload persistence across page reloads via IndexedDB.
- Comprehensive `.gitignore`, OG/Twitter meta tags, GPL-3.0 license entry.

### Changed
- Rebranded entirely to Bismuth: page title, sidebar logo, chat avatar,
  prompt placeholders, default artifact title, error copy. Filenames for
  logo SVGs were intentionally preserved to avoid touching every callsite.
- URL base path migrated from `/cadam/` to `/bismuth/`.
- Title generator reads the user's prompt instead of returning a hardcoded
  string, so each conversation gets a distinct sidebar entry.
- Streamed assistant messages now persist to the mock store, so a parameter
  slider drag (which invalidates the messages query) no longer wipes the
  artifact off the screen.
- HistoryView resolves Postgrest-style embedded selects manually so the
  conversation list shows real previews and message counts.

### Removed
- Original Supabase Edge Functions (entire `supabase/` directory): replaced
  by the bridge.
- Stripe / billing UI surfaces (TrialDialog wiring, upgrade modals visible
  in chat surfaces).
- PostHog analytics (`src/lib/posthog.ts`, every `posthog.capture` callsite,
  the package itself).
- Sentry sourcemap upload (`@sentry/vite-plugin`); the runtime SDK stays
  installed but `Sentry.init` no-ops when no DSN is set.
- Vercel deployment config (`vercel.json`).
- Upstream marketing assets (`Github-Banner-{Dark,Light}.png`, the three
  upstream `screenshot-N.jpeg` files, `adam-icon.ico`, `Adam-Logo.png`).
- GitHub / Discord / "Local User" sidebar elements that were specific to
  the SaaS deployment.

### Known limitations
- Creative mode (mesh generation via Replicate) is not wired locally;
  the bridge stub returns 501.
- Image-input prompts: files persist in the browser but aren't forwarded
  to the Claude session.
- Anything that needed real Supabase auth — sharing-by-URL, multi-user
  features — is non-functional in local mode.
