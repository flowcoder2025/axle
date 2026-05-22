/**
 * Report export job orchestration (Phase 21 WI-731-feat).
 *
 * Reports are rendered out-of-band: the POST endpoint creates an `AiJob`
 * row in QUEUED state, fires the dispatch in the background, and returns
 * immediately with the jobId. The GET endpoint polls the row for status
 * + the resulting Blob URL.
 *
 * Why `AiJob` rather than a dedicated `ReportExport` table:
 *   The status machine (QUEUED → RUNNING → COMPLETED/FAILED) is identical
 *   to every other AI dispatch. Adding a parallel table would duplicate
 *   the dispatcher + UI patterns. The output Json column carries
 *   { blobUrl, format, sizeBytes } for completed jobs; errorMessage
 *   holds the failure reason.
 *
 * Initial format support is CSV — the jobId pattern is the load-bearing
 * AC (spec §5 WI-731). DOCX/PDF rendering lives behind the same
 * dispatcher contract and ships as a follow-up (the PoC document in
 * docs/specs/2026-05-22-wi731-poc-serverless-puppeteer.md covers the
 * downstream choice). CSV is a real artifact AXLE clients can open in
 * Excel today, so the slice is independently useful.
 */

import { prisma } from "@axle/db";
import type { Prisma } from "@prisma/client";
import { resolveAiTier } from "@axle/ai";
import { uploadReportExport } from "./blob";
import {
  counterpartyReport,
  incomeStatementReport,
  inventoryTurnoverReport,
  deadStockReport,
} from "./reports";

export type ReportType =
  | "counterparty"
  | "income-statement"
  | "inventory-turnover"
  | "dead-stock";

export type ExportFormat = "csv";

export interface ReportExportInput {
  reportType: ReportType;
  format: ExportFormat;
  params: Record<string, unknown>;
}

export interface ReportExportOutput {
  format: ExportFormat;
  blobUrl: string;
  sizeBytes: number;
  filename: string;
}

/**
 * Create the AiJob row + kick off the background dispatch. Returns the
 * jobId so the caller can respond with 202 + the polling URL.
 *
 * The dispatch is fire-and-forget — the route handler returns before
 * the render completes. The AiJob row is what survives across the
 * function invocation; failures land in `errorMessage` so the GET poll
 * can surface them.
 */
export async function enqueueReportExport(
  orgId: string,
  input: ReportExportInput,
): Promise<string> {
  const tier = resolveAiTier("REPORT_EXPORT");
  const job = await prisma.aiJob.create({
    data: {
      orgId,
      type: "REPORT_EXPORT",
      tier,
      status: "QUEUED",
      input: input as unknown as Prisma.InputJsonValue,
    },
    select: { id: true },
  });

  // Fire-and-forget render. Errors caught in `runReportExportInline`
  // are persisted on the AiJob row so the GET poll sees them.
  void runReportExportInline(job.id, orgId, input);
  return job.id;
}

/**
 * Render the report + upload + update the AiJob row. Exported for test
 * coverage; production callers use {@link enqueueReportExport}.
 *
 * Steps:
 *   1. RUNNING transition (visible to the GET poll mid-render)
 *   2. Build the report payload via the existing report helpers
 *   3. Serialize to CSV (UTF-8 BOM so Excel opens Korean correctly)
 *   4. Upload to Blob → blobUrl
 *   5. COMPLETED transition with output { format, blobUrl, sizeBytes }
 *   6. Any error → FAILED + errorMessage
 */
export async function runReportExportInline(
  jobId: string,
  orgId: string,
  input: ReportExportInput,
): Promise<void> {
  const startedAt = Date.now();
  try {
    await prisma.aiJob.update({
      where: { id: jobId },
      data: { status: "RUNNING" },
    });

    const csv = await renderReportCsv(orgId, input);
    const buf = Buffer.from(csv, "utf8");
    const filename = `${input.reportType}-${jobId}.csv`;
    const blobUrl = await uploadReportExport(
      orgId,
      jobId,
      buf,
      "text/csv; charset=utf-8",
      "csv",
    );

    const output: ReportExportOutput = {
      format: "csv",
      blobUrl,
      sizeBytes: buf.byteLength,
      filename,
    };

    await prisma.aiJob.update({
      where: { id: jobId },
      data: {
        status: "COMPLETED",
        output: output as unknown as Prisma.InputJsonValue,
        durationMs: Date.now() - startedAt,
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await prisma.aiJob.update({
      where: { id: jobId },
      data: {
        status: "FAILED",
        errorMessage: message,
        durationMs: Date.now() - startedAt,
      },
    });
  }
}

/**
 * Render the report data to a CSV string. UTF-8 BOM is prepended so
 * Excel decodes Korean characters correctly when the file is opened
 * directly (Excel's CSV reader defaults to cp949 without it).
 */
async function renderReportCsv(
  orgId: string,
  input: ReportExportInput,
): Promise<string> {
  const BOM = "﻿";
  switch (input.reportType) {
    case "counterparty": {
      const params = input.params;
      const report = await counterpartyReport({
        orgId,
        from: parseMonthParam(params.from, "from"),
        to: parseMonthParam(params.to, "to"),
        type: requireOrderDirection(params.type, "type"),
        limit: typeof params.limit === "number" ? params.limit : undefined,
      });
      const lines: string[] = [];
      lines.push("거래처ID,거래처명,총액,수량,라인수");
      for (const row of report.rows) {
        lines.push(
          [
            csvEscape(row.counterpartyId ?? ""),
            csvEscape(row.counterpartyName ?? "(미지정 거래처)"),
            row.totalAmount,
            row.totalQty,
            row.lineCount,
          ].join(","),
        );
      }
      lines.push("");
      lines.push(`총합,${report.totalAmount}`);
      lines.push(`기준 시각,${report.dataAsOf ?? "(미초기화)"}`);
      return BOM + lines.join("\n");
    }
    case "income-statement": {
      const params = input.params;
      const year = requireNumber(params.year, "year");
      const month = typeof params.month === "number" ? params.month : undefined;
      const report = await incomeStatementReport({ orgId, year, month });
      const lines: string[] = [];
      lines.push("카테고리,코드,계정명,금액");
      for (const cat of [
        "REVENUE",
        "COGS",
        "OPEX",
        "NON_OPERATING",
        "OTHER",
      ] as const) {
        const bucket = report.categories[cat];
        for (const root of bucket.rows) {
          writeNode(lines, cat, root, 0);
        }
        lines.push(`${cat} 합계,,,${bucket.total}`);
      }
      lines.push("");
      lines.push(`영업이익,,,${report.operatingIncome}`);
      lines.push(`당기순이익,,,${report.netIncome}`);
      lines.push(`기준 시각,,,${report.dataAsOf ?? "(미초기화)"}`);
      return BOM + lines.join("\n");
    }
    case "inventory-turnover": {
      const params = input.params;
      const report = await inventoryTurnoverReport({
        orgId,
        from: typeof params.from === "string" ? params.from : undefined,
        to: typeof params.to === "string" ? params.to : undefined,
        limit: typeof params.limit === "number" ? params.limit : undefined,
      });
      const lines: string[] = [];
      lines.push("상품ID,상품명,SKU,단위,IN,OUT,일평균회전,마지막이동");
      for (const r of report.rows) {
        lines.push(
          [
            csvEscape(r.productId),
            csvEscape(r.productName),
            csvEscape(r.sku ?? ""),
            csvEscape(r.unit),
            r.totalIn,
            r.totalOut,
            r.turnoverPerDay,
            r.lastMovementAt ?? "",
          ].join(","),
        );
      }
      return BOM + lines.join("\n");
    }
    case "dead-stock": {
      const params = input.params;
      const report = await deadStockReport({
        orgId,
        days: typeof params.days === "number" ? params.days : undefined,
        limit: typeof params.limit === "number" ? params.limit : undefined,
      });
      const lines: string[] = [];
      lines.push("상품ID,상품명,SKU,단위,단가,마지막판매,휴면일수");
      for (const r of report.rows) {
        lines.push(
          [
            csvEscape(r.productId),
            csvEscape(r.productName),
            csvEscape(r.sku ?? ""),
            csvEscape(r.unit),
            r.unitPrice,
            r.lastOutAt ?? "",
            r.daysSinceLastOut ?? "Never",
          ].join(","),
        );
      }
      lines.push("");
      lines.push(`임계치(일),${report.thresholdDays}`);
      return BOM + lines.join("\n");
    }
    default: {
      // exhaustiveness — caller validated via Zod
      const exhaust: never = input.reportType;
      throw new Error(`unsupported reportType: ${String(exhaust)}`);
    }
  }
}

function writeNode(
  lines: string[],
  cat: string,
  node: {
    code: string;
    name: string;
    total: string;
    children: { code: string; name: string; total: string; children: unknown[] }[];
  },
  depth: number,
): void {
  const indent = "  ".repeat(depth);
  lines.push(
    [cat, csvEscape(node.code), csvEscape(indent + node.name), node.total].join(
      ",",
    ),
  );
  for (const child of node.children) {
    writeNode(
      lines,
      cat,
      child as never,
      depth + 1,
    );
  }
}

function csvEscape(s: string): string {
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function parseMonthParam(
  raw: unknown,
  name: string,
): { year: number; month: number } {
  if (typeof raw !== "string" || !/^\d{4}-(0[1-9]|1[0-2])$/.test(raw)) {
    throw new Error(`EXPORT_BAD_PARAM: ${name} must be YYYY-MM`);
  }
  const [y, m] = raw.split("-").map((p) => Number(p));
  return { year: y, month: m };
}

function requireOrderDirection(raw: unknown, name: string): "SALE" | "PURCHASE" {
  if (raw === "SALE" || raw === "PURCHASE") return raw;
  throw new Error(`EXPORT_BAD_PARAM: ${name} must be SALE or PURCHASE`);
}

function requireNumber(raw: unknown, name: string): number {
  if (typeof raw === "number" && Number.isFinite(raw)) return raw;
  throw new Error(`EXPORT_BAD_PARAM: ${name} must be a number`);
}
