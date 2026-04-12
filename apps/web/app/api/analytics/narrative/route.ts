import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { generateFinancialNarrative } from "@/lib/services/financial-narrative";
import { handleInternalError, unauthorizedResponse } from "@/lib/api-helpers";
import { z } from "zod";

const narrativeSchema = z.object({
  clientId: z.string().min(1),
  year: z.number().int().min(2000).max(2100),
});

export async function POST(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user?.orgId) return unauthorizedResponse();

    const body = await req.json();
    const parsed = narrativeSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: { code: "VALIDATION_ERROR", message: parsed.error.message } },
        { status: 400 }
      );
    }

    const narrative = await generateFinancialNarrative(
      parsed.data.clientId,
      parsed.data.year
    );
    return NextResponse.json({ data: { narrative } });
  } catch (err) {
    return handleInternalError(err);
  }
}
