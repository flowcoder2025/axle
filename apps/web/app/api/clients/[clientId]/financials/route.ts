import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { clientFinancialCreateSchema } from "@/lib/validations/financial";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * GET /api/clients/[clientId]/financials
 * Returns yearly financial list for the client, ordered by year desc.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) return notFoundResponse("Client");

    const data = await prisma.clientFinancial.findMany({
      where: { clientId },
      orderBy: { year: "desc" },
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * POST /api/clients/[clientId]/financials
 * Creates a new financial record for the given year.
 * @@unique([clientId, year]) — 409 if duplicate.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) return notFoundResponse("Client");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 }
      );
    }

    const parsed = clientFinancialCreateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { year, ...rest } = parsed.data;

    // Check uniqueness
    const existing = await prisma.clientFinancial.findFirst({
      where: { clientId, year },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: { code: "CONFLICT", message: `Financial data for ${year} already exists` } },
        { status: 409 }
      );
    }

    const record = await prisma.clientFinancial.create({
      data: { clientId, year, ...rest },
    });

    return NextResponse.json({ data: record }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
