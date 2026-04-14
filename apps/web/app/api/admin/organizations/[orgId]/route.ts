import { NextRequest, NextResponse } from "next/server";
import { isRedirectError } from "next/dist/client/components/redirect-error";
import { requirePlatformAdmin } from "@axle/auth";
import { prisma } from "@axle/db";
import {
  handleInternalError,
  handleZodError,
  forbiddenResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { OrgPatchSchema } from "@/lib/admin/org-schemas";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    try {
      await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const { orgId } = await params;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: {
        id: true,
        name: true,
        slug: true,
        logoUrl: true,
        plan: true,
        quotaAiJobs: true,
        quotaMembers: true,
        isSuspended: true,
        createdAt: true,
        updatedAt: true,
        memberships: {
          select: {
            role: true,
            createdAt: true,
            user: {
              select: { id: true, name: true, email: true, image: true },
            },
          },
          orderBy: { createdAt: "asc" },
        },
      },
    });
    if (!org) return notFoundResponse("Organization");

    return NextResponse.json({
      data: {
        ...org,
        createdAt: org.createdAt.toISOString(),
        updatedAt: org.updatedAt.toISOString(),
        memberships: org.memberships.map((m) => ({
          ...m,
          createdAt: m.createdAt.toISOString(),
        })),
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ orgId: string }> },
) {
  try {
    try {
      await requirePlatformAdmin();
    } catch (err) {
      if (isRedirectError(err)) throw err;
      return forbiddenResponse();
    }

    const { orgId } = await params;
    const body = await request.json();
    const parsed = OrgPatchSchema.safeParse(body);
    if (!parsed.success) return handleZodError(parsed.error);

    const existing = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { id: true },
    });
    if (!existing) return notFoundResponse("Organization");

    const updated = await prisma.organization.update({
      where: { id: orgId },
      data: parsed.data,
      select: {
        id: true,
        plan: true,
        quotaAiJobs: true,
        quotaMembers: true,
        isSuspended: true,
      },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}
