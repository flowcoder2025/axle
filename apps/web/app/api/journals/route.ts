import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { journalCreateSchema, journalQuerySchema } from "@/lib/validations/journal";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { Prisma } from "@prisma/client";

// GET /api/journals — list journals with filtering and pagination
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

    const searchParams = Object.fromEntries(new URL(req.url).searchParams);
    const parsed = journalQuerySchema.safeParse(searchParams);
    if (!parsed.success) return handleZodError(parsed.error);

    const { clientId, researcherContactId, status, dateFrom, dateTo, page, pageSize } =
      parsed.data;
    const skip = (page - 1) * pageSize;

    const where: Prisma.ResearchJournalWhereInput = {
      client: { orgId: user.orgId },
      ...(clientId ? { clientId } : {}),
      ...(researcherContactId ? { researcherContactId } : {}),
      ...(status ? { status } : {}),
      ...(dateFrom || dateTo
        ? {
            date: {
              ...(dateFrom ? { gte: new Date(dateFrom) } : {}),
              ...(dateTo ? { lte: new Date(dateTo) } : {}),
            },
          }
        : {}),
    };

    const [journals, total] = await Promise.all([
      prisma.researchJournal.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { date: "desc" },
        select: {
          id: true,
          title: true,
          date: true,
          status: true,
          hours: true,
          approvedAt: true,
          client: { select: { id: true, name: true } },
          researcher: { select: { id: true, name: true, position: true } },
        },
      }),
      prisma.researchJournal.count({ where }),
    ]);

    const data = journals.map((j) => ({
      ...j,
      date: j.date.toISOString(),
      approvedAt: j.approvedAt ? j.approvedAt.toISOString() : null,
      hours: j.hours ? Number(j.hours) : null,
    }));

    return NextResponse.json({ data, total, page, pageSize });
  } catch (err) {
    return handleInternalError(err);
  }
}

// POST /api/journals — create journal
export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const body = await req.json();
    const parsed = journalCreateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { date, hours, attachments, ...rest } = parsed.data;

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: rest.clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Verify researcher contact belongs to the client
    const researcher = await prisma.contact.findFirst({
      where: { id: rest.researcherContactId, clientId: rest.clientId, isResearcher: true },
      select: { id: true },
    });
    if (!researcher) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Researcher contact not found" } },
        { status: 404 }
      );
    }

    const journal = await prisma.researchJournal.create({
      data: {
        ...rest,
        date: new Date(date),
        hours: hours !== undefined ? hours : undefined,
        attachments: attachments as Prisma.InputJsonValue ?? undefined,
        status: "DRAFT",
      },
      include: {
        client: { select: { id: true, name: true } },
        researcher: { select: { id: true, name: true, position: true } },
      },
    });

    return NextResponse.json({ data: journal }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
