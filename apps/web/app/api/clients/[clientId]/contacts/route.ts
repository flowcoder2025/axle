import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { contactCreateSchema } from "@/lib/validations/contact";
import { handleZodError, handleInternalError, unauthorizedResponse, notFoundResponse } from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * GET /api/clients/[clientId]/contacts
 * Returns all contacts for the given client, scoped to the user's org.
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });

    if (!client) {
      return notFoundResponse("Client");
    }

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(
      100,
      Math.max(1, Number(searchParams.get("pageSize") ?? "20")),
    );
    const skip = (page - 1) * pageSize;

    const [data, total] = await Promise.all([
      prisma.contact.findMany({
        where: { clientId },
        orderBy: [{ isPrimary: "desc" }, { name: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.contact.count({ where: { clientId } }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * POST /api/clients/[clientId]/contacts
 * Creates a new contact. Enforces at-most-one isPrimary per client.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });

    if (!client) {
      return notFoundResponse("Client");
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = contactCreateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const input = parsed.data;

    // Enforce isPrimary uniqueness: only one primary contact per client
    if (input.isPrimary) {
      await prisma.contact.updateMany({
        where: { clientId, isPrimary: true },
        data: { isPrimary: false },
      });
    }

    const contact = await prisma.contact.create({
      data: { ...input, clientId },
    });

    return NextResponse.json({ data: contact }, { status: 201 });
  } catch (error) {
    return handleInternalError(error);
  }
}
