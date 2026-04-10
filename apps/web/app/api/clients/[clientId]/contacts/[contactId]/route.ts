import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { contactUpdateSchema } from "@/lib/validations/contact";

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
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 },
      ),
    };
  }

  const contact = await prisma.contact.findFirst({
    where: { id: contactId, clientId },
  });

  if (!contact) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Contact not found" } },
        { status: 404 },
      ),
    };
  }

  return { ok: true, contact };
}

/**
 * GET /api/clients/[clientId]/contacts/[contactId]
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    const { clientId, contactId } = await params;
    const result = await resolveContact(clientId, contactId, user.orgId);
    if (!result.ok) return result.response;

    return NextResponse.json({ data: result.contact });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}

/**
 * PATCH /api/clients/[clientId]/contacts/[contactId]
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
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
      return NextResponse.json(
        {
          error: {
            code: "VALIDATION_ERROR",
            message: parsed.error.issues.map((i) => i.message).join(", "),
          },
        },
        { status: 400 },
      );
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
    console.error("Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/clients/[clientId]/contacts/[contactId]
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    const { clientId, contactId } = await params;
    const result = await resolveContact(clientId, contactId, user.orgId);
    if (!result.ok) return result.response;

    await prisma.contact.delete({ where: { id: contactId } });

    return new NextResponse(null, { status: 204 });
  } catch (error) {
    console.error("Error:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}
