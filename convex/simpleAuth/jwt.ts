/// <reference types="node" />
import { SignJWT, exportJWK, importPKCS8 } from "jose";

const ALGORITHM = "ES256";
const AUDIENCE = "convex";
const KEY_ID = "default";
const DEFAULT_TTL_SECONDS = 60 * 60 * 24 * 7;

export interface SignJwtOptions {
  sub: string;
  ttlSeconds?: number;
  claims?: Record<string, unknown>;
}

let cachedKey: Awaited<ReturnType<typeof importPKCS8>> | null = null;
let cachedPublicJwk: Record<string, unknown> | null = null;

async function getPrivateKey() {
  if (cachedKey !== null) return cachedKey;
  const pem = process.env.JWT_PRIVATE_KEY;
  if (!pem) throw new Error("JWT_PRIVATE_KEY is not set");
  cachedKey = await importPKCS8(pem, ALGORITHM, { extractable: true });
  return cachedKey;
}

export async function signJwt({
  sub,
  ttlSeconds = DEFAULT_TTL_SECONDS,
  claims = {},
}: SignJwtOptions): Promise<string> {
  const issuer = process.env.CONVEX_SITE_URL;
  if (!issuer) throw new Error("CONVEX_SITE_URL is not set");
  const key = await getPrivateKey();

  return await new SignJWT(claims)
    .setProtectedHeader({ alg: ALGORITHM, typ: "JWT", kid: KEY_ID })
    .setSubject(sub)
    .setIssuer(issuer)
    .setAudience(AUDIENCE)
    .setIssuedAt()
    .setExpirationTime(Math.floor(Date.now() / 1000) + ttlSeconds)
    .sign(key);
}

export async function getPublicJwk(): Promise<Record<string, unknown>> {
  if (cachedPublicJwk !== null) return cachedPublicJwk;

  const key = await getPrivateKey();
  const jwk = (await exportJWK(key)) as Record<string, unknown>;
  delete jwk.d;
  cachedPublicJwk = { ...jwk, use: "sig", alg: ALGORITHM, kid: KEY_ID };
  return cachedPublicJwk;
}
