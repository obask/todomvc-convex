# Authentication

## What

Email/password sign-up and sign-in use `convex-simple-auth`. The application
imports the package's Convex functions, JWKS provider, React token store, and
auth hook directly, keeping only app-specific schema and UI code locally.

## Where

- `convex/auth.config.ts` — configures Convex with `jwksProvider`.
- `convex/auth.ts`, `convex/users.ts` — re-export the package's Convex functions.
- `src/App.tsx`, `src/main.tsx` — use the package's React auth exports.
