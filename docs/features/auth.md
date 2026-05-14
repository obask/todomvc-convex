# Auth

## What

The app uses a small local email/password auth flow backed by the existing Postgres `user` and `account` tables. Passwords are stored as Node `scrypt` hashes, and the browser receives an HTTP-only `simple_auth_session` cookie containing a signed user payload with an expiry timestamp.

## Where

- `api/lib/auth.ts` - Simple auth helpers for sign up, sign in, sign out, signed cookie verification, password hashing, and cookies.
- `api/auth/[...all].ts` - Vercel function routing for the auth endpoints used by the client.
- `api/todos.ts` - Todo API authorization via the signed cookie user id.
- `src/main.ts` - Vanilla client auth forms and session loading.
