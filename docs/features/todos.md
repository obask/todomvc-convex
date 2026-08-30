# Todos

**What:** Per-user TodoMVC list with add, double-click-to-edit, toggle, toggle-all, delete, clear-completed, and All/Active/Completed filtering via URL hash. All mutations apply optimistically through `useMutation(...).withOptimisticUpdate` so the UI updates in the same frame as user input; the Convex live query reconciles to server state.

**Where:**
- [convex/schema.ts](../../convex/schema.ts) — `todos` table with `by_user` and `by_user_and_completed` indexes.
- [convex/todos.ts](../../convex/todos.ts) — `list`, `create`, `setCompleted`, `rename`, `remove`, `toggleAll`, `clearCompleted`. All scope by `ctx.auth.getUserIdentity().subject` (the `users._id` carried in the JWT signed by [convex/auth.ts](../../convex/auth.ts)); never accept a userId arg.
- [src/App.tsx](../../src/App.tsx) — `TodoApp`, `NewTodoInput`, `TodoItem`, `Footer`, `useHashFilter`. Each mutation has a matching `withOptimisticUpdate` patcher over the `api.todos.list` cache.
