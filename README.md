# Welcome to your Convex + React (Vite) app

This is a [Convex](https://convex.dev/) project created with [`npm create convex`](https://www.npmjs.com/package/create-convex).

After the initial setup (<2 minutes) you'll have a working full-stack app using:

- Convex as your backend (database, server logic)
- [React](https://react.dev/) as your frontend (web page interactivity)
- [Vite](https://vitest.dev/) for optimized web hosting
- [Tailwind](https://tailwindcss.com/) for building great looking UI
- [`convex-simple-auth`](https://github.com/obask/convex-simple-auth) for email/password JWT auth

## Get started

If you just cloned this codebase and didn't use `npm create convex`, run:

```
pnpm install
pnpm auth:keys
pnpm run dev
```

`pnpm auth:keys` runs `convex-simple-auth-keys`: it generates an ES256 keypair,
stores the private key as the Convex `JWT_PRIVATE_KEY` environment variable, and
rewrites the public JWKS block in `convex/auth.config.ts`. Convex sets
`CONVEX_SITE_URL` automatically; the frontend gets `VITE_CONVEX_URL` from
`convex dev` or `convex deploy --cmd`.

Run `pnpm auth:keys -- --prod` for production or
`pnpm auth:keys -- --preview-name <branch-name>` for a named preview deployment.

## Learn more

To learn more about developing your project with Convex, check out:

- The [Tour of Convex](https://docs.convex.dev/get-started) for a thorough introduction to Convex principles.
- The rest of [Convex docs](https://docs.convex.dev/) to learn about all Convex features.
- [Stack](https://stack.convex.dev/) for in-depth articles on advanced topics.


## Join the community

Join thousands of developers building full-stack apps with Convex:

- Join the [Convex Discord community](https://convex.dev/community) to get help in real-time.
- Follow [Convex on GitHub](https://github.com/get-convex/), star and contribute to the open-source implementation of Convex.
