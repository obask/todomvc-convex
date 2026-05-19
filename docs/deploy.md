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

You do **not** need to set `VITE_CONVEX_URL` — `convex deploy --cmd` injects it into the build automatically.

## Setting auth variables

The app's simple auth implementation needs `JWT_PRIVATE_KEY` in every Convex deployment. If it is missing, sign-in or sign-up will fail with a server error that mentions `JWT_PRIVATE_KEY`.

For local development, run this once after `convex init` has linked the project:

```bash
pnpm auth:keys
```

For production, run the same helper against the production deployment after it exists:

```bash
pnpm auth:keys -- --prod
```

For preview deployments, each Convex preview backend needs its own key. Set it on a named preview deployment after Convex creates it:

```bash
pnpm auth:keys -- --preview-name '<branch-name>'
```

The app derives the public JWKS response from `JWT_PRIVATE_KEY` at
`/.well-known/jwks.json`, so there is no separate `JWKS` variable to manage.

Equivalent CLI:

```bash
# Production
vercel env add CONVEX_DEPLOY_KEY production
# paste the production deploy key when prompted

# Preview (applies to all preview branches)
vercel env add CONVEX_DEPLOY_KEY preview
# paste the preview deploy key when prompted
```

To scope a preview value to a specific branch only, use the dashboard's **Custom Environment** option or:

```bash
vercel env add CONVEX_DEPLOY_KEY preview <branch-name>
```

## How preview deployments work

Each Vercel preview deployment (one per PR / branch push) invokes the build with the **preview** `CONVEX_DEPLOY_KEY`. Convex provisions a fresh preview backend named after the git branch, deploys the current schema and functions to it, and `VITE_CONVEX_URL` in the resulting bundle points at *that* preview backend — never at production.

Authenticated users on a preview URL therefore sign up against the preview backend's empty `users` table; production data stays untouched. Convex garbage-collects preview deployments after the associated branch is deleted.

## Sanity checks

- `pnpm build` succeeds locally.
- After the first Vercel deploy: open the deployed URL, sign up, add a todo — it should round-trip to Convex (look for the request to `*.convex.cloud` in DevTools).
- Open a PR → the preview URL works and uses its own Convex backend (check `VITE_CONVEX_URL` in the page source or by inspecting the WebSocket URL).
