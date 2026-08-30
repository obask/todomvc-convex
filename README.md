# TodoMVC with Convex + Preact

This is a [Convex](https://convex.dev/) TodoMVC app using Preact + `@preact/signals` for the frontend.

The app uses:

- Convex for the database, server functions, and authentication.
- [Preact](https://preactjs.com/) + [`@preact/signals`](https://preactjs.com/guide/v10/signals/) for the frontend.
- [Vite](https://vite.dev/) for the web build.
- [Tailwind CSS](https://tailwindcss.com/) for styling.

The Preact UI talks to Convex through [`convex-preact`](https://github.com/obask/convex-preact), pinned via `https://github.com/obask/convex-preact.git#dist`.
Todos are scoped to the authenticated Convex Auth user in `convex/todos.ts`.
Users can sign in with email and password or use the anonymous provider through the
"Continue without an account" button.

## Get started

Install dependencies and start Convex plus Vite:

```bash
pnpm install
pnpm run dev
```

The `predev` script runs `convex init` and the Convex Auth setup helper once.
Follow the prompts from the Convex CLI if this is your first local deployment.

Useful follow-up docs:

- [Todo feature notes](docs/features/todos.md)
- [Preact + Convex adapter notes](docs/preact-convex-adapter.md)
- [Vercel deployment notes](docs/deploy.md)
- [Convex Auth docs](https://labs.convex.dev/auth/)

## Convex Auth preview keys

Convex Auth requires a matching `JWT_PRIVATE_KEY` and `JWKS` pair in each Convex deployment. Vercel preview builds create fresh Convex preview deployments, so set these as Convex **preview defaults** before creating previews.

Run this from the project root to generate the pair, apply it to Convex preview defaults, then delete the temporary secret file:

```bash
node <<'EOF' > convex-auth-preview.env
const { generateKeyPairSync } = require("node:crypto");

const { privateKey, publicKey } = generateKeyPairSync("rsa", {
  modulusLength: 2048,
  publicExponent: 0x10001,
});

const privatePem = privateKey
  .export({ type: "pkcs8", format: "pem" })
  .trimEnd()
  .replace(/\n/g, " ");
const publicJwk = publicKey.export({ format: "jwk" });
const jwks = JSON.stringify({ keys: [{ use: "sig", ...publicJwk }] });

console.log(`JWT_PRIVATE_KEY="${privatePem}"`);
console.log(`JWKS='${jwks}'`);
EOF

pnpm exec convex env default set --type preview --from-file convex-auth-preview.env
rm convex-auth-preview.env
```

Defaults only apply to new Convex preview deployments. For an existing preview deployment, recreate it or run:

```bash
pnpm exec auth --preview-name '<branch-name>' --skip-git-check
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
