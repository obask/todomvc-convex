# Convex + React (Vite) + custom JWT auth

TodoMVC built on:

- [Convex](https://convex.dev/) — backend (database, server logic, real-time)
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) — frontend
- [Tailwind](https://tailwindcss.com/) — styling
- Custom email+password auth through [`convex-simple-auth`](https://github.com/obask/convex-simple-auth). Convex verifies ES256 JWTs against a static JWKS inlined in [convex/auth.config.ts](convex/auth.config.ts), with no HTTP auth endpoint.

## Get started

```bash
pnpm install
pnpm auth:keys     # generates the keypair, sets JWT_PRIVATE_KEY, splices the public JWK into auth.config.ts
pnpm run dev
```

Pass `-- --prod`, `-- --deployment <name>`, or `-- --preview-name <branch>` to `pnpm auth:keys` to target a non-dev deployment. The script:
1. Generates a fresh P-256 ES256 keypair locally.
2. Sets `JWT_PRIVATE_KEY` (PKCS8 PEM) on the target Convex deployment via `convex env set --from-file`.
3. Splices the matching public JWK (with `kid: "default"`) into `convex/auth.config.ts` between the `// JWKS:BEGIN` / `// JWKS:END` markers. Commit the file so the public key is shared across deployments.

### `.env.local`

```
CONVEX_DEPLOYMENT=...           # written by `convex dev`
VITE_CONVEX_URL=https://....convex.cloud
```

That's the entire env surface — no `SITE_URL`, no `VITE_CONVEX_SITE_URL`, no auth secrets shared with the frontend.

## How it works

| Concern | Where |
|---|---|
| Sign up / sign in | `api.auth.signUp` / `api.auth.signIn` from the `convex-simple-auth/auth` export. They run over the existing Convex connection and return a signed JWT. |
| Users | `convex-simple-auth/users` supplies the indexed lookup and creation functions for the package's `authTables` schema. |
| Password hashing and JWT signing | Implemented by `convex-simple-auth`; tokens use ES256 with `kid: "default"` and the user id in `sub`. |
| JWKS for verification | `jwksProvider` from `convex-simple-auth/server` turns the committed public key in [convex/auth.config.ts](convex/auth.config.ts) into Convex's custom-JWT provider. |
| Token storage | `tokenStore` and `useAuth` come from `convex-simple-auth/react`; [src/App.tsx](src/App.tsx) and [src/main.tsx](src/main.tsx) import them directly. |
| Convex auth integration | `ConvexProviderWithAuth` in [src/main.tsx](src/main.tsx) reads from the package's `useAuth` hook. |
| User identity in backend | `ctx.auth.getUserIdentity().subject` — unchanged Convex pattern, see [convex/todos.ts](convex/todos.ts). |

## Production / preview deployments

Each Convex deployment needs its own `JWT_PRIVATE_KEY`. The public JWK in `auth.config.ts` is shared across all deployments using the same private key. Easiest:

- **Production:** `pnpm auth:keys -- --prod` once.
- **Previews:** set `JWT_PRIVATE_KEY` as a Convex **preview default** so new preview deployments inherit it. You can either re-use the production private key (simpler, JWKS in source matches), or run keygen per preview (rotates the source-committed JWKS — only do this when you actively want to invalidate older tokens).

No frontend env vars beyond `VITE_CONVEX_URL` — `convex deploy --cmd-url-env-var-name` injects that automatically during the Vercel build.

## Learn more

- [Convex docs](https://docs.convex.dev/)
- [Convex `customJwt` provider docs](https://docs.convex.dev/auth/advanced/custom-auth)
- [`jose`](https://github.com/panva/jose) — the JWT library
