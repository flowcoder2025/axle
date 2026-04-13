import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@axle/db";
import { getCurrentUser } from "@axle/auth";
import { z } from "zod";
import { handleZodError, handleInternalError, unauthorizedResponse } from "@/lib/api-helpers";

const clientStatusSchema = z.enum(["ACTIVE", "INACTIVE", "PROSPECT"]);

const batchStatusSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one id is required"),
  status: clientStatusSchema,
});

const batchDeleteSchema = z.object({
  ids: z.array(z.string().min(1)).min(1, "At least one id is required"),
});

// PATCH /api/clients/batch — batch status change
export async function PATCH(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = batchStatusSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { ids, status } = parsed.data;

    // Verify all clients belong to user's org
    const ownedCount = await prisma.client.count({
      where: { id: { in: ids }, orgId: user.orgId },
    });

    if (ownedCount !== ids.length) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Some clients do not belong to your organization",
          },
        },
        { status: 403 },
      );
    }

    const result = await prisma.client.updateMany({
      where: { id: { in: ids }, orgId: user.orgId },
      data: { status },
    });

    return NextResponse.json({ data: { updated: result.count } });
  } catch (err) {
    return handleInternalError(err);
  }
}

// DELETE /api/clients/batch — batch delete
export async function DELETE(req: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) return unauthorizedResponse();
    if (!user.orgId) {
      return NextResponse.json(
        { error: { code: "FORBIDDEN", message: "No active organization" } },
        { status: 403 },
      );
    }

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = batchDeleteSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const { ids } = parsed.data;

    // Verify all clients belong to user's org
    const ownedCount = await prisma.client.count({
      where: { id: { in: ids }, orgId: user.orgId },
    });

    if (ownedCount !== ids.length) {
      return NextResponse.json(
        {
          error: {
            code: "FORBIDDEN",
            message: "Some clients do not belong to your organization",
          },
        },
        { status: 403 },
      );
    }

    const result = await prisma.client.deleteMany({
      where: { id: { in: ids }, orgId: user.orgId },
    });

    return NextResponse.json({ data: { deleted: result.count } });
  } catch (err) {
    return handleInternalError(err);
  }
}
