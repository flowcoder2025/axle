import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { contactUpdateSchema } from "@/lib/validations/contact";
import { handleZodError, handleInternalError, unauthorizedResponse, notFoundResponse } from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string; contactId: string }> };

/**
 * Verifies the client belongs to user's org and the contact belongs to that client.
 * Returns { client, contact } on success, or a NextResponse error to return early.
 */
async function resolveContact(
  clientId: string,
  contactId: string,
  orgId: string,
): Promise<
  | { ok: true; contact: NonNullable<Awaited<ReturnType<typeof prisma.contact.findFirst>>> }
  | { ok: false; response: NextResponse }
> {
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId },
    select: { id: true },
  });

  if (!client) {
    return { ok: false, response: notFoundResponse("Client") };
  }

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, clientId },
  });

  if (!contact) {
    return { ok: false, response: notFoundResponse("Contact") };
  }

  return { ok: true, contact };
}

/**
 * GET /api/clients/[clientId]/contacts/[contactId]
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId, contactId } = await params;
    const result = await resolveContact(clientId, contactId, user.orgId);
    if (!result.ok) return result.response;

    return NextResponse.json({ data: result.contact });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * PATCH /api/clients/[clientId]/contacts/[contactId]
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId, contactId } = await params;
    const result = await resolveContact(clientId, contactId, user.orgId);
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

    const parsed = contactUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const input = parsed.data;

    // Enforce isPrimary uniqueness: unset existing primary before setting a new one
    if (input.isPrimary) {
      await prisma.contact.updateMany({
        where: { clientId, isPrimary: true, id: { not: contactId } },
        data: { isPrimary: false },
      });
    }

    const updated = await prisma.contact.update({
      where: { id: contactId },
      data: input,
    });

    return NextResponse.json({ data: updated });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * DELETE /api/clients/[clientId]/contacts/[contactId]
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId, contactId } = await params;
    const result = await resolveContact(clientId, contactId, user.orgId);
    if (!result.ok) return result.response;

    await prisma.contact.delete({ where: { id: contactId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    return handleInternalError(error);
  }
}
