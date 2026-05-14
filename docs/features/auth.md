# Auth

## What

The app uses a small local email/password auth flow backed by the existing Better Auth-compatible Postgres `user` and `account` tables. Passwords are stored in `account.password` as Node `scrypt` hashes, and the browser receives an HTTP-only `simple_auth_session` cookie containing an HS256 JWT signed and verified with `jose`.

## Where

- `api/lib/auth.ts` - Simple auth helpers for sign up, sign in, sign out, JWT session verification, password hashing, and cookies.
- `api/lib/schema.ts` - Better Auth-compatible auth table mappings plus the app-owned todo table.
- `api/auth/[...all].ts` - Vercel function routing for the auth endpoints used by the client.
- `api/todos.ts` - Todo API authorization via the signed cookie user id.
- `src/main.ts` - Vanilla client auth forms and session loading.
