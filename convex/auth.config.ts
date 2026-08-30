import type { AuthConfig } from "convex/server";
import { jwksProvider } from "convex-simple-auth/server";

// JWKS:BEGIN (do not edit; rewritten by convex-simple-auth-keys)
const JWKS = {
  "keys": [
    {
      "kty": "EC",
      "crv": "P-256",
      "x": "czl9kAsKEIbK78vBSW0CGm2jpxuwMUejWC7xwkaEWBI",
      "y": "-bVd8wduVjDAFF7_E66C8ha9sJqDhqrzwUVYqKXT7RA",
      "use": "sig",
      "alg": "ES256",
      "kid": "default"
    }
  ]
};
// JWKS:END

export default {
  providers: [jwksProvider(JWKS)],
} satisfies AuthConfig;
