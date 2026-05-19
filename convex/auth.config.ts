import type { AuthConfig } from "convex/server";

// JWKS:BEGIN (do not edit; rewritten by convex-simple-auth-keys)
const JWKS = {
  "keys": [
    {
      "kty": "EC",
      "crv": "P-256",
      "x": "QejMPFhF44BHADyD7DXM232b7CErYYXoUYP3XjMLrl8",
      "y": "fvZ8fHGXCapmHAxKuOTq_LyneXoeDOJimnCNORVCSMY",
      "use": "sig",
      "alg": "ES256",
      "kid": "default"
    }
  ]
};
// JWKS:END

const jwksDataUri =
  "data:application/json;base64," + btoa(JSON.stringify(JWKS));

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
