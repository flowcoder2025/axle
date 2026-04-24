import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { generateOrgChartMermaid } from "@axle/docgen";
import { orgChartStructureSchema } from "@/lib/validations/org-chart";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string }> };

/**
 * GET /api/clients/[clientId]/org-chart
 * Returns the stored org chart (from Client.masterProfile.organizationChart)
 * and the generated Mermaid string. Returns null data when no chart is saved.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true, name: true, masterProfile: true },
    });
    if (!client) return notFoundResponse("Client");

    const profile = (client.masterProfile as Record<string, unknown> | null) ?? {};
    const stored = profile.organizationChart;
    const parsed = orgChartStructureSchema.safeParse(stored);

    if (!parsed.success) {
      return NextResponse.json({ data: null, mermaid: null });
    }

    return NextResponse.json({
      data: parsed.data,
      mermaid: generateOrgChartMermaid(parsed.data),
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * PUT /api/clients/[clientId]/org-chart
 * Saves the org chart into Client.masterProfile.organizationChart (merged, not replaced),
 * and returns the generated Mermaid string for immediate preview.
 */
export async function PUT(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true, masterProfile: true },
    });
    if (!client) return notFoundResponse("Client");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
    }

    const parsed = orgChartStructureSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const existingProfile =
      (client.masterProfile as Record<string, unknown> | null) ?? {};
    const nextProfile = {
      ...existingProfile,
      organizationChart: {
        ...parsed.data,
        updatedAt: new Date().toISOString(),
      },
    };

    await prisma.client.update({
      where: { id: clientId },
      data: { masterProfile: nextProfile },
    });

    return NextResponse.json({
      data: parsed.data,
      mermaid: generateOrgChartMermaid(parsed.data),
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
