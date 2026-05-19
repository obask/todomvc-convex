# Authentication

**What:** Email + password sign-up / sign-in, powered by the
[`convex-simple-auth`](https://github.com/obask/convex-simple-auth) library.
Server-side helpers (PBKDF2 password hashing, ES256 JWT signing, users table
schema) are imported from `convex-simple-auth/server`; the React `useAuth`
hook + `tokenStore` come from `convex-simple-auth/react`. The lib's
`convex-simple-auth-keys` bin generates the keypair, sets `JWT_PRIVATE_KEY`
on the Convex deployment, and splices the public JWK into
`convex/auth.config.ts`. Convex verifies each JWT against the inline JWKS
data URI in `auth.config.ts` — no HTTP route.

**Where:**

- [convex/auth.ts](../../convex/auth.ts) — `signUp` / `signIn` actions, thin
  wrappers around `hashPassword`, `verifyPassword`, `signJwt`,
  `normalizeEmail` from `convex-simple-auth/server`.
- [convex/users.ts](../../convex/users.ts) — internal `getByEmail` query +
  `create` mutation (fields optional to match `authTables`).
- [convex/auth.config.ts](../../convex/auth.config.ts) — `customJwt` provider
  with the public JWK inlined as a `data:` URI between `// JWKS:BEGIN` /
  `// JWKS:END` markers (rewritten by `pnpm auth:keys`).
- [convex/schema.ts](../../convex/schema.ts) — spreads `authTables` (the
  `users` table) from `convex-simple-auth/server` alongside the `todos`
  table.
- [src/lib/auth.ts](../../src/lib/auth.ts) — single-line re-export of
  `tokenStore` + `useAuth` from `convex-simple-auth/react`.
- [src/main.tsx](../../src/main.tsx) — wires `ConvexProviderWithAuth` to
  `useAuth`.
- [src/App.tsx](../../src/App.tsx) — `SignInForm` calls
  `useAction(api.auth.signIn|signUp)` then `tokenStore.set(token)`;
  `SignOutButton` calls `tokenStore.clear()`.

## Env vars

| Var | Where | Set by |
|---|---|---|
| `JWT_PRIVATE_KEY` | Convex env | `pnpm auth:keys` |
| `CONVEX_SITE_URL` | Convex env (auto) | Convex platform — used as JWT `iss` |

No `SITE_URL`, no `VITE_CONVEX_SITE_URL`, no `BETTER_AUTH_SECRET`. Public JWK
lives in `convex/auth.config.ts`.

## Why `kid: "default"`

Convex's JWKS verifier matches the JWT header's `kid` to a `kid` on one of
the JWKs. Without a match, sign-in appears to succeed but
`ctx.auth.getUserIdentity()` returns `null` and `<Authenticated>` never
renders. The lib signs JWTs with `kid: "default"` and the setup script
writes `kid: "default"` into the JWK, keeping them in sync.
