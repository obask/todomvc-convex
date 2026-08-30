# Deploying to Vercel

This app is a Vite SPA backed by Convex. Vercel builds the frontend; Convex hosts the backend. The build command in [vercel.json](../vercel.json) wires the two together by running `convex deploy --cmd 'pnpm run build'`, which:

1. Pushes the latest schema and functions to the Convex deployment selected by `CONVEX_DEPLOY_KEY`.
2. Injects that deployment's URL into the Vite build as `VITE_CONVEX_URL`.
3. Runs `pnpm run build` to produce `dist/`.

The catch-all rewrite to `/index.html` lets you visit any URL and still load the SPA; static asset requests take precedence so they're not rewritten.

## One-time setup

1. **Push the repo to GitHub** and import it as a new Vercel project. Accept the auto-detected Vite framework — `vercel.json` overrides what's needed.
2. **Provision Convex deploy keys.** In the [Convex dashboard](https://dashboard.convex.dev) for this project:
   - Settings → **Generate Production Deploy Key** → copy.
   - Settings → **Generate Preview Deploy Key** → copy. (Preview keys spin up a fresh ephemeral Convex deployment per Vercel preview URL, isolated from prod data.)

## Setting environment variables in Vercel

Open the project in Vercel → **Settings → Environment Variables**.

Add `CONVEX_DEPLOY_KEY` twice, scoped to different environments:

| Variable | Value | Environments |
|---|---|---|
| `CONVEX_DEPLOY_KEY` | production deploy key from Convex | **Production** only |
| `CONVEX_DEPLOY_KEY` | preview deploy key from Convex | **Preview** only |

No frontend auth env vars are needed. `VITE_CONVEX_URL` is injected automatically by `convex deploy --cmd`. The JWT machinery is entirely server-side.

## Setting auth variables on Convex

Each Convex deployment that serves auth needs an ES256 private key. The matching public JWK is **committed to source** in `convex/auth.config.ts` (between the `// JWKS:BEGIN` / `// JWKS:END` markers) — it's not secret. The setup script handles both halves in one command:

| Variable | Where | Notes |
|---|---|---|
| `JWT_PRIVATE_KEY` | Convex env | PEM-encoded ES256 private key (PKCS8). Set by `pnpm auth:keys`. |
| Public JWK | `convex/auth.config.ts` (in repo) | Spliced in by `pnpm auth:keys`. Commit it. |

Run `pnpm auth:keys` against each deployment that needs auth — pass `-- --prod`, `-- --deployment <name>`, or `-- --preview-name <branch>` to target. **Re-running rewrites `auth.config.ts`** — commit the resulting change.

For Vercel preview deployments, configure `JWT_PRIVATE_KEY` as a **Convex project default environment variable for preview deployments**. The public JWK in `auth.config.ts` is already in source and ships with each preview's build, so previews automatically pick up whatever key pair you've committed. Re-run `pnpm auth:keys` only when you want to actively rotate.

Existing preview deployments are not updated when defaults change; recreate them or set the private key directly:

```bash
pnpm auth:keys -- --preview-name '<branch-name>'
```

Then commit the updated `convex/auth.config.ts` if rotation was intentional.

## How preview deployments work

Each Vercel preview deployment (one per PR / branch push) invokes the build with the **preview** `CONVEX_DEPLOY_KEY`. Convex provisions a fresh preview backend named after the git branch, deploys the current schema and functions to it, and `VITE_CONVEX_URL` in the resulting bundle points at *that* preview backend — never at production.

Authenticated users on a preview URL therefore sign up against the preview backend's empty `users` table; production data stays untouched. Convex garbage-collects preview deployments after the associated branch is deleted.

## Sanity checks

- `pnpm build` succeeds locally.
- `convex/auth.config.ts` contains a real JWK between the `JWKS:BEGIN` / `JWKS:END` markers (not the placeholder empty strings).
- After the first Vercel deploy: open the deployed URL, sign up, add a todo — it should round-trip to Convex (look for the request to `*.convex.cloud` in DevTools, and a `convex_jwt` entry in `localStorage`). Paste the JWT into jwt.io and check that header `kid` matches the `kid` in `auth.config.ts` (`"default"`).
- Open a PR → the preview URL works and uses its own Convex backend (check `VITE_CONVEX_URL` in the page source or by inspecting the WebSocket URL).
