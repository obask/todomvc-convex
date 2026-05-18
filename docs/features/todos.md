# Todos

**What:** Per-user TodoMVC list with add, double-click-to-edit, toggle, toggle-all, delete, clear-completed, and All/Active/Completed filtering via URL hash. Sign in with email + password or tap "Continue without an account" to use the `Anonymous` provider; either way you get a real user row and a JWT. All six mutations apply optimistically via `convex-solidjs` `createMutation(...).withOptimisticUpdate`. First-load and error states render via Solid 2's `<Loading>` and `<Errored>` boundaries.

**Where:**
- [convex/auth.ts](../../convex/auth.ts) — `convexAuth({ providers: [Password, Anonymous] })`.
- [convex/schema.ts](../../convex/schema.ts) — `todos` table indexed by `userId`; auth tables from `authTables`.
- [convex/todos.ts](../../convex/todos.ts) — `list`, `create`, `setCompleted`, `rename`, `remove`, `toggleAll`, `clearCompleted`, `viewer`. All scope by `getAuthUserId(ctx)`; never accept a userId arg.
- [src/auth/solid.tsx](../../src/auth/solid.tsx) — Solid 2.0 port of `@convex-dev/auth/react/client`: `ConvexAuthProvider`, `useAuthActions`, `useConvexAuth`, `useAuthToken`, `Authenticated`/`Unauthenticated`/`AuthLoading`.
- `convex-solidjs` — Solid 2 Convex adapter: `ConvexProvider`, `setupConvex`, `createQuery`, `createMutation`, `createConvexAction`, `createConnectionState`.
- [src/App.tsx](../../src/App.tsx) — `App`, `SignOutButton`, `SignInForm` (password + flow toggle + "Continue without an account"), `TodoApp` with all six mutations using optimistic updates.
- [src/main.tsx](../../src/main.tsx) — single `ConvexAuthProvider` wrap (owns both the Convex and auth contexts).
