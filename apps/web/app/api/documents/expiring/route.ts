import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { z } from "zod";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";

const querySchema = z.object({
  days: z.coerce.number().int().min(1).max(365).optional().default(30),
  clientId: z.string().optional(),
});

// GET /api/documents/expiring
// Returns documents expiring within N days (default 30).
// Query params: ?days=30, ?clientId=
export async function GET(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return unauthorizedResponse();
    }
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = querySchema.safeParse(searchParams);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { days, clientId } = parsed.data;

    const now = new Date();
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);

    const documents = await prisma.document.findMany({
      where: {
        client: { orgId: user.orgId },
        expiresAt: {
          not: null,
          gt: now,
          lte: cutoff,
        },
        ...(clientId ? { clientId } : {}),
      },
      orderBy: { expiresAt: "asc" },
      select: {
        id: true,
        name: true,
        category: true,
        expiresAt: true,
        autoRenew: true,
        clientId: true,
        client: { select: { id: true, name: true } },
      },
    });

    const data = documents.map((doc) => {
      const expiresAt = doc.expiresAt as Date;
      const msRemaining = expiresAt.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
      return {
        id: doc.id,
        name: doc.name,
        category: doc.category,
        expiresAt: expiresAt.toISOString(),
        autoRenew: doc.autoRenew,
        daysRemaining,
        clientId: doc.clientId,
        clientName: doc.client.name,
      };
    });

    return NextResponse.json({ data, total: data.length, days });
  } catch (err) {
    return handleInternalError(err);
  }
}
