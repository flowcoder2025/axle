import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import { generateFinancialReportDocx } from "@axle/docgen";
import { uploadFile } from "@axle/storage";
import { calculateFinancialRatios } from "@/lib/services/financial-analysis";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string }> };

const financialReportCreateSchema = z.object({
  year: z.number().int().min(1900).max(2100),
  clientFinancialId: z.string().optional(),
  analysis: z.string().optional(),
  adjustments: z.string().optional(),
});

/**
 * GET /api/clients/[clientId]/financial-reports
 * Returns all financial reports for the client, ordered by year desc.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
    });
    if (!client) return notFoundResponse("Client");

    const data = await prisma.financialReport.findMany({
      where: { clientId },
      orderBy: { year: "desc" },
      include: { clientFinancial: true },
    });

    return NextResponse.json({ data });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * POST /api/clients/[clientId]/financial-reports
 * Generates a DOCX report and stores it as a Document OUTPUT.
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

    const parsed = financialReportCreateSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { year, clientFinancialId, analysis, adjustments } = parsed.data;

    // Resolve financial data
    const financialWhere = clientFinancialId
      ? { id: clientFinancialId, clientId }
      : { clientId, year };

    const financial = await prisma.clientFinancial.findFirst({ where: financialWhere });
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

    // Generate DOCX
    const docxBuffer = await generateFinancialReportDocx({
      clientName: client.name,
      year: financial.year,
      revenue: financial.revenue ? Number(financial.revenue) : undefined,
      operatingProfit: financial.operatingProfit ? Number(financial.operatingProfit) : undefined,
      netProfit: financial.netProfit ? Number(financial.netProfit) : undefined,
      totalAssets: financial.totalAssets ? Number(financial.totalAssets) : undefined,
      totalLiabilities: financial.totalLiabilities ? Number(financial.totalLiabilities) : undefined,
      totalEquity: financial.totalEquity ? Number(financial.totalEquity) : undefined,
      creditRating: financial.creditRating ?? undefined,
      source: financial.source ?? undefined,
      ratios,
      analysis,
      adjustments,
    });

    // Upload to storage
    const fileName = `financial-report-${clientId}-${year}-${Date.now()}.docx`;
    const mimeType =
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

    const uploadResult = await uploadFile(
      "documents",
      fileName,
      docxBuffer,
      {
        path: `financial-reports/${clientId}/${fileName}`,
        contentType: mimeType,
      }
    );

    // Create Document record (OUTPUT category)
    const document = await prisma.document.create({
      data: {
        clientId,
        name: `재무분석보고서_${client.name}_${year}년.docx`,
        fileUrl: uploadResult.url,
        fileType: mimeType,
        category: "OUTPUT",
      },
    });

    // Create FinancialReport record
    const analysisJson: Prisma.InputJsonValue = {
      ratios: ratios as unknown as Prisma.InputJsonValue,
      narrative: analysis ?? null,
    };
    const adjustmentsJson: Prisma.InputJsonValue | typeof Prisma.DbNull = adjustments
      ? ({ notes: adjustments } as Prisma.InputJsonValue)
      : Prisma.DbNull;

    const report = await prisma.financialReport.create({
      data: {
        clientId,
        clientFinancialId: financial.id,
        year: financial.year,
        analysis: analysisJson,
        adjustments: adjustmentsJson,
        reportUrl: document.fileUrl,
      },
    });

    return NextResponse.json({ data: { report, document } }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
