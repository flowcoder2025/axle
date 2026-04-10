import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { clientAchievementCreateSchema } from "@/lib/validations/achievement";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * GET /api/clients/[clientId]/achievements
 * Returns all achievements for the client, ordered by date desc.
 * Query: ?type=PATENT|AWARD|CONTRACT|INVESTMENT|CERTIFICATION, ?page, ?pageSize
 */
export async function GET(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) return notFoundResponse("Client");

    const { searchParams } = new URL(req.url);
    const page = Math.max(1, Number(searchParams.get("page") ?? "1"));
    const pageSize = Math.min(100, Math.max(1, Number(searchParams.get("pageSize") ?? "20")));
    const skip = (page - 1) * pageSize;
    const typeParam = searchParams.get("type");

    const where: Record<string, unknown> = { clientId };
    if (typeParam) where.type = typeParam;

    const [data, total] = await Promise.all([
      prisma.clientAchievement.findMany({
        where,
        orderBy: [{ date: "desc" }, { title: "asc" }],
        skip,
        take: pageSize,
      }),
      prisma.clientAchievement.count({ where }),
    ]);

    return NextResponse.json({ data, total, page, pageSize });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * POST /api/clients/[clientId]/achievements
 * Creates a new achievement for the client.
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

    const parsed = clientAchievementCreateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { date, ...rest } = parsed.data;

    const achievement = await prisma.clientAchievement.create({
      data: {
        clientId,
        ...rest,
        ...(date ? { date: new Date(date) } : {}),
      },
    });

    return NextResponse.json({ data: achievement }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
