# Editing rules

Hard rules about which parts of this repo are live and which are dead. Read
before making changes.

## Do NOT touch `supabase/`

- `supabase/functions/**` (Deno Edge Functions), `supabase/migrations/**`,
  `supabase/schemas/**`, `supabase/config.toml` are kept **for reference only**.
- Nothing under `supabase/` runs in this fork. Don't modify it, don't lint it,
  don't generate migrations against it, don't run `supabase` CLI commands.
- Ignore the old `.cursor` advice about `supabase db diff`, `supabase functions
  serve`, `supabase gen types`, `ngrok`, etc. — none of that applies here.

## Where backend-shaped work goes instead

When the frontend calls `supabase.functions.invoke('foo', { body })`, that
becomes `POST http://127.0.0.1:8765/functions/v1/foo`.

- New mock endpoint → add a route in `bridge/server.mjs`.
- New table or row default → extend `seed()` / `withDefaults()` in
  `src/lib/supabase.ts`.
- New storage / realtime behaviour → extend `makeStorageBucket` / `makeChannel`
  in `src/lib/supabase.ts`.
- New parametric prompt plumbing → it already flows through
  `bridge/server.mjs` (`parametric-chat` route) and `src/services/messageService.ts`.

## Dead vs. live cheatsheet

| Area                                  | Status |
| ------------------------------------- | ------ |
| `supabase/**`                         | Dead   |
| `bridge/**`                           | Live   |
| `src/lib/supabase.ts`                 | Live (mock) |
| `src/services/messageService.ts`      | Live (lightly patched) |
| `shared/database.ts`, `shared/types`  | Live (compile-time only) |
| Anything calling Replicate / PostHog / Stripe | Dead — bridge returns stubs |

## Adding stubs

If a new code path tries to hit a network endpoint that doesn't exist,
**don't** add a real integration. Add a permissive stub in `bridge/server.mjs`
that returns enough JSON to keep the UI happy. Pattern:

```js
if (url.pathname === '/functions/v1/whatever') {
  return send(res, 200, { ok: true, /* minimal shape the UI expects */ });
}
```

## Safe to modify freely

Everything under `src/` (except `src/lib/supabase.ts`, treat with care),
`bridge/server.mjs`, `bridge/parseParameter.mjs`, root config files,
`shared/`, `public/`.
