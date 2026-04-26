import forge from "node-forge";

/**
 * Parsed metadata extracted from a PKCS#12 bag for storage on
 * `ClientCertificate`. The actual PFX bytes and password remain encrypted in
 * the database — these fields exist only for listing/expiry UI.
 */
export interface ParsedPfxMetadata {
  subject: string;
  issuer: string;
  serialNumber: string;
  validFrom: Date;
  validTo: Date;
}

export class InvalidPfxError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InvalidPfxError";
  }
}

function dnToString(dn: forge.pki.CertificateField[]): string {
  return dn
    .map((field) => {
      const name = field.shortName ?? field.name ?? field.type;
      return `${name}=${field.value as string}`;
    })
    .join(", ");
}

/**
 * Parse a PKCS#12 (PFX/P12) blob and return X.509 metadata for the leaf
 * certificate. Throws `InvalidPfxError` if the password is wrong, the blob is
 * malformed, or no certificate bag is present.
 */
export function parsePfx(pfxBytes: Buffer, password: string): ParsedPfxMetadata {
  let asn1: forge.asn1.Asn1;
  try {
    const der = forge.util.createBuffer(pfxBytes.toString("binary"));
    asn1 = forge.asn1.fromDer(der);
  } catch (err) {
    throw new InvalidPfxError(`PFX is not valid DER: ${(err as Error).message}`);
  }

  let p12: forge.pkcs12.Pkcs12Pfx;
  try {
    p12 = forge.pkcs12.pkcs12FromAsn1(asn1, false, password);
  } catch (err) {
    throw new InvalidPfxError(
      `PFX decode failed (wrong password?): ${(err as Error).message}`,
    );
  }

  const certBags = p12.getBags({ bagType: forge.pki.oids.certBag });
  const bagList = certBags[forge.pki.oids.certBag] ?? [];
  if (bagList.length === 0) {
    throw new InvalidPfxError("PFX contains no certificate bag");
  }

  const cert = bagList[0]?.cert;
  if (!cert) {
    throw new InvalidPfxError("PFX certificate bag missing X.509 cert");
  }

  return {
    subject: dnToString(cert.subject.attributes),
    issuer: dnToString(cert.issuer.attributes),
    serialNumber: cert.serialNumber,
    validFrom: cert.validity.notBefore,
    validTo: cert.validity.notAfter,
  };
}
