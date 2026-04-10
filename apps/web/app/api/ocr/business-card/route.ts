import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { parseBusinessCard } from "@axle/ocr";

/**
 * POST /api/ocr/business-card
 * Accepts multipart/form-data with an "image" file field.
 * Returns parsed BusinessCardData.
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
    const formData = await req.formData();
    const file = formData.get("image");

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "image file is required" } },
        { status: 400 },
      );
    }

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const data = await parseBusinessCard(buffer, file.type);

    return NextResponse.json({ data });
  } catch (error) {
    console.error("Error parsing business card:", error);
    return NextResponse.json(
      { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
      { status: 500 },
    );
  }
}
