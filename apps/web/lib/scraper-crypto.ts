import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

/**
 * Scraper credential encryption (AES-256-GCM).
 *
 * Used for Client portal credentials (PFX + password, user/pw) that are
 * transiently passed to flowvue-scraper via the scraper REST API.
 *
 * Key is separate from OAUTH_ENCRYPTION_KEY so that:
 *  - leaked OAuth key cannot decrypt client credentials
 *  - key rotation can proceed independently
 *
 * See .flowset/contracts/scraper-data.md §4 for credential flow.
 */

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

function getMasterKey(): Buffer {
  const key = process.env.SCRAPER_CRED_MASTER_KEY;
  if (!key || key.length !== 64) {
    throw new Error(
      "SCRAPER_CRED_MASTER_KEY must be a 64-char hex string (32 bytes). " +
        "Generate with: openssl rand -hex 32",
    );
  }
  return Buffer.from(key, "hex");
}

export function encryptCredential(plaintext: string): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptCredential(encoded: string): string {
  const key = getMasterKey();
  const data = Buffer.from(encoded, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString("utf8");
}

export function encryptCredentialBytes(data: Buffer): string {
  const key = getMasterKey();
  const iv = randomBytes(IV_LENGTH);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();
  return Buffer.concat([iv, authTag, encrypted]).toString("base64");
}

export function decryptCredentialBytes(encoded: string): Buffer {
  const key = getMasterKey();
  const data = Buffer.from(encoded, "base64");
  const iv = data.subarray(0, IV_LENGTH);
  const authTag = data.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = data.subarray(IV_LENGTH + AUTH_TAG_LENGTH);
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}
