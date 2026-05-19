import { scryptAsync } from "@noble/hashes/scrypt.js";

const SCRYPT_OPTS = { N: 16384, r: 16, p: 1, dkLen: 64 } as const;
const SALT_BYTES = 16;

function toHex(bytes: Uint8Array) {
  let value = "";
  for (let i = 0; i < bytes.length; i += 1) {
    value += bytes[i].toString(16).padStart(2, "0");
  }
  return value;
}

function fromHex(hex: string) {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i += 1) {
    bytes[i] = Number.parseInt(hex.slice(i * 2, i * 2 + 2), 16);
  }
  return bytes;
}

async function derive(password: string, salt: Uint8Array) {
  return await scryptAsync(password.normalize("NFKC"), salt, SCRYPT_OPTS);
}

export async function hashPassword(password: string): Promise<string> {
  const salt = crypto.getRandomValues(new Uint8Array(SALT_BYTES));
  const key = await derive(password, salt);
  return `${toHex(salt)}:${toHex(key)}`;
}

export async function verifyPassword(
  password: string,
  stored: string,
): Promise<boolean> {
  const [saltHex, keyHex] = stored.split(":");
  if (!saltHex || !keyHex) return false;

  const expected = fromHex(keyHex);
  const computed = await derive(password, fromHex(saltHex));
  if (computed.length !== expected.length) return false;

  let diff = 0;
  for (let i = 0; i < computed.length; i += 1) {
    diff |= computed[i] ^ expected[i];
  }
  return diff === 0;
}
