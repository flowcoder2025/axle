import { describe, it, expect } from "vitest";
import forge from "node-forge";
import { parsePfx, InvalidPfxError } from "../../lib/pfx-parser";

/**
 * Build a deterministic PKCS#12 blob in-memory so we can exercise the parser
 * without checking real PFX bytes into the repo.
 */
function buildSelfSignedPfx(password: string): Buffer {
  const keys = forge.pki.rsa.generateKeyPair(2048);
  const cert = forge.pki.createCertificate();
  cert.publicKey = keys.publicKey;
  cert.serialNumber = "0a1b2c3d";
  cert.validity.notBefore = new Date("2026-01-01T00:00:00Z");
  cert.validity.notAfter = new Date("2027-01-01T00:00:00Z");
  const attrs: forge.pki.CertificateField[] = [
    { name: "commonName", value: "Test Subscriber" },
    { name: "organizationName", value: "AXLE Test" },
    { name: "countryName", value: "KR" },
  ];
  cert.setSubject(attrs);
  cert.setIssuer(attrs);
  cert.sign(keys.privateKey, forge.md.sha256.create());

  const p12Asn1 = forge.pkcs12.toPkcs12Asn1(keys.privateKey, [cert], password, {
    algorithm: "3des",
  });
  const der = forge.asn1.toDer(p12Asn1).getBytes();
  return Buffer.from(der, "binary");
}

describe("parsePfx", () => {
  it("extracts subject, issuer, serial, validFrom/To from a valid PFX", () => {
    const pfx = buildSelfSignedPfx("secret");
    const meta = parsePfx(pfx, "secret");
    expect(meta.subject).toContain("CN=Test Subscriber");
    expect(meta.subject).toContain("O=AXLE Test");
    expect(meta.issuer).toContain("CN=Test Subscriber");
    expect(meta.serialNumber).toBe("0a1b2c3d");
    expect(meta.validFrom.toISOString()).toBe("2026-01-01T00:00:00.000Z");
    expect(meta.validTo.toISOString()).toBe("2027-01-01T00:00:00.000Z");
  });

  it("throws InvalidPfxError for wrong password", () => {
    const pfx = buildSelfSignedPfx("secret");
    expect(() => parsePfx(pfx, "wrong")).toThrow(InvalidPfxError);
  });

  it("throws InvalidPfxError for malformed bytes", () => {
    const garbage = Buffer.from([0x00, 0x01, 0x02, 0x03, 0x04]);
    expect(() => parsePfx(garbage, "any")).toThrow(InvalidPfxError);
  });
});
