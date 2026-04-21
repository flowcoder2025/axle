import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import {
  syncClientFinancials,
  CorpCodeResolutionError,
} from "@/lib/services/client-financial-sync";

type RouteContext = { params: Promise<{ clientId: string }> };

const CURRENT_YEAR = new Date().getFullYear();

const syncRequestSchema = z.object({
  years: z
    .array(z.number().int().min(2000).max(CURRENT_YEAR))
    .min(1)
    .max(10),
});

/**
 * POST /api/clients/[clientId]/financials/sync
 * Body: { years: number[] }
 * DART OpenAPI 에서 재무 데이터를 끌어와 ClientFinancial 로 upsert.
 */
export async function POST(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) return unauthorizedResponse();

  try {
    const { clientId } = await params;

    const client = await prisma.client.findFirst({
      where: { id: clientId, orgId: user.orgId },
      select: { id: true },
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

    const parsed = syncRequestSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const result = await syncClientFinancials(clientId, parsed.data.years);
    return NextResponse.json({ data: result });
  } catch (err) {
    if (err instanceof CorpCodeResolutionError) {
      return NextResponse.json(
        {
          error: {
            code: "CORP_CODE_NOT_FOUND",
            message:
              "DART 기업코드를 찾을 수 없습니다. Client.name 또는 corpCode 를 확인하세요.",
          },
        },
        { status: 422 }
      );
    }
    return handleInternalError(err);
  }
}
