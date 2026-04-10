import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { certificateCreateSchema } from "@/lib/validations/certificate";
import { handleZodError, handleInternalError, unauthorizedResponse, notFoundResponse } from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * GET /api/clients/[clientId]/certificates
 * Returns certificates for the given client, scoped to the user's org.
 * Query params: ?isActive=true|false, ?type=<string>, ?page=1, ?pageSize=20
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

    const isActiveParam = searchParams.get("isActive");
    const typeParam = searchParams.get("type");

    const where: Record<string, unknown> = { clientId };
    if (isActiveParam !== null) {
      where.isActive = isActiveParam === "true";
    }
    if (typeParam) {
      where.type = typeParam;
    }

    const [data, total] = await Promise.all([
      prisma.certificate.findMany({
        where,
        orderBy: [{ validTo: "desc" }, { subjectName: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.certificate.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (error) {
    return handleInternalError(error);
  }
}

/**
 * POST /api/clients/[clientId]/certificates
 * Creates a new certificate for the given client.
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

    const parsed = certificateCreateSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { validFrom, validTo, ...rest } = parsed.data;

    const certificate = await prisma.certificate.create({
      data: {
        ...rest,
        clientId,
        ...(validFrom ? { validFrom: new Date(validFrom) } : {}),
        ...(validTo ? { validTo: new Date(validTo) } : {}),
      },
    });

    return NextResponse.json({ data: certificate }, { status: 201 });
  } catch (error) {
    return handleInternalError(error);
  }
}
