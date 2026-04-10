import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { monthlyReportSchema } from "@/lib/validations/journal";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
} from "@/lib/api-helpers";
import { generateJournalReportDocx } from "@axle/docgen";
import { uploadFile } from "@axle/storage";

// POST /api/journals/monthly-report — generate monthly DOCX report and store as Document
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
    const parsed = monthlyReportSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { clientId, year, month } = parsed.data;

    // Verify client belongs to org
    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true, name: true },
    });
    if (!client) {
      return NextResponse.json(
        { error: { code: "NOT_FOUND", message: "Client not found" } },
        { status: 404 }
      );
    }

    // Fetch approved journals for the given month
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0, 23, 59, 59, 999);

    const journals = await prisma.researchJournal.findMany({
      where: {
        clientId,
        date: { gte: monthStart, lte: monthEnd },
        status: "APPROVED",
      },
      orderBy: { date: "asc" },
      select: {
        date: true,
        title: true,
        objectives: true,
        results: true,
        nextSteps: true,
        hours: true,
        researcher: { select: { name: true } },
      },
    });

    // Determine researcher name (use first researcher found)
    const researcherName =
      journals.length > 0
        ? journals[0].researcher.name
        : "연구자 미상";

    // Build DOCX
    const docxBuffer = await generateJournalReportDocx({
      clientName: client.name,
      researcherName,
      year,
      month,
      journals: journals.map((j) => ({
        date: j.date.toISOString().split("T")[0],
        title: j.title,
        objectives: j.objectives ?? undefined,
        results: j.results ?? undefined,
        nextSteps: j.nextSteps ?? undefined,
        hours: j.hours ? Number(j.hours) : undefined,
      })),
    });

    // Upload to storage
    const zeroPad = (n: number) => String(n).padStart(2, "0");
    const filename = `journal-report-${client.name}-${year}-${zeroPad(month)}.docx`;
    const uploaded = await uploadFile("documents", filename, docxBuffer, {
      orgId: user.orgId,
      contentType:
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    });

    // Store as Document record (OUTPUT category)
    const document = await prisma.document.create({
      data: {
        clientId,
        name: filename,
        fileUrl: uploaded.url,
        fileType:
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        category: "OUTPUT",
      },
      select: { id: true, name: true, fileUrl: true, category: true, createdAt: true },
    });

    return NextResponse.json({ data: document }, { status: 201 });
  } catch (err) {
    return handleInternalError(err);
  }
}
