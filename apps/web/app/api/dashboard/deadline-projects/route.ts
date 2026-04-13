import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import {
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";

// GET /api/dashboard/deadline-projects
// Returns projects with dueDate within the next 14 days, excluding COMPLETED/REJECTED, max 5.
export async function GET() {
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

    const now = new Date();
    const fourteenDaysFromNow = new Date(
      now.getTime() + 14 * 24 * 60 * 60 * 1000
    );

    const projects = await prisma.project.findMany({
      where: {
        client: { orgId: user.orgId },
        dueDate: { gte: now, lte: fourteenDaysFromNow },
        status: { notIn: ["COMPLETED", "REJECTED"] },
      },
      orderBy: { dueDate: "asc" },
      take: 5,
      select: {
        id: true,
        title: true,
        dueDate: true,
        status: true,
        client: { select: { name: true } },
      },
    });

    const data = projects.map((p) => {
      const dueDate = p.dueDate as Date;
      const msRemaining = dueDate.getTime() - now.getTime();
      const daysRemaining = Math.ceil(msRemaining / (24 * 60 * 60 * 1000));
      return {
        id: p.id,
        title: p.title,
        dueDate: dueDate.toISOString(),
        status: p.status,
        daysRemaining,
        clientName: p.client.name,
      };
    });

    return NextResponse.json({ data, total: data.length });
  } catch (err) {
    return handleInternalError(err);
  }
}
