import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { unauthorizedResponse } from "@/lib/api-helpers";

// GET /api/search?q=term — unified search across clients, projects, meetings, documents, programs
export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  const q = new URL(req.url).searchParams.get("q")?.trim();
  if (!q || q.length < 2) {
    return NextResponse.json({ clients: [], projects: [], meetings: [], documents: [], programs: [] });
  }

  const orgId = user.orgId;
  const contains = q;
  const take = 5;

  const [clients, projects, meetings, documents, programs] = await Promise.all([
    prisma.client.findMany({
      where: { orgId, name: { contains, mode: "insensitive" } },
      select: { id: true, name: true, industry: true },
      take,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.project.findMany({
      where: { client: { orgId }, title: { contains, mode: "insensitive" } },
      select: { id: true, title: true, status: true, client: { select: { name: true } } },
      take,
      orderBy: { updatedAt: "desc" },
    }),
    prisma.meeting.findMany({
      where: { client: { orgId }, title: { contains, mode: "insensitive" } },
      select: { id: true, title: true, date: true },
      take,
      orderBy: { date: "desc" },
    }),
    prisma.document.findMany({
      where: { client: { orgId }, name: { contains, mode: "insensitive" } },
      select: { id: true, name: true, category: true },
      take,
      orderBy: { createdAt: "desc" },
    }),
    prisma.programInfo.findMany({
      where: {
        OR: [{ orgId }, { orgId: null }],
        name: { contains, mode: "insensitive" },
      },
      select: { id: true, name: true, category: true },
      take,
      orderBy: { name: "asc" },
    }),
  ]);

  return NextResponse.json({
    clients,
    projects,
    meetings: meetings.map((m) => ({ ...m, date: m.date.toISOString() })),
    documents,
    programs,
  });
}
