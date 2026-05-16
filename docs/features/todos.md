# Todos

## What

Authenticated TodoMVC items are stored in the existing Postgres `todos` table. Runtime code maps the current `title`, `is_completed`, and timezone-aware timestamp columns directly and does not apply migrations.

## Where

- `api/lib/schema.ts` - Drizzle table mapping for `todos`.
- `api/todos.ts` - Authorized CRUD API for the signed-in user's todos.
- `src/main.ts` - Vanilla TodoMVC client and optimistic updates.
