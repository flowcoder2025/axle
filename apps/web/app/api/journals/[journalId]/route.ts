import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { journalUpdateSchema } from "@/lib/validations/journal";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { Prisma } from "@prisma/client";

type RouteContext = { params: Promise<{ journalId: string }> };

async function resolveJournal(journalId: string, orgId: string) {
  return prisma.researchJournal.findFirst({
    where: { id: journalId, client: { orgId } },
    select: { id: true, status: true },
  });
}

// GET /api/journals/[journalId] — single journal with full detail
export async function GET(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { journalId } = await ctx.params;

    const journal = await prisma.researchJournal.findFirst({
      where: { id: journalId, client: { orgId: user.orgId } },
      include: {
        client: { select: { id: true, name: true } },
        researcher: { select: { id: true, name: true, position: true, email: true } },
      },
    });

    if (!journal) return notFoundResponse("Journal");

    return NextResponse.json({
      data: {
        ...journal,
        date: journal.date.toISOString(),
        approvedAt: journal.approvedAt ? journal.approvedAt.toISOString() : null,
        createdAt: journal.createdAt.toISOString(),
        updatedAt: journal.updatedAt.toISOString(),
        hours: journal.hours ? Number(journal.hours) : null,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

// PATCH /api/journals/[journalId] — partial update (DRAFT only)
export async function PATCH(req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { journalId } = await ctx.params;

    const existing = await resolveJournal(journalId, user.orgId);
    if (!existing) return notFoundResponse("Journal");

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only DRAFT journals can be edited" } },
        { status: 400 }
      );
    }

    const body = await req.json();
    const parsed = journalUpdateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { date, hours, attachments, ...rest } = parsed.data;

    const journal = await prisma.researchJournal.update({
      where: { id: journalId },
      data: {
        ...rest,
        ...(date ? { date: new Date(date) } : {}),
        ...(hours !== undefined ? { hours } : {}),
        ...(attachments !== undefined
          ? { attachments: attachments as Prisma.InputJsonValue }
          : {}),
      },
    });

    return NextResponse.json({ data: journal });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/journals/[journalId] — hard delete (DRAFT only)
export async function DELETE(_req: NextRequest, ctx: RouteContext) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 }
      );
    }

    const { journalId } = await ctx.params;

    const existing = await resolveJournal(journalId, user.orgId);
    if (!existing) return notFoundResponse("Journal");

    if (existing.status !== "DRAFT") {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "Only DRAFT journals can be deleted" } },
        { status: 400 }
      );
    }

    await prisma.researchJournal.delete({ where: { id: journalId } });

    return NextResponse.json({ data: { deleted: true } });
  } catch (err) {
    return handleInternalError(err);
  }
}
