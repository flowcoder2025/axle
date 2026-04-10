import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { certificateUpdateSchema } from "@/lib/validations/certificate";
import { handleZodError, handleInternalError, unauthorizedResponse, notFoundResponse } from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string; certificateId: string }> };

/**
 * Verifies the client belongs to user's org and the certificate belongs to that client.
 * Returns { certificate } on success, or a NextResponse error to return early.
 */
async function resolveCertificate(
  clientId: string,
  certificateId: string,
  orgId: string,
): Promise<
  | { ok: true; certificate: NonNullable<Awaited<ReturnType<typeof prisma.certificate.findFirst>>> }
  | { ok: false; response: NextResponse }
> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId },
    select: { id: true },
  });

  if (!client) {
    return { ok: false, response: notFoundResponse("Client") };
  }

  const certificate = await prisma.certificate.findFirst({
    where: { id: certificateId, clientId },
  });

  if (!certificate) {
    return { ok: false, response: notFoundResponse("Certificate") };
  }

  return { ok: true, certificate };
}

/**
 * GET /api/clients/[clientId]/certificates/[certificateId]
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId, certificateId } = await params;
    const result = await resolveCertificate(clientId, certificateId, user.orgId);
    if (!result.ok) return result.response;

    return NextResponse.json({ data: result.certificate });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * PATCH /api/clients/[clientId]/certificates/[certificateId]
 * Partial update — e.g., mark isActive=false, update storagePath.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId, certificateId } = await params;
    const result = await resolveCertificate(clientId, certificateId, user.orgId);
    if (!result.ok) return result.response;

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = certificateUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { validFrom, validTo, ...rest } = parsed.data;

    const updated = await prisma.certificate.update({
      where: { id: certificateId },
      data: {
        ...rest,
        ...(validFrom !== undefined ? { validFrom: validFrom ? new Date(validFrom) : null } : {}),
        ...(validTo !== undefined ? { validTo: validTo ? new Date(validTo) : null } : {}),
      },
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * DELETE /api/clients/[clientId]/certificates/[certificateId]
 * Hard delete.
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId, certificateId } = await params;
    const result = await resolveCertificate(clientId, certificateId, user.orgId);
    if (!result.ok) return result.response;

    await prisma.certificate.delete({ where: { id: certificateId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleInternalError(error);
  }
}
