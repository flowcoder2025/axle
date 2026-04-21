import { NextRequest, NextResponse } from "next/server";
import { getCurrentUser } from "@axle/auth";
import { prisma } from "@axle/db";
import { Prisma } from "@prisma/client";
import { z } from "zod";
import {
  handleZodError,
  handleInternalError,
  unauthorizedResponse,
  notFoundResponse,
} from "@/lib/api-helpers";
import { generateMasterProfile } from "@/lib/services/client-profile";

type RouteContext = { params: Promise<{ clientId: string }> };

const profilePatchSchema = z.object({
  masterProfile: z.record(z.string(), z.unknown()).nullable(),
});

async function ensureClient(clientId: string, orgId: string) {
  return prisma.client.findFirst({
    where: { id: clientId, orgId },
    select: { id: true, masterProfile: true, profileBlocks: true },
  });
}

/**
 * GET /api/clients/[clientId]/profile
 * Returns the persisted masterProfile + profileBlocks JSON.
 */
export async function GET(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId } = await params;
    const client = await ensureClient(clientId, user.orgId);
    if (!client) return notFoundResponse("Client");

    return NextResponse.json({
      data: {
        masterProfile: client.masterProfile ?? null,
        profileBlocks: client.profileBlocks ?? null,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * PATCH /api/clients/[clientId]/profile
 *
 * Persists a manually-edited master profile JSON document. The full blob is
 * replaced — the UI is expected to send the entire merged structure after
 * form edits.
 */
export async function PATCH(req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId } = await params;
    const client = await ensureClient(clientId, user.orgId);
    if (!client) return notFoundResponse("Client");

    let body: unknown;
    try {
      body = await req.json();
    } catch {
      return NextResponse.json(
        { error: { code: "BAD_REQUEST", message: "Invalid JSON body" } },
        { status: 400 },
      );
    }

    const parsed = profilePatchSchema.safeParse(body);
    if (!parsed.success) {
      return handleZodError(parsed.error);
    }

    const { masterProfile } = parsed.data;

    const updated = await prisma.client.update({
      where: { id: clientId },
      data: {
        masterProfile:
          masterProfile != null
            ? (masterProfile as Prisma.InputJsonValue)
            : Prisma.DbNull,
      },
      select: { id: true, masterProfile: true, profileBlocks: true },
    });

    return NextResponse.json({ data: updated });
  } catch (err) {
    return handleInternalError(err);
  }
}

/**
 * POST /api/clients/[clientId]/profile
 *
 * Regenerates the master profile JSON via the AI profile service. Runs
 * synchronously for now because the generator hits a single DB read + write
 * and finishes in <1s; a queue can be introduced later if scope grows.
 */
export async function POST(_req: NextRequest, { params }: RouteContext) {
  const user = await getCurrentUser();
  if (!user?.orgId) {
    return unauthorizedResponse();
  }

  try {
    const { clientId } = await params;
    const client = await ensureClient(clientId, user.orgId);
    if (!client) return notFoundResponse("Client");

    await generateMasterProfile(clientId);

    const refreshed = await prisma.client.findUnique({
      where: { id: clientId },
      select: { masterProfile: true, profileBlocks: true },
    });

    return NextResponse.json({
      data: {
        masterProfile: refreshed?.masterProfile ?? null,
        profileBlocks: refreshed?.profileBlocks ?? null,
      },
    });
  } catch (err) {
    return handleInternalError(err);
  }
}
