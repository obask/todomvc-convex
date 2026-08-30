# Preact + Convex Adapter Notes

This app talks to Convex through the external [`convex-preact`](https://github.com/obask/convex-preact) package, pinned at `https://github.com/obask/convex-preact.git#dist` in [package.json](../package.json). It mirrors the role of [`convex-solidjs`](https://github.com/obask/convex-solidjs) for the Solid 2 sibling.

## Surface (from `convex-preact`)

- `ConvexProvider({ client, children })` — stores the client in a Preact context.
- `useConvex()` — returns the `ConvexClient` from context.
- `useQuery(reference, args)` → `ReadonlySignal<T | undefined>`.
- `useQueryWithStatus(reference, args)` → `ReadonlySignal<{ status, data, error }>` (discriminated union).
- `useMutation(reference)` → callable with `.withOptimisticUpdate(fn)`.
- `useConvexAction(reference)` → callable wrapping `client.action`.
- `useConnectionState()` → `ReadonlySignal<ConnectionState>`.

## Why a custom adapter

There is no official `convex-preact`. The convex React adapter pulls in React; we wanted the same fine-grained reactivity Solid gave us with the smallest runtime. The package is ~150 lines, depends only on `convex`, `preact`, and `@preact/signals`, and uses real signals so updates skip virtual-DOM reconciliation.

## Preact / signals idioms that shape the adapter

- **`@preact/signals` auto-subscribes components on `.value` reads.** Components just read `signal.value` in JSX — no manual subscriber wiring.
- **`useSignal` / `useComputed`** are the component-scoped equivalents of Solid's `createSignal` / `createMemo`. Disposal is automatic.
- **No `<Show>` / `<For>`.** Plain ternaries and `.map(..., key={id})`.
- **No Suspense-style `<Loading>` / `<Errored>` boundary.** `useQuery` returns `undefined` until the first server response — components branch on `signal.value === undefined`. For explicit error states use `useQueryWithStatus`.
- **JSX import source** is `preact` (set in `tsconfig.app.json` with `"jsx": "react-jsx"`). The `JSX` namespace comes from `preact`.

## Updating

Edit the source in [`obask/convex-preact`](https://github.com/obask/convex-preact), `pnpm build`, commit the built artifacts on the `dist` branch, push. Consumer apps pick up the change on the next `pnpm install --force` or by bumping the git ref.
