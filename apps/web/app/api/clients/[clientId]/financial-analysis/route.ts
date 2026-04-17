import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { calculateFinancialRatios, buildAnalysisStub } from "@/lib/services/financial-analysis";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string }> };

const financialAnalysisRequestSchema = z.object({
  year: z.number().int().min(1900).max(2100),
});

/**
 * POST /api/clients/[clientId]/financial-analysis
 * Creates an AiJob (FINANCIAL_ANALYSIS / API_HAIKU) for the given year.
 * Calculates ratios synchronously; AI narrative is a stub for Phase 14.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true, name: true },
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

    const parsed = financialAnalysisRequestSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { year } = parsed.data;

    // Fetch financial data for the year
    const financial = await prisma.clientFinancial.findFirst({
      where: { clientId, year },
    });

    if (!financial) {
      return NextResponse.json(
        {
          error: {
            code: "NOT_FOUND",
            message: `No financial data found for ${year}. Please add financial data first.`,
          },
        },
        { status: 404 }
      );
    }

    // Calculate ratios
    const ratios = calculateFinancialRatios({
      revenue: financial.revenue ? Number(financial.revenue) : null,
      operatingProfit: financial.operatingProfit ? Number(financial.operatingProfit) : null,
      netProfit: financial.netProfit ? Number(financial.netProfit) : null,
      totalAssets: financial.totalAssets ? Number(financial.totalAssets) : null,
      totalLiabilities: financial.totalLiabilities ? Number(financial.totalLiabilities) : null,
      totalEquity: financial.totalEquity ? Number(financial.totalEquity) : null,
    });

    const analysisOutput = buildAnalysisStub(ratios, year);

    // Create AiJob record
    const job = await prisma.aiJob.create({
      data: {
        orgId: user.orgId,
        type: "FINANCIAL_ANALYSIS",
        tier: "API_HAIKU",
        status: "COMPLETED",
        input: { clientId, year, financialId: financial.id } as Prisma.InputJsonValue,
        output: analysisOutput as Prisma.InputJsonValue,
        durationMs: 0, // synchronous ratio calculation — no actual AI call yet
      },
    });

    return NextResponse.json({ data: { job, ratios, analysis: analysisOutput } }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
