/// <reference types="node" />
import type { AuthConfig } from "convex/server";

export function authConfigProvider(): AuthConfig["providers"][number] {
  const issuer = process.env.CONVEX_SITE_URL;
  if (!issuer) throw new Error("CONVEX_SITE_URL is not set");

  return {
    type: "customJwt",
    issuer,
    jwks: `${issuer}/.well-known/jwks.json?kid=default`,
    algorithm: "ES256",
    applicationID: "convex",
  };
}
