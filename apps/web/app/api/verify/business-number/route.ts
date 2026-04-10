import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { verifyBusinessNumber } from "@axle/ocr";

/**
 * POST /api/verify/business-number
 * Accepts JSON body: { businessNumber: string }
 * Returns BusinessVerifyResult.
 */
export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return NextResponse.json(
      { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
      { status: 401 },
    );
  }

  try {
    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const { businessNumber } =
      typeof body === "object" && body !== null
        ? (body as Record<string, unknown>)
        : {};

    if (!businessNumber || typeof businessNumber !== "string") {
      return NextResponse.json(
        {
          error: {
            code: "BAD_REQUEST",
            message: "businessNumber is required",
          },
        },
        { status: 400 },
      );
    }

    const result = await verifyBusinessNumber(businessNumber);
    return NextResponse.json({ data: result });
  } catch (error) {
    console.error("Error verifying business number:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}
