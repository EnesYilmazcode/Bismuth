# Frontend conventions

Stack: React 19 + TypeScript + Vite + Tailwind + Radix/shadcn + R3F (Three.js)
+ React Query. See `package.json` for exact versions.

## Layout (`src/`)

- `views/` — page-level components (one per route).
- `components/` — reusable UI, organised by domain:
  `ui/` (base shadcn-style), `chat/`, `parameter/`, `viewer/`, `history/`.
- `contexts/` — React contexts (`AuthContext`, `BlobContext`, `ColorContext`,
  `CurrentMessageContext`, `SelectedItemsContext`, `ConversationContext`).
- `hooks/` — custom hooks (`useOpenSCAD`, `useItemSelection`, `useToast`, ...).
- `services/` — React Query mutations/queries that call `supabase` (the mock).
  `conversationService.ts`, `messageService.ts`.
- `lib/supabase.ts` — the mock client. Treat as live infrastructure.
- `utils/` — pure helpers (`file-utils`, `parameterUtils`, `downloadUtils`).
- `types/misc.ts` — local types. Cross-environment types live in `shared/`.
- `worker/` — OpenSCAD WASM web worker.
- `config/`, `constants/`, `vendor/`, `assets/` — self-explanatory.

## State

- **Server-ish state** → React Query. Configured in `src/main.tsx`.
  Services already encapsulate the query keys; reuse them.
- **Global app state** → Context (auth, current conversation, selection,
  rendered blob, model colour).
- **Local state** → `useState` / `useReducer`. Don't lift unless you have to.

## Components

- Functional components only. Hooks for everything.
- Props interface named `<Component>Props`.
- File name matches component: `MyThing.tsx` exports `MyThing`.
- Prefer composition + Radix primitives over hand-rolled accessibility.
- Use `useMemo` / `useCallback` only when there's a concrete reason
  (referential equality crossing memo boundary, or measurable cost).

## Styling

- Tailwind utility classes. shadcn/ui patterns for primitives.
- Project-specific tokens live in `tailwind.config.js` — check there before
  inventing colours / spacings.
- `clsx` + `tailwind-merge` (`cn()` helper) for conditional classes.
- Custom global CSS in `src/index.css` (sparingly).

## 3D / OpenSCAD

- Three.js via `@react-three/fiber`. Always clean up resources on unmount.
- OpenSCAD compilation runs in `src/worker/` (WASM). Never block the main
  thread with it. Handle compile errors → toast + keep last good model.

## Routes & errors

- Routes in `src/main.tsx`. Wrap with error boundaries; surface failures via
  `sonner` toasts (`useToast`).
