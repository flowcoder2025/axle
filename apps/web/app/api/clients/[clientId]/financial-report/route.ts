import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { generateFinancialReportDocx } from "@axle/docgen";
import { uploadFile } from "@axle/storage";
import { buildFinancialAnalysis } from "@/lib/services/financial-analysis";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string }> };

const requestSchema = z.object({
  year: z.number().int().min(1900).max(2100),
});

/**
 * POST /api/clients/[clientId]/financial-report
 *
 * Orchestrates:
 *   1. buildFinancialAnalysis (metrics + AI narrative + recommendations)
 *   2. generateFinancialReportDocx (DOCX buffer)
 *   3. uploadFile → storage
 *   4. Document (category=OUTPUT, documentType=FINANCIAL_REPORT)
 *   5. FinancialReport row
 *   6. AiJob row (type=FINANCIAL_ANALYSIS)
 *
 * Response: { documentId, url, jobId, reportId, fallbackUsed }
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  const startedAt = Date.now();

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
        { status: 400 },
      );
    }

    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);
    const { year } = parsed.data;

    // Pre-flight: financial data must exist for the target year.
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
        { status: 404 },
      );
    }

    // Create AiJob as RUNNING — we'll update it at the end.
    const jobInput: Prisma.InputJsonValue = {
      clientId,
      year,
      financialId: financial.id,
    };
    const job = await prisma.aiJob.create({
      data: {
        orgId: user.orgId,
        type: "FINANCIAL_ANALYSIS",
        tier: "API_HAIKU",
        status: "RUNNING",
        input: jobInput,
      },
    });

    try {
      // 1. Build metrics + narrative via dispatcher (graceful fallback inside).
      const analysis = await buildFinancialAnalysis(clientId, year);

      // 2. Compose DOCX input.
      const docxBuffer = await generateFinancialReportDocx({
        clientName: client.name,
        year,
        revenue: financial.revenue ? Number(financial.revenue) : undefined,
        operatingProfit: financial.operatingProfit
          ? Number(financial.operatingProfit)
          : undefined,
        netProfit: financial.netProfit ? Number(financial.netProfit) : undefined,
        totalAssets: financial.totalAssets ? Number(financial.totalAssets) : undefined,
        totalLiabilities: financial.totalLiabilities
          ? Number(financial.totalLiabilities)
          : undefined,
        totalEquity: financial.totalEquity ? Number(financial.totalEquity) : undefined,
        creditRating: financial.creditRating ?? undefined,
        source: financial.source ?? undefined,
        ratios: analysis.metrics,
        analysis: analysis.narrative,
        recommendations: analysis.recommendations,
        metrics: {
          revenueGrowth: analysis.metrics.revenueGrowth,
          operatingProfitGrowth: analysis.metrics.operatingProfitGrowth,
          netProfitGrowth: analysis.metrics.netProfitGrowth,
        },
        aiModel: analysis.aiModel,
        fallbackUsed: analysis.fallbackUsed,
      });

      // 3. Upload to storage.
      const fileName = `financial-report-${clientId}-${year}-${Date.now()}.docx`;
      const mimeType =
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

      const uploadResult = await uploadFile("documents", fileName, docxBuffer, {
        path: `financial-reports/${clientId}/${fileName}`,
        contentType: mimeType,
      });

      // 4. Document record (OUTPUT).
      const document = await prisma.document.create({
        data: {
          clientId,
          name: `재무분석보고서_${client.name}_${year}년.docx`,
          fileUrl: uploadResult.url,
          fileType: mimeType,
          category: "OUTPUT",
        },
      });

      // 5. Upsert FinancialReport (unique on clientId+year).
      const analysisJson: Prisma.InputJsonValue = {
        metrics: analysis.metrics as unknown as Prisma.InputJsonValue,
        narrative: analysis.narrative,
        recommendations: analysis.recommendations,
        aiModel: analysis.aiModel,
        fallbackUsed: analysis.fallbackUsed,
        generatedAt: analysis.generatedAt,
      };

      const report = await prisma.financialReport.upsert({
        where: { clientId_year: { clientId, year } },
        update: {
          clientFinancialId: financial.id,
          analysis: analysisJson,
          reportUrl: document.fileUrl,
        },
        create: {
          clientId,
          clientFinancialId: financial.id,
          year,
          analysis: analysisJson,
          reportUrl: document.fileUrl,
        },
      });

      // 6. Mark AiJob COMPLETED.
      const jobOutput: Prisma.InputJsonValue = {
        documentId: document.id,
        reportId: report.id,
        fallbackUsed: analysis.fallbackUsed,
        recommendationsCount: analysis.recommendations.length,
      };
      await prisma.aiJob.update({
        where: { id: job.id },
        data: {
          status: "COMPLETED",
          output: jobOutput,
          durationMs: Date.now() - startedAt,
        },
      });

      return NextResponse.json(
        {
          data: {
            documentId: document.id,
            url: document.fileUrl,
            jobId: job.id,
            reportId: report.id,
            fallbackUsed: analysis.fallbackUsed,
          },
        },
        { status: 201 },
      );
    } catch (err) {
      await prisma.aiJob
        .update({
          where: { id: job.id },
          data: {
            status: "FAILED",
            output: {
              error: err instanceof Error ? err.message : String(err),
            } as Prisma.InputJsonValue,
            durationMs: Date.now() - startedAt,
          },
        })
        .catch(() => {
          /* swallow — primary error dominates */
        });
      throw err;
    }
  } catch (err) {
    return handleInternalError(err);
  }
}
