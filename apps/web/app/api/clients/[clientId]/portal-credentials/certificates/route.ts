import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  handleZodError,
  handleInternalError,
  notFoundResponse,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { portalCertificateCreateSchema } from "@/lib/validations/portal-credential";
import { encryptCredential, encryptCredentialBytes } from "@/lib/scraper-crypto";
import { parsePfx, InvalidPfxError } from "@/lib/pfx-parser";

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * POST /api/clients/[clientId]/portal-credentials/certificates
 *
 * Upload a public certificate (PFX/P12) for the client. The bytes and
 * password are AES-256-GCM encrypted with `SCRAPER_CRED_MASTER_KEY`. Only
 * X.509 metadata is stored in plaintext for UI listing.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user?.orgId) return unauthorizedResponse();

    const { clientId } = await params;
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) return notFoundResponse("Client");

    const body = await req.json().catch(() => null);
    const parsed = portalCertificateCreateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    let pfxBytes: Buffer;
    try {
      pfxBytes = Buffer.from(parsed.data.pfxBase64, "base64");
    } catch {
      return NextResponse.json(
        { error: { code: "INVALID_PFX", message: "Invalid base64 payload" } },
        { status: 422 },
      );
    }

    let metadata;
    try {
      metadata = parsePfx(pfxBytes, parsed.data.password);
    } catch (err) {
      if (err instanceof InvalidPfxError) {
        return NextResponse.json(
          { error: { code: "INVALID_PFX", message: err.message } },
          { status: 422 },
        );
      }
      throw err;
    }

    const certificate = await prisma.clientCertificate.create({
      data: {
        clientId,
        subject: metadata.subject,
        issuer: metadata.issuer,
        serialNumber: metadata.serialNumber,
        validFrom: metadata.validFrom,
        validTo: metadata.validTo,
        pfxCiphertext: encryptCredentialBytes(pfxBytes),
        passwordCiphertext: encryptCredential(parsed.data.password),
        createdById: user.id,
      },
      select: {
        id: true,
        subject: true,
        issuer: true,
        serialNumber: true,
        validFrom: true,
        validTo: true,
        createdAt: true,
      },
    });

    return NextResponse.json({ data: certificate }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
