# Solid 2.0 + Convex Adapter Notes

Reference for the adapter at [src/convex/solid.tsx](../src/convex/solid.tsx).
Source: `node_modules/solid-js/CHEATSHEET.md` and `node_modules/convex/dist/esm-types/` (browser + react).

## Solid 2.0 idioms that shape the adapter

- **`createEffect(compute, apply)` is the only form.** Compute tracks reactive reads; apply runs side effects and may return a cleanup. We use it everywhere we bridge a Convex subscription: compute = args, apply = `onUpdate` + return unsubscribe.
- **Setters flush on the microtask.** Reading right after `setX(v)` returns the previous value until `flush()` or the next tick. Adapter writes are always inside the apply phase, so this doesn't bite us.
- **Writes inside owned scopes throw in dev.** The mutation `pending` counter signal is created with `{ ownedWrite: true }` so the mutation callable can decrement it from anywhere.
- **Props are values, not accessors.** Adapter consumers pass `() => args` to `createConvexQuery` (an explicit Accessor), but children of `Authenticated`/`Unauthenticated` are passed as raw `JSX.Element` — same as `<Show>`.
- **Removed primitives we'd otherwise reach for:** `from()`, `createResource`, `batch`, `Suspense`, `ErrorBoundary`, `mergeProps`/`splitProps`. Replacements: signal+effect for live subscriptions, `<Loading>` / `<Errored>`, `merge` / `omit`.
- **Context provider syntax:** `<Ctx value={...}>` — no `.Provider`. `useContext` on a default-less context throws if missing; no `useFooOrThrow` wrapper needed.
- **JSX import source** is `@solidjs/web` (set in `tsconfig.app.json`); `solid-js` is renderer-neutral. `JSX` type comes from `@solidjs/web`.
- **`class={[...]}` array/object form** replaces template strings and the old `classList` prop. Used in App.tsx for conditional classes.

## Convex React adapter surface (parity target)

From `node_modules/convex/dist/esm-types/react/`. ✓ = ported to Solid, ✗ = intentionally skipped (core-parity scope).

| React API | Solid equivalent | Notes |
| --- | --- | --- |
| `ConvexProvider` / `useConvex` | `ConvexProvider` / `useConvex` ✓ | |
| `useQuery(q, args \| "skip")` | `createConvexQuery(q, () => args \| "skip")` ✓ | Primes via `Unsubscribe.getCurrentValue()`. Suspends via `NotReadyError` (catch with `<Loading>`); errors propagate on read (catch with `<Errored>`). With `"skip"` returns `undefined` without suspending. |
| `useMutation(m)` → `ReactMutation` | `createConvexMutation(m)` → `ConvexMutation` ✓ | `.withOptimisticUpdate(fn)` returns a new bound callable; `pending: Accessor<boolean>`. |
| `useAction(a)` | `createConvexAction(a)` ✓ | `pending` accessor; no optimistic updates. |
| `useConvexAuth()` from `convex/react` | `useConvexAuth()` from `src/auth/solid.tsx` ✓ | Provided by the port of `@convex-dev/auth/react/client` (not by the protocol adapter). |
| `Authenticated` / `Unauthenticated` / `AuthLoading` | same names ✓ in `src/auth/solid.tsx` | `<Show>`-based. |
| `useConvexConnectionState()` | `createConvexConnectionState()` ✓ | Seeded synchronously from `client.connectionState()`. |
| `useQueries(record)` | — ✗ | Skip-token + multiple `createConvexQuery` calls covers most cases. |
| `usePaginatedQuery(q, args, {initialNumItems})` | — ✗ | Out of core scope; `client.onPaginatedUpdate_experimental` is available if needed. |
| `usePreloadedQuery(preloaded)` | — ✗ | Out of core scope (SSR/server-component story). |
| `ConvexAuthProvider` / `useAuthActions` / `useAuthToken` (`@convex-dev/auth/react`) | same names ✓ in `src/auth/solid.tsx` | Solid 2.0 port of the React client. Trimmed: no SSR `serverState`, no OAuth `?code=` handling, no cross-tab storage sync, no manual-mutex fallback. ~120 lines vs ~376. |

## Underlying client capabilities used

The adapter targets `ConvexClient` from `convex/browser` (not `ConvexReactClient`):

- `onUpdate(query, args, cb)` → `Unsubscribe` with `.getCurrentValue()`.
- `mutation(m, args, { optimisticUpdate })` — `MutationOptions.optimisticUpdate: OptimisticUpdate<any>` is supported here, so we don't need the React-specific client.
- `action(a, args)`.
- `setAuth(fetchToken, onChange)`.
- `connectionState()` / `subscribeToConnectionState(cb)`.
- `onPaginatedUpdate_experimental` (unused, available for future pagination).

`OptimisticLocalStore` exposes `getQuery`, `getAllQueries`, `setQuery(query, args, value | undefined)` — same shape as the React docs describe.

## Pitfalls hit during the port

- **Resist `createResource`/`from()` reflexes** — neither exists in 2.0. A live subscription is just `createSignal` + `createEffect(args, apply)`.
- **Don't read props at the top of a component body** — wrap in JSX, a memo, or `untrack`. The auth control-flow components read `auth.isLoading()` inside the `<Show when={...}>` expression for this reason.
- **`setValue(next)` vs `setValue(() => next)`** — when query results can be functions (rare), always use the updater form to avoid the setter treating the value as a reducer. The adapter consistently uses `setValue(() => v)`.
