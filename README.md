# Convex + React (Vite) + Better Auth

TodoMVC built on:

- [Convex](https://convex.dev/) — backend (database, server logic)
- [React](https://react.dev/) + [Vite](https://vitejs.dev/) — frontend
- [Tailwind](https://tailwindcss.com/) — styling
- [Better Auth](https://www.better-auth.com/) via the official
  [`@convex-dev/better-auth`](https://labs.convex.dev/better-auth) component

## Get started

```
pnpm install
pnpm run dev
```

First-run setup (only needed once per deployment):

```bash
pnpm exec convex env set BETTER_AUTH_SECRET=$(openssl rand -base64 32)
pnpm exec convex env set SITE_URL http://localhost:5173
```

`.env.local` should contain:

```
CONVEX_DEPLOYMENT=...                 # written by `convex dev`
VITE_CONVEX_URL=https://....convex.cloud
VITE_CONVEX_SITE_URL=https://....convex.site
```

## Production / preview deployments

For each environment, set the Convex deployment env vars `BETTER_AUTH_SECRET`
and `SITE_URL` (the deployed frontend origin). The frontend additionally needs
`VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL`.

## Learn more

- [Convex docs](https://docs.convex.dev/)
- [Better Auth docs](https://www.better-auth.com/docs)
- [`@convex-dev/better-auth`](https://labs.convex.dev/better-auth)
