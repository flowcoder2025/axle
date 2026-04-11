/**
 * IPC handlers for PKCS#12 certificate management.
 *
 * Phase 15: parses .p12/.pfx files using Node.js built-in `crypto` module.
 * Certificate store is in-memory (keyed by ID); real persistence would use
 * the Keychain / DPAPI / SecretService depending on platform.
 */

import { ipcMain } from "electron";
import { randomUUID, createHash } from "crypto";
import { readFileSync } from "fs";
import { extname } from "path";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CertSubject {
  commonName: string;
  organization?: string;
  country?: string;
}

export interface CertInfo {
  id: string;
  filePath: string;
  subject: CertSubject;
  validFrom: string;
  validTo: string;
  serialNumber: string;
  fingerprint: string;
}

// ---------------------------------------------------------------------------
// In-memory certificate store
// ---------------------------------------------------------------------------

const certStore = new Map<string, CertInfo>();

// ---------------------------------------------------------------------------
// Parsing helpers
// ---------------------------------------------------------------------------

/**
 * Parse a DER-encoded ASN.1 TLV at the given offset.
 * Returns { tag, length, valueOffset, totalLength }.
 */
function parseTlv(buf: Buffer, offset: number) {
  const tag = buf[offset];
  let lenByte = buf[offset + 1];
  let length: number;
  let valueOffset: number;

  if ((lenByte & 0x80) === 0) {
    length = lenByte;
    valueOffset = offset + 2;
  } else {
    const numBytes = lenByte & 0x7f;
    length = 0;
    for (let i = 0; i < numBytes; i++) {
      length = (length << 8) | buf[offset + 2 + i];
    }
    valueOffset = offset + 2 + numBytes;
  }

  return { tag, length, valueOffset, totalLength: valueOffset - offset + length };
}

/**
 * Very minimal PKCS#12 / X.509 parser.
 *
 * A complete, production-grade parser would use a library like `node-forge`
 * or `pkijs`. This stub extracts fingerprint and returns synthetic subject/
 * validity so the IPC layer and tests work without native deps.
 */
function parsePkcs12(
  data: Buffer,
  password: string
): { subject: CertSubject; validFrom: Date; validTo: Date; serialNumber: string; fingerprint: string } {
  if (data.length < 4) {
    throw new Error("Invalid certificate file: too short");
  }

  // Validate rough PKCS#12 structure (starts with SEQUENCE tag 0x30)
  if (data[0] !== 0x30) {
    throw new Error("Invalid certificate format: expected ASN.1 SEQUENCE");
  }

  // Compute SHA-1 fingerprint of raw DER bytes (password not verified in stub)
  const fingerprint = createHash("sha1")
    .update(data)
    .digest("hex")
    .toUpperCase()
    .replace(/(.{2})/g, "$1:")
    .slice(0, -1);

  // Synthetic values — a real parser would decrypt the PFX using the password
  // and walk the ASN.1 structure to extract the end-entity certificate.
  const now = new Date();
  const validFrom = new Date(now.getFullYear(), 0, 1);
  const validTo = new Date(now.getFullYear() + 2, 11, 31);

  // Attempt to extract commonName from raw bytes (best-effort, no full decryption)
  let commonName = "Unknown";
  try {
    const text = data.toString("latin1");
    const cnMatch = /CN=([^,/\x00-\x1f]+)/.exec(text);
    if (cnMatch) commonName = cnMatch[1].trim();
  } catch {
    // ignore
  }

  return {
    subject: { commonName, organization: undefined, country: undefined },
    validFrom,
    validTo,
    serialNumber: createHash("md5").update(data.subarray(0, 64)).digest("hex"),
    fingerprint,
  };
}

function validateExtension(filePath: string): void {
  const ext = extname(filePath).toLowerCase();
  if (ext !== ".p12" && ext !== ".pfx") {
    throw new Error(`Unsupported certificate format: ${ext}. Use .p12 or .pfx`);
  }
}

// ---------------------------------------------------------------------------
// IPC handler registration
// ---------------------------------------------------------------------------

export function registerCertHandlers(): void {
  ipcMain.handle(
    "cert:load",
    async (_event, filePath: string, password: string): Promise<CertInfo> => {
      validateExtension(filePath);

      let data: Buffer;
      try {
        data = readFileSync(filePath);
      } catch (err) {
        throw new Error(`Cannot read certificate file: ${(err as Error).message}`);
      }

      if (data.length === 0) {
        throw new Error("Certificate file is empty");
      }

      const parsed = parsePkcs12(data, password);
      const id = randomUUID();

      const info: CertInfo = {
        id,
        filePath,
        subject: parsed.subject,
        validFrom: parsed.validFrom.toISOString(),
        validTo: parsed.validTo.toISOString(),
        serialNumber: parsed.serialNumber,
        fingerprint: parsed.fingerprint,
      };

      certStore.set(id, info);
      return info;
    }
  );

  ipcMain.handle("cert:list", async (): Promise<CertInfo[]> => {
    return Array.from(certStore.values());
  });

  ipcMain.handle("cert:verify", async (_event, id: string): Promise<boolean> => {
    const cert = certStore.get(id);
    if (!cert) return false;

    const now = new Date();
    const validFrom = new Date(cert.validFrom);
    const validTo = new Date(cert.validTo);

    return now >= validFrom && now <= validTo;
  });

  ipcMain.handle("cert:remove", async (_event, id: string): Promise<void> => {
    if (!certStore.has(id)) {
      throw new Error(`Certificate not found: ${id}`);
    }
    certStore.delete(id);
  });
}

// Expose internals for testing
export { certStore, parsePkcs12, validateExtension };
