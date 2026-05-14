# Auth

## What
The app uses a small local email/password auth flow backed by the existing Better Auth-compatible Postgres `user` and `account` tables. Passwords are stored with `Bun.password`, and the browser receives an HTTP-only `simple_auth_session` cookie containing an HS256 JWT.

## Where
- `auth.ts` - Bun SQL connection setup, sign up/sign in/sign out helpers, JWT session verification, `Bun.password` hashing, and cookies.
- `auth-handler.ts` - Shared Bun fetch handler for auth API routes.
- `api/auth/[...all].ts` - Vercel Bun function entrypoint for the auth endpoints used by the client.
- `api/todos.ts` - Todo API authorization via the signed cookie user id.
- `db/schema.sql` - Current Postgres schema for auth tables and todos.
