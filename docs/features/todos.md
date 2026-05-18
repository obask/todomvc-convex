# Todos

**What:** Per-session guest TodoMVC list with add, double-click-to-edit, toggle, toggle-all, delete, clear-completed, and All/Active/Completed filtering via URL hash. All six mutations apply optimistically via the Solid Convex adapter's `createConvexMutation(...).withOptimisticUpdate` so the UI updates in the same frame as user input; the Convex live query reconciles to server state. The first-load and error states render via Solid 2.0's `<Loading>` and `<Errored>` boundaries — the query accessor throws `NotReadyError` until the first result and rethrows subscription errors on read.

**Where:**
- [convex/schema.ts](../../convex/schema.ts) — `guestTodos` table indexed by `sessionId`.
- [convex/guestTodos.ts](../../convex/guestTodos.ts) — `list`, `create`, `setCompleted`, `rename`, `remove`, `toggleAll`, `clearCompleted`. All scope by the caller-supplied `sessionId` (guest mode; no auth required).
- [src/convex/solid.tsx](../../src/convex/solid.tsx) — Solid 2.0 adapter: `createConvexQuery` (with `"skip"` support and cache priming), `createConvexMutation` (with `.withOptimisticUpdate` + `pending`), `createConvexAction`, `createConvexConnectionState`, and `createConvexAuth` + `Authenticated`/`Unauthenticated`/`AuthLoading`.
- [src/App.tsx](../../src/App.tsx) — `TodoApp`, `NewTodoInput`, `TodoItem`, `Footer`, `createHashFilter`. `setCompleted` is wired with an optimistic update over `api.guestTodos.list`.
