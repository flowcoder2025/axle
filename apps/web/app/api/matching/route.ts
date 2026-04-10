import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { matchClientToPrograms } from "@axle/matching";
import type { ClientProfile, ProgramProfile } from "@axle/matching";
import { matchingRunSchema, matchingQuerySchema } from "@/lib/validations/matching";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

// POST /api/matching — run matching for a client, persist results, return sorted list
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
    const parsed = matchingRunSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { clientId, programIds } = parsed.data;

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      include: {
        certificates: { select: { type: true } },
        financials: {
          select: { revenue: true, year: true },
          orderBy: { year: "desc" },
          take: 1,
        },
      },
    });
    if (!client) return notFoundResponse("Client");

    // Build client profile for matching engine
    const latestRevenue = client.financials[0]?.revenue;
    const clientProfile: ClientProfile = {
      id: client.id,
      name: client.name,
      industry: client.industry ?? undefined,
      region: client.region ?? undefined,
      employeeCount: client.employeeCount ?? undefined,
      revenue: latestRevenue ? Number(latestRevenue) : undefined,
      isVenture: client.isVenture,
      isInnoBiz: client.isInnoBiz,
      certifications: client.certificates.map((c) => c.type),
    };

    // Fetch programs
    const programWhere = {
      orgId: user.orgId,
      ...(programIds && programIds.length > 0 ? { id: { in: programIds } } : {}),
    };
    const programs = await prisma.programInfo.findMany({
      where: programWhere,
      select: {
        id: true,
        name: true,
        category: true,
        region: true,
        maxFunding: true,
        requirements: true,
        eligibility: true,
      },
    });

    if (programs.length === 0) {
      return NextResponse.json({ data: [] });
    }

    const programProfiles: ProgramProfile[] = programs.map((p) => ({
      id: p.id,
      name: p.name,
      category: p.category,
      region: p.region ?? undefined,
      maxFunding: p.maxFunding ? Number(p.maxFunding) : undefined,
      requirements: (p.requirements as Record<string, unknown>) ?? undefined,
      eligibility: (p.eligibility as Record<string, unknown>) ?? undefined,
    }));

    // Run 3-stage pipeline
    const matchResults = matchClientToPrograms(clientProfile, programProfiles);

    // Persist: replace all results for this client
    await prisma.$transaction([
      prisma.matchingResult.deleteMany({ where: { clientId } }),
      prisma.matchingResult.createMany({
        data: matchResults.map((r) => ({
          clientId,
          programId: r.programId,
          score: r.score,
          matchReasons: r.matchReasons,
          disqualifyReasons: r.disqualifyReasons,
        })),
      }),
    ]);

    // Re-fetch saved records to get assigned IDs
    const saved = await prisma.matchingResult.findMany({
      where: { clientId },
      select: { id: true, programId: true, createdAt: true },
    });
    const savedMap = new Map(saved.map((s) => [s.programId, s]));

    const data = matchResults.map((r) => {
      const record = savedMap.get(r.programId);
      return {
        ...r,
        id: record?.id ?? null,
        isRelevant: null as boolean | null,
        feedbackNote: null as string | null,
        createdAt: record?.createdAt?.toISOString() ?? null,
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleInternalError(err);
  }
}

// GET /api/matching?clientId=xxx — return persisted matching results for a client
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
    const parsed = matchingQuerySchema.safeParse(searchParams);
    if (!parsed.success) return handleZodError(parsed.error);

    const { clientId } = parsed.data;

    // Verify client belongs to org
    const clientExists = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!clientExists) return notFoundResponse("Client");

    const results = await prisma.matchingResult.findMany({
      where: { clientId },
      orderBy: { score: "desc" },
      include: {
        program: {
          select: { id: true, name: true, category: true, region: true, maxFunding: true },
        },
      },
    });

    const data = results.map((r) => {
      const disqualifyReasons = (r.disqualifyReasons as string[]) ?? [];
      const score = Number(r.score);
      return {
        id: r.id,
        programId: r.programId,
        programName: r.program.name,
        programCategory: r.program.category,
        score,
        matchReasons: (r.matchReasons as string[]) ?? [],
        disqualifyReasons,
        isDisqualified: score === 0 && disqualifyReasons.length > 0,
        penalties: [] as Array<{ reason: string; points: number }>,
        isRelevant: r.isRelevant,
        feedbackNote: r.feedbackNote,
        createdAt: r.createdAt.toISOString(),
      };
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleInternalError(err);
  }
}
