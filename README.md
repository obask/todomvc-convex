# Welcome to your Convex + React (Vite) app

This is a [Convex](https://convex.dev/) project created with [`npm create convex`](https://www.npmjs.com/package/create-convex).

After the initial setup (<2 minutes) you'll have a working full-stack app using:

- Convex as your backend (database, server logic)
- [React](https://react.dev/) as your frontend (web page interactivity)
- [Vite](https://vitest.dev/) for optimized web hosting
- [Tailwind](https://tailwindcss.com/) for building great looking UI
- A small repo-owned Convex JWT auth implementation for email/password sign-in

## Get started

If you just cloned this codebase and didn't use `npm create convex`, run:

```
pnpm install
pnpm auth:keys
pnpm run dev
```

`pnpm auth:keys` generates an ES256 private key and stores it as the Convex
`JWT_PRIVATE_KEY` environment variable for the selected deployment. Convex sets
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
