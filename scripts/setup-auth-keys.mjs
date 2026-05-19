import { generateKeyPairSync } from "node:crypto";
import { spawnSync } from "node:child_process";
import { mkdtempSync, unlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const passthrough = process.argv.slice(2);
const { privateKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ format: "pem", type: "pkcs8" });

const dir = mkdtempSync(join(tmpdir(), "convex-auth-"));
const pemFile = join(dir, "private.pem");
writeFileSync(pemFile, pem, { mode: 0o600 });

try {
  const result = spawnSync(
    "pnpm",
    [
      "exec",
      "convex",
      "env",
      ...passthrough,
      "set",
      "JWT_PRIVATE_KEY",
      "--from-file",
      pemFile,
    ],
    { stdio: "inherit" },
  );
  if (result.status !== 0) process.exit(result.status ?? 1);
} finally {
  try {
    unlinkSync(pemFile);
  } catch {
    // The temp file may already be gone.
  }
}
