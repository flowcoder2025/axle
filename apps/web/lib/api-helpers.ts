import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export function handleZodError(error: ZodError) {
  const issues = error.issues ?? [];
  return NextResponse.json(
    {
      error: {
        code: "VALIDATION_ERROR",
        message: issues.map((e) => `${e.path.join(".")}: ${e.message}`).join("; "),
      },
    },
    { status: 400 }
  );
}

export function handleInternalError(error: unknown) {
  console.error("API Error:", error);
  return NextResponse.json(
    { error: { code: "INTERNAL_ERROR", message: "Internal server error" } },
    { status: 500 }
  );
}

export function unauthorizedResponse() {
  return NextResponse.json(
    { error: { code: "UNAUTHORIZED", message: "Authentication required" } },
    { status: 401 }
  );
}

export function notFoundResponse(resource = "Resource") {
  return NextResponse.json(
    { error: { code: "NOT_FOUND", message: `${resource} not found` } },
    { status: 404 }
  );
}
