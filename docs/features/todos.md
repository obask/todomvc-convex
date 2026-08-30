# Todos

**What:** Per-user TodoMVC list with add, double-click-to-edit, toggle, toggle-all, delete, clear-completed, and All/Active/Completed filtering via URL hash. Sign in with email + password or tap "Continue without an account" to use the `Anonymous` provider; either way you get a real user row and a JWT. All six mutations apply optimistically via the external `convex-preact` adapter's `useMutation(...).withOptimisticUpdate`. First-load state renders by branching on `useQuery(...).value === undefined`.

**Where:**
- [convex/auth.ts](../../convex/auth.ts) — `convexAuth({ providers: [Password, Anonymous] })`.
- [convex/schema.ts](../../convex/schema.ts) — `todos` table indexed by `userId`; auth tables from `authTables`.
- [convex/todos.ts](../../convex/todos.ts) — `list`, `create`, `setCompleted`, `rename`, `remove`, `toggleAll`, `clearCompleted`, `viewer`. All scope by `getAuthUserId(ctx)`; never accept a userId arg.
- [`convex-preact`](https://github.com/obask/convex-preact) — external Preact + signals adapter for Convex (pinned at `https://github.com/obask/convex-preact.git#dist`): `ConvexProvider`, `useConvex`, `useQuery`, `useQueryWithStatus`, `useMutation` (with `.withOptimisticUpdate`), `useConvexAction`, `useConnectionState`.
- [src/auth/preact.tsx](../../src/auth/preact.tsx) — Preact port of `@convex-dev/auth/react/client`: `ConvexAuthProvider`, `useAuthActions`, `useConvexAuth`, `useAuthToken`, `Authenticated`/`Unauthenticated`/`AuthLoading`.
- [src/App.tsx](../../src/App.tsx) — `App`, `SignOutButton`, `SignInForm` (password + flow toggle + "Continue without an account"), `TodoApp` with all six mutations using optimistic updates.
- [src/main.tsx](../../src/main.tsx) — single `ConvexAuthProvider` wrap (owns both the Convex and auth contexts).
