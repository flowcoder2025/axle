import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { clientFinancialUpdateSchema } from "@/lib/validations/financial";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string; year: string }> };

async function resolveRecord(clientId: string, year: number, orgId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId },
    select: { id: true },
  });
  if (!client) return null;

  const record = await prisma.clientFinancial.findFirst({
    where: { clientId, year },
  });
  return record;
}

/**
 * GET /api/clients/[clientId]/financials/[year]
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId, year: yearStr } = await params;
    const year = parseInt(yearStr, 10);
    if (isNaN(year)) return notFoundResponse("FinancialRecord");

    const record = await resolveRecord(clientId, year, user.orgId);
    if (!record) return notFoundResponse("FinancialRecord");

    return NextResponse.json({ data: record });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * PATCH /api/clients/[clientId]/financials/[year]
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId, year: yearStr } = await params;
    const year = parseInt(yearStr, 10);
    if (isNaN(year)) return notFoundResponse("FinancialRecord");

    const existing = await resolveRecord(clientId, year, user.orgId);
    if (!existing) return notFoundResponse("FinancialRecord");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 }
      );
    }

    const parsed = clientFinancialUpdateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const record = await prisma.clientFinancial.update({
      where: { id: existing.id },
      data: parsed.data,
    });

    return NextResponse.json({ data: record });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * DELETE /api/clients/[clientId]/financials/[year]
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId, year: yearStr } = await params;
    const year = parseInt(yearStr, 10);
    if (isNaN(year)) return notFoundResponse("FinancialRecord");

    const existing = await resolveRecord(clientId, year, user.orgId);
    if (!existing) return notFoundResponse("FinancialRecord");

    await prisma.clientFinancial.delete({ where: { id: existing.id } });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleInternalError(err);
  }
}
