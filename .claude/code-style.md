# Code style

Project uses ESLint + Prettier + `prettier-plugin-tailwindcss`. Husky +
lint-staged enforce on commit. When in doubt, run `npm run format` and
`npm run lint`.

## TypeScript

- 2-space indent, semicolons required, single quotes, max line ~100 chars.
- `camelCase` for variables and functions, `PascalCase` for components,
  classes, interfaces, and types.
- Avoid `any`. Use `unknown` + narrowing if you can't name a type yet.
- Path aliases: `@/...` → `src/...`, `@shared/...` → `shared/...`.
  Use them; don't write deep relative imports.

## React

- Functional components. Component file name = component name + `.tsx`.
- Props interface: `<ComponentName>Props`.
- One default export per component file (matches existing pattern).

## Imports

Order, with a blank line between groups:

1. `react` / `react-dom`
2. External libraries (alphabetical-ish)
3. `@/components/...`
4. `@/hooks/...`
5. `@/contexts/...`, `@/services/...`
6. `@/utils/...`, `@/lib/...`
7. `@/types/...`, `@shared/...`
8. Styles / assets

Prettier handles most formatting; don't fight it.

## Comments

- Comment **why**, not **what**. The mock layer in `src/lib/supabase.ts` is
  a good model — it explains intent, not syntax.
- No commented-out code in commits.

## Commands

```bash
npm run dev         # vite
npm run bridge      # node bridge/server.mjs (run in a second terminal)
npm run typecheck   # tsc -b --noEmit
npm run lint        # eslint (skips supabase/)
npm run format      # prettier
npm run build       # tsc -b && vite build
```

Always run `npm run typecheck` after touching types or `shared/`.
Don't run any `supabase ...` CLI commands — the backend is mocked.
