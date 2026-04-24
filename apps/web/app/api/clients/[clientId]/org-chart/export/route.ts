import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { generateOrgChartDocx } from "@axle/docgen";
import { orgChartStructureSchema } from "@/lib/validations/org-chart";
import {
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";

type RouteContext = { params: Promise<{ clientId: string }> };

/** Maximum size of the client-rendered PNG (2 MB) — prevents runaway memory. */
const MAX_PNG_BYTES = 2 * 1024 * 1024;

function badRequest(message: string) {
  return NextResponse.json(
    { error: { code: "BAD_REQUEST", message } },
    { status: 400 },
  );
}

/**
 * POST /api/clients/[clientId]/org-chart/export
 *
 * Accepts a `multipart/form-data` body with:
 *   - `png`   (file, optional) — client-rendered PNG from the Org Chart tab.
 *             Embedded as an image in the DOCX when present.
 *   - `chart` (string, optional) — JSON override of the stored chart. Falls
 *             back to `Client.masterProfile.organizationChart` when omitted.
 *   - `widthPx`/`heightPx` (string, optional) — PNG display size in DOCX pixels.
 *
 * Returns a DOCX file download. Falls back to a text-hierarchy DOCX if the
 * PNG is missing, so the endpoint is still useful when the client cannot
 * rasterize the chart (e.g. browsers without `<foreignObject>` support).
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true, masterProfile: true },
    });
    if (!client) return notFoundResponse("Client");

    let form: FormData;
    try {
      form = await req.formData();
    } catch {
      return badRequest("multipart/form-data body required");
    }

    // 1. Resolve chart — explicit override wins over stored copy.
    const chartRaw = form.get("chart");
    let parsedChart;
    if (typeof chartRaw === "string" && chartRaw.length > 0) {
      let body: unknown;
      try {
        body = JSON.parse(chartRaw);
      } catch {
        return badRequest("`chart` field is not valid JSON");
      }
      parsedChart = orgChartStructureSchema.safeParse(body);
    } else {
      const profile = (client.masterProfile as Record<string, unknown> | null) ?? {};
      parsedChart = orgChartStructureSchema.safeParse(profile.organizationChart);
      if (!parsedChart.success) {
        return badRequest("저장된 조직도가 없습니다. 먼저 조직도를 저장해주세요.");
      }
    }
    if (!parsedChart.success) {
      return badRequest(parsedChart.error.issues.map((i) => i.message).join(", "));
    }

    // 2. Resolve optional PNG — browser-rendered via html-to-image.
    const pngField = form.get("png");
    let png: Buffer | undefined;
    if (pngField instanceof File) {
      if (pngField.size > MAX_PNG_BYTES) {
        return badRequest(
          `PNG 파일이 너무 큽니다 (${Math.round(pngField.size / 1024)}KB, 최대 ${MAX_PNG_BYTES / 1024}KB)`,
        );
      }
      const arrayBuffer = await pngField.arrayBuffer();
      png = Buffer.from(arrayBuffer);
    }

    const widthPx = Number(form.get("widthPx") ?? 500);
    const heightPx = Number(form.get("heightPx") ?? 400);

    const { docxBuffer, fileName } = await generateOrgChartDocx(parsedChart.data, {
      png,
      pngWidthPx: Number.isFinite(widthPx) && widthPx > 0 ? widthPx : 500,
      pngHeightPx: Number.isFinite(heightPx) && heightPx > 0 ? heightPx : 400,
    });

    return new NextResponse(new Uint8Array(docxBuffer), {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
