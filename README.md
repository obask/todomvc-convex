# Welcome to your Convex + React (Vite) + Convex Auth app

This is a [Convex](https://convex.dev/) project created with [`npm create convex`](https://www.npmjs.com/package/create-convex).

After the initial setup (<2 minutes) you'll have a working full-stack app using:

- Convex as your backend (database, server logic)
- [React](https://react.dev/) as your frontend (web page interactivity)
- [Vite](https://vitest.dev/) for optimized web hosting
- [Tailwind](https://tailwindcss.com/) for building great looking UI
- [Convex Auth](https://labs.convex.dev/auth) for authentication

## Get started

If you just cloned this codebase and didn't use `npm create convex`, run:

```
pnpm install
pnpm run dev
```

If you're reading this README on GitHub and want to use this template, run:

```
npm create convex@latest -- -t react-vite-convexauth
```

For more information on how to configure Convex Auth, check out the [Convex Auth docs](https://labs.convex.dev/auth/).

For more examples of different Convex Auth flows, check out this [example repo](https://www.convex.dev/templates/convex-auth).

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
