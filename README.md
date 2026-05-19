# TodoMVC with Convex + Solid

This is a [Convex](https://convex.dev/) TodoMVC app using Solid 2 for the frontend.

The app uses:

- Convex for the database, server functions, and authentication.
- [Solid](https://www.solidjs.com/) 2 for the frontend.
- [Vite](https://vite.dev/) for the web build.
- [Tailwind CSS](https://tailwindcss.com/) for styling.

The Solid UI talks to Convex through [`convex-solidjs`](https://github.com/obask/convex-solidjs).
Todos are scoped to the authenticated `convex-simple-auth` user in `convex/todos.ts`.
Users can sign in with email and password or use anonymous auth through the
"Continue without an account" button.

## Get started

Install dependencies and start Convex plus Vite:

```bash
pnpm install
pnpm run dev
```

The `predev` script runs `convex init` and the `convex-simple-auth` key setup helper once.
Follow the prompts from the Convex CLI if this is your first local deployment.

Useful follow-up docs:

- [Todo feature notes](docs/features/todos.md)
- [Solid + Convex adapter notes](docs/solid-convex-adapter.md)
- [Vercel deployment notes](docs/deploy.md)
- [`convex-simple-auth`](https://github.com/obask/convex-simple-auth)

## Simple Auth preview keys

`convex-simple-auth` requires a matching `JWT_PRIVATE_KEY` environment variable and public `JWKS` block in `convex/auth.config.ts`. Vercel preview builds create fresh Convex preview deployments, so set `JWT_PRIVATE_KEY` as a Convex **preview default** before creating previews.

Run this from the project root to generate a keypair, set `JWT_PRIVATE_KEY` on the current Convex deployment, and rewrite the public `JWKS` block:

```bash
pnpm exec convex-simple-auth-keys
```

Run with Convex deployment flags such as `--prod` or `--preview-name <branch-name>` when targeting those deployments. Defaults only apply to new Convex preview deployments. For an existing preview deployment, recreate it or run:

```bash
pnpm exec convex-simple-auth-keys --preview-name '<branch-name>'
```

## Learn more

To learn more about developing your project with Convex, check out:

- The [Tour of Convex](https://docs.convex.dev/get-started) for a thorough introduction to Convex principles.
- The rest of [Convex docs](https://docs.convex.dev/) to learn about all Convex features.
- [Stack](https://stack.convex.dev/) for in-depth articles on advanced topics.

## Join the community

Join thousands of developers building full-stack apps with Convex:

- Join the [Convex Discord community](https://convex.dev/community) to get help in real-time.
- Follow [Convex on GitHub](https://github.com/get-convex/), star and contribute to the open-source implementation of Convex.
