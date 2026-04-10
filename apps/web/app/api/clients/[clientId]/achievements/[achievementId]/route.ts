import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { clientAchievementUpdateSchema } from "@/lib/validations/achievement";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string; achievementId: string }> };

async function resolveAchievement(clientId: string, achievementId: string, orgId: string) {
  const client = await prisma.client.findFirst({
    where: { id: clientId, orgId },
    select: { id: true },
  });
  if (!client) return null;

  return prisma.clientAchievement.findFirst({
    where: { id: achievementId, clientId },
  });
}

/**
 * GET /api/clients/[clientId]/achievements/[achievementId]
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId, achievementId } = await params;
    const achievement = await resolveAchievement(clientId, achievementId, user.orgId);
    if (!achievement) return notFoundResponse("Achievement");

    return NextResponse.json({ data: achievement });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * PATCH /api/clients/[clientId]/achievements/[achievementId]
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId, achievementId } = await params;
    const existing = await resolveAchievement(clientId, achievementId, user.orgId);
    if (!existing) return notFoundResponse("Achievement");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 }
      );
    }

    const parsed = clientAchievementUpdateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { date, ...rest } = parsed.data;

    const achievement = await prisma.clientAchievement.update({
      where: { id: achievementId },
      data: {
        ...rest,
        ...(date !== undefined ? { date: date ? new Date(date) : null } : {}),
      },
    });

    return NextResponse.json({ data: achievement });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * DELETE /api/clients/[clientId]/achievements/[achievementId]
 */
export async function DELETE(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId, achievementId } = await params;
    const existing = await resolveAchievement(clientId, achievementId, user.orgId);
    if (!existing) return notFoundResponse("Achievement");

    await prisma.clientAchievement.delete({ where: { id: achievementId } });

    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleInternalError(err);
  }
}
