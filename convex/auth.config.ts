/// <reference types="node" />
import type { AuthConfig } from "convex/server";

// Public JWK pasted in at keygen time by `pnpm auth:keys`.
// Public keys are safe to commit. The `kid` MUST match the JWT header `kid`
// signed by convex-simple-auth/server.
// JWKS:BEGIN (do not edit; rewritten by convex-simple-auth-keys)
const JWKS = {
  keys: [
    {
      kty: "EC",
      crv: "P-256",
      x: "X0VXBliWwq382K4vxN_kxSfoUdh-hQkjoyZdRJaO17c",
      y: "B3OzPBnEP0_nK9rpxP69lVFRT2getd1PyOht-rZ9M1E",
      use: "sig",
      alg: "ES256",
      kid: "default",
    },
  ],
};
// JWKS:END

const jwksDataUri =
  "data:application/json;base64," +
  Buffer.from(JSON.stringify(JWKS)).toString("base64");

export default {
  providers: [
    {
      type: "customJwt",
      issuer: process.env.CONVEX_SITE_URL!,
      jwks: jwksDataUri,
      algorithm: "ES256",
      applicationID: "convex",
    },
  ],
} satisfies AuthConfig;
