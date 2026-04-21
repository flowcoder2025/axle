import { NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { matchClientToPrograms } from "@axle/matching";
import type { ClientProfile, ProgramProfile } from "@axle/matching";
import { verifyCronAuth } from "@/lib/cron-auth";
import { handleInternalError } from "@/lib/api-helpers";

// POST /api/cron/matching-refresh
// Scheduled: 0 3 * * 1 (every Monday at 03:00 UTC)
// Re-run matching for all active clients against all active programs.
// Upserts MatchingResults in the database.
export async function POST(request: Request): Promise<Response> {
  if (!verifyCronAuth(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Load all active clients with their org programs
    const clients = await prisma.client.findMany({
      where: { status: "ACTIVE" },
      include: {
        certificates: { select: { type: true } },
        financials: {
          select: { revenue: true, year: true },
          orderBy: { year: "desc" },
          take: 1,
        },
      },
    });

    let processed = 0;

    for (const client of clients) {
      // Fetch programs: client's org + crawled platform programs (orgId=null)
      const programs = await prisma.programInfo.findMany({
        where: {
          OR: [{ orgId: client.orgId }, { orgId: null }],
        },
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

      if (programs.length === 0) continue;

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

      const programProfiles: ProgramProfile[] = programs.map((p) => ({
        id: p.id,
        name: p.name,
        category: p.category,
        region: p.region ?? undefined,
        maxFunding: p.maxFunding ? Number(p.maxFunding) : undefined,
        requirements: (p.requirements as Record<string, unknown>) ?? undefined,
        eligibility: (p.eligibility as Record<string, unknown>) ?? undefined,
      }));

      let results;
      try {
        results = matchClientToPrograms(clientProfile, programProfiles);
      } catch (err) {
        console.error(`matching-refresh: match failed for client ${client.id}`, err);
        continue;
      }

      // Upsert matching results using findFirst + create/update pattern
      // (MatchingResult has no unique constraint on (clientId, programId))
      for (const result of results) {
        try {
          const existing = await prisma.matchingResult.findFirst({
            where: { clientId: client.id, programId: result.programId },
            select: { id: true },
          });

          if (existing) {
            await prisma.matchingResult.update({
              where: { id: existing.id },
              data: {
                score: result.score,
                matchReasons: result.matchReasons,
                disqualifyReasons: result.disqualifyReasons,
              },
            });
          } else {
            await prisma.matchingResult.create({
              data: {
                clientId: client.id,
                programId: result.programId,
                score: result.score,
                matchReasons: result.matchReasons,
                disqualifyReasons: result.disqualifyReasons,
              },
            });
          }
        } catch (err) {
          console.error(
            `matching-refresh: persist failed for client ${client.id} program ${result.programId}`,
            err
          );
        }
      }

      processed++;
    }

    return NextResponse.json({ success: true, processed });
  } catch (err) {
    return handleInternalError(err);
  }
}
