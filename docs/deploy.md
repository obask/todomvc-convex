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

You also need `VITE_CONVEX_SITE_URL` (the Convex `*.convex.site` HTTP-actions URL for that deployment) so the Better Auth client can reach the auth routes. `VITE_CONVEX_URL` is injected automatically by `convex deploy --cmd`.

## Setting Better Auth variables on Convex

Each Convex deployment that serves auth needs:

| Variable | Where | Notes |
|---|---|---|
| `BETTER_AUTH_SECRET` | Convex env | 32-byte random string. Generate with `openssl rand -base64 32`. |
| `SITE_URL` | Convex env | Public origin of the deployed frontend (e.g. `https://my-app.vercel.app`). Used as a trusted origin and for cross-domain cookies. |

Set them with the CLI against the target deployment:

```bash
pnpm exec convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
pnpm exec convex env set SITE_URL https://my-app.vercel.app
```

For Vercel preview deployments, configure these as **Convex project default environment variables for preview deployments** before Vercel creates them — Convex copies the defaults into each new preview deployment at creation time. Use `SITE_URL` set to a placeholder if you need a single default; otherwise set it per preview after Vercel publishes the URL.

Existing preview deployments are not updated when defaults change; recreate them or set values directly on the named preview deployment:

```bash
pnpm exec convex env --preview-name '<branch-name>' set SITE_URL https://<branch>.vercel.app
```

## How preview deployments work

Each Vercel preview deployment (one per PR / branch push) invokes the build with the **preview** `CONVEX_DEPLOY_KEY`. Convex provisions a fresh preview backend named after the git branch, deploys the current schema and functions to it, and `VITE_CONVEX_URL` in the resulting bundle points at *that* preview backend — never at production.

Authenticated users on a preview URL therefore sign up against the preview backend's empty Better Auth tables; production data stays untouched. Convex garbage-collects preview deployments after the associated branch is deleted.

## Sanity checks

- `pnpm build` succeeds locally.
- After the first Vercel deploy: open the deployed URL, sign up, add a todo — it should round-trip to Convex (look for the request to `*.convex.cloud` in DevTools).
- Open a PR → the preview URL works and uses its own Convex backend (check `VITE_CONVEX_URL` in the page source or by inspecting the WebSocket URL).
