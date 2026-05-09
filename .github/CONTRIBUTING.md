# Contributing to Bismuth

Thanks for your interest! Bismuth is a small project — issues and PRs go through [GitHub Issues](https://github.com/EnesYilmazcode/Bismuth/issues) and pull requests on the same repo.

For non-trivial changes, please open an issue first so we can talk through the approach before you sink time into a PR.

## Areas where help is especially welcome

- **OpenSCAD prompt patterns** — examples in `.claude/` and the README that help Claude generate cleaner, more parametric models (better use of BOSL2, smarter default ranges, idiomatic module structure).
- **Persistence improvements** — the mock Supabase layer (`src/lib/supabase.ts`) keeps everything in `localStorage` / IndexedDB. There's room for migration handling, export/import of conversation history, and richer artifact storage.
- **Bridge robustness** — better error surfaces when Claude isn't watching, retry / cancel UX, optional structured logging.
- **Tests** — the `bridge/e2e*.mjs` smoke tests are a starting point; more coverage of slider re-parse, multi-turn flows, and export pipelines would be great.

## Pull request process

1. Fork the repo and branch from `main`.
2. Make your changes. Run `npm run lint` and `npm run typecheck` before pushing.
3. Open a PR against `main`. Describe the change and link any related issue.
4. Allow edits from maintainers — speeds up review.

## Style

We try to follow [Clean Code](https://www.oreilly.com/library/view/clean-code-a/9780136083238/) and the Boy Scout Rule:

> Leave the code cleaner, not messier, than how you found it.

Per-area conventions live in `.claude/` (architecture, editing rules, frontend conventions, code style) — those are written for Claude but they're equally useful for humans.

## Code of conduct

Please follow the [Code of Conduct](CODE_OF_CONDUCT.md) in all project interactions.
