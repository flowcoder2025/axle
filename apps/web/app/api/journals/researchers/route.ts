import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import {
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";

// GET /api/journals/researchers — list Contact where isResearcher=true,
// grouped by clientId, include monthly journal count
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const searchParams = new URL(req.url).searchParams;
    const clientId = searchParams.get("clientId") ?? undefined;

    // Compute current month range
    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);

    const researchers = await prisma.contact.findMany({
      where: {
        isResearcher: true,
        client: { orgId: user.orgId },
        ...(clientId ? { clientId } : {}),
      },
      orderBy: [{ clientId: "asc" }, { name: "asc" }],
      select: {
        id: true,
        name: true,
        position: true,
        email: true,
        phone: true,
        researchField: true,
        clientId: true,
        client: { select: { id: true, name: true } },
        journals: {
          where: {
            date: { gte: monthStart, lte: monthEnd },
          },
          select: { id: true },
        },
      },
    });

    // Group by clientId and include monthly count
    const grouped: Record<
      string,
      {
        client: { id: string; name: string };
        researchers: Array<{
          id: string;
          name: string;
          position: string | null;
          email: string | null;
          phone: string | null;
          researchField: string | null;
          monthlyJournalCount: number;
        }>;
      }
    > = {};

    for (const r of researchers) {
      if (!grouped[r.clientId]) {
        grouped[r.clientId] = { client: r.client, researchers: [] };
      }
      grouped[r.clientId].researchers.push({
        id: r.id,
        name: r.name,
        position: r.position,
        email: r.email,
        phone: r.phone,
        researchField: r.researchField,
        monthlyJournalCount: r.journals.length,
      });
    }

    const data = Object.values(grouped);

    return NextResponse.json({ data });
  } catch (err) {
    return handleInternalError(err);
  }
}
